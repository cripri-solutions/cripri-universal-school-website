import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimNotification,
  finalizeNotification,
  notificationEmailPayload,
  notificationIdempotencyKey,
  reclaimStaleNotification,
} from "./notification-idempotency.js";

test("idempotency key is stable for one notification and distinct across notifications", () => {
  assert.equal(notificationIdempotencyKey("abc-123"), "cripri-school-review/abc-123");
  assert.equal(notificationIdempotencyKey("abc-123"), notificationIdempotencyKey("abc-123"));
  assert.notEqual(notificationIdempotencyKey("abc-123"), notificationIdempotencyKey("xyz-789"));
  assert.throws(() => notificationIdempotencyKey(""), /notification ID/);
});

test("email payload is deterministic for retries of the same notification", () => {
  const input = { from: "CRIPRI <mail@example.org>", recipient: "person@example.org", title: "Approved", message: "Your application was approved." };
  assert.deepEqual(notificationEmailPayload(input), {
    from: input.from,
    to: [input.recipient],
    subject: "CRIPRI: Approved",
    text: "Your application was approved.\n\nCRIPRI Technologies\nUniversal School Platform",
  });
});

function createAtomicMock(initialStatus, initialClaim = null) {
  const row = { id: "notice-1", email_status: initialStatus, email_claimed_at: initialClaim };
  let values, predicates = [];
  const query = {
    update(next) { values = next; predicates = []; return this; },
    eq(column, value) { predicates.push([column, value]); return this; },
    in(column, values) { predicates.push([column, values, "in"]); return this; },
    select(columns) { assert.equal(columns, "id"); return this; },
    async maybeSingle() {
      const matches = predicates.every(([column, value, op]) =>
        op === "in" ? value.includes(row[column]) : row[column] === value
      );
      if (!matches) return { data: null, error: null };
      Object.assign(row, values);
      return { data: { id: row.id }, error: null };
    },
  };
  return { client: { from(table) { assert.equal(table, "platform_notifications"); return query; } }, row };
}

test("only one concurrent request can claim a pending notification", async () => {
  const { client, row } = createAtomicMock("pending");
  const results = await Promise.all([
    claimNotification(client, "notice-1", "2026-11-26T12:00:00.000Z"),
    claimNotification(client, "notice-1", "2026-11-26T12:00:00.001Z"),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(row.email_status, "sending");
  assert.ok(row.email_claimed_at);
});

test("failed notifications remain eligible for retry", async () => {
  const { client, row } = createAtomicMock("failed");
  assert.deepEqual(await claimNotification(client, "notice-1", "2026-11-26T12:00:00.000Z"), { id: "notice-1" });
  assert.equal(row.email_status, "sending");
});

test("sending and sent notifications cannot be claimed as new sends", async () => {
  for (const status of ["sending", "sent", "skipped"]) {
    const { client, row } = createAtomicMock(status);
    assert.equal(await claimNotification(client, "notice-1", "2026-11-26T12:00:00.000Z"), null);
    assert.equal(row.email_status, status);
  }
});

test("stale in-flight claim can be reclaimed only if its timestamp still matches", async () => {
  const { client, row } = createAtomicMock("sending", "2026-11-26T11:00:00.000Z");
  const reclaimed = await reclaimStaleNotification(client, "notice-1", row.email_claimed_at, "2026-11-26T12:00:00.000Z");
  assert.deepEqual(reclaimed, { id: "notice-1" });
  assert.equal(row.email_claimed_at, "2026-11-26T12:00:00.000Z");
  assert.equal(await reclaimStaleNotification(client, "notice-1", "2026-11-26T11:00:00.000Z", "2026-11-26T12:01:00.000Z"), null);
});

test("finalization only succeeds for the current claim owner", async () => {
  const { client, row } = createAtomicMock("sending", "2026-11-26T12:00:00.000Z");
  assert.deepEqual(await finalizeNotification(client, "notice-1", "2026-11-26T12:00:00.000Z", { email_status: "sent" }), { id: "notice-1" });
  assert.equal(row.email_status, "sent");
  assert.equal(await finalizeNotification(client, "notice-1", "2026-11-26T11:00:00.000Z", { email_status: "failed" }), null);
  assert.equal(row.email_status, "sent");
});

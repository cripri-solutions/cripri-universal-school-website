import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claimNotification,
  notificationEmailPayload,
  notificationIdempotencyKey,
} from "./notification-idempotency.js";

test("idempotency key is stable for one notification and distinct across notifications", () => {
  assert.equal(notificationIdempotencyKey("abc-123"), "cripri-school-review/abc-123");
  assert.equal(notificationIdempotencyKey("abc-123"), notificationIdempotencyKey("abc-123"));
  assert.notEqual(notificationIdempotencyKey("abc-123"), notificationIdempotencyKey("xyz-789"));
  assert.throws(() => notificationIdempotencyKey(""), /notification ID/);
});

test("email payload is deterministic for retries of the same notification", () => {
  const input = { from: "CRIPRI <mail@example.org>", recipient: "person@example.org", title: "Approved", message: "Your application was approved." };
  assert.deepEqual(notificationEmailPayload(input), notificationEmailPayload(input));
  assert.deepEqual(notificationEmailPayload(input), {
    from: input.from,
    to: [input.recipient],
    subject: "CRIPRI: Approved",
    text: "Your application was approved.\n\nCRIPRI Technologies\nUniversal School Platform",
  });
});

function createAtomicMock(initialStatus) {
  const row = { id: "notice-1", email_status: initialStatus };
  let updateValues;
  let allowedStatuses;
  let requestedId;
  const query = {
    update(values) { updateValues = values; return this; },
    eq(column, value) { assert.equal(column, "id"); requestedId = value; return this; },
    in(column, values) { assert.equal(column, "email_status"); allowedStatuses = values; return this; },
    select(columns) { assert.equal(columns, "id"); return this; },
    async maybeSingle() {
      if (row.id !== requestedId || !allowedStatuses.includes(row.email_status)) return { data: null, error: null };
      Object.assign(row, updateValues);
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

test("failed notifications remain eligible for a controlled retry", async () => {
  const { client, row } = createAtomicMock("failed");
  const claimed = await claimNotification(client, "notice-1", "2026-11-26T12:00:00.000Z");
  assert.deepEqual(claimed, { id: "notice-1" });
  assert.equal(row.email_status, "sending");
});

test("already-sending and sent notifications cannot be claimed again", async () => {
  for (const status of ["sending", "sent", "skipped"]) {
    const { client, row } = createAtomicMock(status);
    const claimed = await claimNotification(client, "notice-1", "2026-11-26T12:00:00.000Z");
    assert.equal(claimed, null);
    assert.equal(row.email_status, status);
  }
});

export function notificationIdempotencyKey(notificationId) {
  const id = String(notificationId || "").trim();
  if (!id) throw new Error("A notification ID is required for an idempotency key.");
  return `cripri-school-review/${id}`;
}

export function notificationEmailPayload({ from, recipient, title, message }) {
  return {
    from,
    to: [recipient],
    subject: `CRIPRI: ${title}`,
    text: `${message}\n\nCRIPRI Technologies\nUniversal School Platform`,
  };
}

// The conditional UPDATE is the atomic claim: only one concurrent request can
// move a notification from pending/failed to sending.
export async function claimNotification(caller, notificationId, claimedAt) {
  const { data, error } = await caller
    .from("platform_notifications")
    .update({
      email_status: "sending",
      email_claimed_at: claimedAt,
      email_error: null,
    })
    .eq("id", notificationId)
    .in("email_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data;
}

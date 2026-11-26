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

export async function claimNotification(caller, notificationId, claimedAt) {
  const { data, error } = await caller
    .from("platform_notifications")
    .update({ email_status: "sending", email_claimed_at: claimedAt, email_error: null })
    .eq("id", notificationId)
    .in("email_status", ["pending", "failed"])
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function reclaimStaleNotification(caller, notificationId, previousClaim, claimedAt) {
  const { data, error } = await caller
    .from("platform_notifications")
    .update({ email_status: "sending", email_claimed_at: claimedAt, email_error: null })
    .eq("id", notificationId)
    .eq("email_status", "sending")
    .eq("email_claimed_at", previousClaim)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function finalizeNotification(caller, notificationId, claimedAt, values) {
  const { data, error } = await caller
    .from("platform_notifications")
    .update(values)
    .eq("id", notificationId)
    .eq("email_status", "sending")
    .eq("email_claimed_at", claimedAt)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data;
}

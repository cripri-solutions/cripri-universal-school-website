import { createClient } from "npm:@supabase/supabase-js@2";
import {
  claimNotification,
  finalizeNotification,
  notificationEmailPayload,
  notificationIdempotencyKey,
  reclaimStaleNotification,
} from "./notification-idempotency.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cripri-solutions.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

const STALE_CLAIM_MS = 10 * 60 * 1000;
const RESEND_IDEMPOTENCY_WINDOW_MS = 24 * 60 * 60 * 1000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL");
    if (!url || !anonKey) return json({ error: "Supabase server configuration is incomplete." }, 500);
    if (!resendKey || !fromEmail) return json({ error: "Configure RESEND_API_KEY and RESEND_FROM_EMAIL in Edge Function secrets." }, 500);

    const token = authHeader.slice(7);
    const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await caller.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

    const { data: reviewer, error: reviewerError } = await caller.from("platform_reviewers")
      .select("user_id").eq("user_id", authData.user.id).eq("active", true).maybeSingle();
    if (reviewerError || !reviewer) return json({ error: "Active CRIPRI Super Admin access is required." }, 403);

    const body = await req.json().catch(() => ({}));
    const notificationId = String(body.notification_id || "").trim();
    if (!notificationId) return json({ error: "notification_id is required." }, 400);

    const { data: notification, error: readError } = await caller.from("platform_notifications")
      .select("id,title,message,recipient_email,email_status,email_claimed_at")
      .eq("id", notificationId).maybeSingle();
    if (readError) throw readError;
    if (!notification) return json({ error: "Notification not found." }, 404);
    if (notification.email_status === "sent")
      return json({ success: true, already_sent: true, message: "This notification was already emailed." });
    if (!notification.recipient_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notification.recipient_email))
      return json({ error: "Recipient email address is missing or invalid." }, 422);

    const now = new Date();
    const claimedAt = now.toISOString();
    let claim = await claimNotification(caller, notificationId, claimedAt);

    if (!claim && notification.email_status === "sending" && notification.email_claimed_at) {
      const previousClaimMs = Date.parse(notification.email_claimed_at);
      const ageMs = now.getTime() - previousClaimMs;
      if (!Number.isFinite(previousClaimMs) || ageMs < STALE_CLAIM_MS)
        return json({ error: "This notification is already being processed. Wait before retrying." }, 409);
      if (ageMs >= RESEND_IDEMPOTENCY_WINDOW_MS)
        return json({ error: "This send attempt is older than Resend's 24-hour idempotency window. Verify delivery in Resend before manually retrying." }, 409);
      claim = await reclaimStaleNotification(caller, notificationId, notification.email_claimed_at, claimedAt);
    }

    if (!claim) return json({ error: "Another request claimed this notification. Refresh and check its status." }, 409);

    const payload = notificationEmailPayload({
      from: fromEmail,
      recipient: notification.recipient_email,
      title: notification.title,
      message: notification.message,
    });
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": notificationIdempotencyKey(notificationId),
      },
      body: JSON.stringify(payload),
    });
    const resendBody = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      const message = String(resendBody.message || resendBody.error || "Resend rejected the email.");
      await finalizeNotification(caller, notificationId, claimedAt, {
        email_status: "failed", email_error: message, email_claimed_at: null,
      });
      return json({ error: message, provider_status: resendResponse.status }, 502);
    }

    const finalized = await finalizeNotification(caller, notificationId, claimedAt, {
      email_status: "sent",
      resend_message_id: resendBody.id || null,
      email_error: null,
      email_claimed_at: null,
      sent_at: new Date().toISOString(),
    });
    if (!finalized)
      return json({ error: "Resend accepted the email, but the notification record changed during finalization. Refresh before retrying." }, 500);
    return json({ success: true, recipient: notification.recipient_email, resend_id: resendBody.id || null, message: "Email accepted by Resend." });
  } catch (error) {
    console.error("send-school-notification:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});

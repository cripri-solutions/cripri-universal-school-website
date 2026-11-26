import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cripri-solutions.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

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

    // Use the authenticated reviewer client; active reviewers are authorized by this table's RLS policies.
    const { data: n, error: readError } = await caller.from("platform_notifications")
      .select("id,title,message,recipient_email,email_status")
      .eq("id", notificationId).maybeSingle();
    if (readError) throw readError;
    if (!n) return json({ error: "Notification not found." }, 404);
    if (!n.recipient_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n.recipient_email))
      return json({ error: "Recipient email address is missing or invalid." }, 422);
    if (n.email_status === "sent") return json({ success: true, already_sent: true, message: "This notification was already emailed." });

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [n.recipient_email],
        subject: `CRIPRI: ${n.title}`,
        text: `${n.message}\n\nCRIPRI Technologies\nUniversal School Platform`,
      }),
    });
    const resendBody = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      const message = String(resendBody.message || resendBody.error || "Resend rejected the email.");
      await caller.from("platform_notifications").update({ email_status: "failed", email_error: message }).eq("id", notificationId);
      return json({ error: message, provider_status: resendResponse.status }, 502);
    }

    const { error: updateError } = await caller.from("platform_notifications").update({
      email_status: "sent", resend_message_id: resendBody.id || null, email_error: null, sent_at: new Date().toISOString(),
    }).eq("id", notificationId);
    if (updateError) throw updateError;
    return json({ success: true, recipient: n.recipient_email, resend_id: resendBody.id || null, message: "Email accepted by Resend." });
  } catch (error) {
    console.error("send-school-notification:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});
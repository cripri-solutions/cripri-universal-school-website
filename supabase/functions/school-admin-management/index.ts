import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cripri-solutions.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return reply({ error: "Sign in required." }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!service) return reply({ error: "Server admin configuration is missing." }, 500);

    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: userData, error: userError } = await caller.auth.getUser(auth.slice(7));
    if (userError || !userData.user) return reply({ error: "Invalid session." }, 401);
    const { data: reviewer, error: reviewerError } = await caller.from("platform_reviewers")
      .select("user_id").eq("user_id", userData.user.id).eq("active", true).maybeSingle();
    if (reviewerError || !reviewer) return reply({ error: "Active CRIPRI Super Admin access is required." }, 403);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const schoolId = String(body.school_id || "");
    const role = String(body.role || "");
    if (!schoolId || !["school_admin", "content_editor"].includes(role))
      return reply({ error: "A school and valid role are required." }, 400);

    const { data: school, error: schoolError } = await admin.from("schools").select("id,name,status").eq("id", schoolId).maybeSingle();
    if (schoolError || !school) return reply({ error: "School not found." }, 404);
    if (school.status !== "active") return reply({ error: "Only active schools can receive administrator memberships." }, 409);

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: "Enter a valid email address." }, 400);
      const { data: invitation, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: "https://cripri-solutions.github.io/cripri-universal-school-website/school-website.manager.html",
        data: { invited_school_id: schoolId, invited_role: role }
      });
      if (inviteError) return reply({ error: inviteError.message }, 400);
      const targetId = invitation.user?.id;
      if (!targetId) return reply({ error: "Invitation was sent but no user ID was returned. Check Auth users before retrying." }, 502);
      const { error: membershipError } = await admin.from("school_memberships")
        .upsert({ school_id: schoolId, user_id: targetId, role }, { onConflict: "school_id,user_id" });
      if (membershipError) return reply({ error: "Invitation created but membership failed: " + membershipError.message }, 500);
      const { error: auditError } = await admin.from("school_admin_audit").insert({
        school_id: schoolId, target_user_id: targetId, actor_user_id: userData.user.id,
        action: "invited", role, target_email: email
      });
      if (auditError) console.error("Audit insert failed:", auditError);
      return reply({ success: true, message: "Invitation sent and school membership recorded.", email });
    }

    const userId = String(body.user_id || "");
    if (!userId) return reply({ error: "User ID is required." }, 400);
    const { data: membership, error: membershipReadError } = await admin.from("school_memberships")
      .select("id,role").eq("school_id", schoolId).eq("user_id", userId).maybeSingle();
    if (membershipReadError || !membership) return reply({ error: "School membership not found." }, 404);

    if (action === "change_role") {
      const { error } = await admin.from("school_memberships").update({ role }).eq("id", membership.id);
      if (error) return reply({ error: error.message }, 400);
      await admin.from("school_admin_audit").insert({ school_id: schoolId, target_user_id: userId, actor_user_id: userData.user.id, action: "role_changed", role });
      return reply({ success: true, message: "Membership role updated." });
    }
    if (action === "remove") {
      const { error } = await admin.from("school_memberships").delete().eq("id", membership.id);
      if (error) return reply({ error: error.message }, 400);
      await admin.from("school_admin_audit").insert({ school_id: schoolId, target_user_id: userId, actor_user_id: userData.user.id, action: "removed", role: membership.role });
      return reply({ success: true, message: "School membership removed. The Auth account remains intact." });
    }
    return reply({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("school-admin-management:", error);
    return reply({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});
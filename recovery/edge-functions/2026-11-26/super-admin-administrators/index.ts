import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://cripri-solutions.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!url || !anonKey || !serviceKey) return json({ error: "Server configuration is incomplete." }, 500);

    const callerClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice("Bearer ".length);
    const { data: authData, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid or expired session." }, 401);

    const { data: reviewer, error: reviewerError } = await callerClient
      .from("platform_reviewers")
      .select("user_id")
      .eq("user_id", authData.user.id)
      .eq("active", true)
      .maybeSingle();

    if (reviewerError || !reviewer) return json({ error: "Active CRIPRI Super Admin access is required." }, 403);

    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    if (action === "list") {
      const [{ data: memberships, error: membershipError }, { data: schools, error: schoolError }, { data: usersData, error: usersError }] = await Promise.all([
        admin.from("school_memberships")
          .select("id,school_id,user_id,role,created_at,schools!inner(id,name,slug,status)")
          .order("created_at", { ascending: false }),
        admin.from("schools")
          .select("id,name,slug,status")
          .order("name", { ascending: true }),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

      if (membershipError) throw membershipError;
      if (schoolError) throw schoolError;
      if (usersError) throw usersError;

      const emails = new Map((usersData.users || []).map((u) => [u.id, u.email || ""]));
      const administrators = (memberships || []).map((m) => ({
        id: m.id,
        school_id: m.school_id,
        school_name: m.schools?.name || "Unknown school",
        school_slug: m.schools?.slug || "",
        school_status: m.schools?.status || "",
        user_id: m.user_id,
        email: emails.get(m.user_id) || "Email unavailable",
        role: m.role,
        created_at: m.created_at,
      }));

      return json({ administrators, schools: schools || [] });
    }

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const schoolId = String(body.school_id || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid administrator email address." }, 400);
      if (!schoolId) return json({ error: "Select a school." }, 400);

      const { data: school, error: schoolError } = await admin
        .from("schools")
        .select("id,name,status")
        .eq("id", schoolId)
        .maybeSingle();
      if (schoolError) throw schoolError;
      if (!school) return json({ error: "Selected school was not found." }, 404);
      if (school.status !== "active") return json({ error: "Only active schools can receive a school administrator account." }, 409);

      const { data: usersData, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (usersError) throw usersError;
      const existingUser = (usersData.users || []).find((u) => (u.email || "").toLowerCase() === email);

      let userId = existingUser?.id;
      let invitationSent = false;

      if (!userId) {
        const redirectTo = "https://cripri-solutions.github.io/cripri-universal-school-website/school-website.manager.html";
        const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { invited_for_school: schoolId, invited_role: "school_admin" },
        });
        if (inviteError) throw inviteError;
        userId = inviteData.user?.id;
        invitationSent = true;
      }

      if (!userId) return json({ error: "Supabase did not return the invited user account." }, 500);

      const { data: membership, error: membershipError } = await admin
        .from("school_memberships")
        .upsert(
          { school_id: schoolId, user_id: userId, role: "school_admin" },
          { onConflict: "school_id,user_id" },
        )
        .select("id,school_id,user_id,role,created_at")
        .single();

      if (membershipError) throw membershipError;

      return json({
        success: true,
        invitation_sent: invitationSent,
        existing_account: Boolean(existingUser),
        email,
        school_name: school.name,
        role: "school_admin",
        membership,
        message: invitationSent
          ? "Invitation email sent. The administrator must accept it and set up access."
          : "This email already has a Supabase account. School administrator access has been assigned to that account.",
      });
    }

    return json({ error: "Unsupported action." }, 400);
  } catch (error) {
    console.error("super-admin-administrators:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error." }, 500);
  }
});
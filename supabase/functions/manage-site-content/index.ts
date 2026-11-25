import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return response({ error: "Sign in is required." }, 401);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return response({ error: "Supabase function configuration is incomplete." }, 500);

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) return response({ error: "Your sign-in session is invalid or expired." }, 401);

  let input: { school_id?: string; action?: string; payload?: Record<string, unknown> };
  try { input = await req.json(); } catch { return response({ error: "Request body must be valid JSON." }, 400); }
  if (!input.school_id || !/^[0-9a-f-]{36}$/i.test(input.school_id)) {
    return response({ error: "A valid school_id is required." }, 400);
  }
  const allowed = new Set(["save", "publish", "withdraw", "recover", "restore", "permanent_delete"]);
  if (!input.action || !allowed.has(input.action)) return response({ error: "Unsupported content action." }, 400);

  const { data, error } = await supabase.rpc("manage_school_site_content", {
    p_school_id: input.school_id,
    p_action: input.action,
    p_payload: input.payload ?? {},
  });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return response({ error: error.message }, status);
  }
  return response({ data });
});

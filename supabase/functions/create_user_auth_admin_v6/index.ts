import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  role_id: string;
  call_center_id?: string | null;
  /** Set when role is sales_agent_unlicensed */
  unlicensed_sales_subtype?: string | null;
  permissions?: string[];
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice(7).trim();
}

function getDefaultPasswordFromFullName(fullName: string): string {
  const rawFirstName = (fullName || "").trim().split(/\s+/)[0] || "user";
  const normalizedFirstName = rawFirstName.toLowerCase();
  return `${normalizedFirstName}123!`;
}

function normalizeUnlicensedSubtype(roleKey: string | undefined, raw: unknown): string | null {
  if (roleKey !== "sales_agent_unlicensed") return null;
  if (raw === null || raw === undefined || raw === "") return null;
  const s = String(raw);
  if (s === "buffer_agent" || s === "retention_agent") return s;
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    );

    const token = getBearerToken(req);
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: callerAuth, error: callerAuthError } = await adminClient.auth.getUser(token);
    if (callerAuthError || !callerAuth?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerId = callerAuth.user.id;
    const { data: callerRoleRow, error: callerRoleError } = await adminClient
      .from("users")
      .select("roles!users_role_id_fkey(key)")
      .eq("id", callerId)
      .single();

    if (callerRoleError) {
      return new Response(JSON.stringify({ error: `Unable to verify caller role: ${callerRoleError.message}` }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerRoleKey = (callerRoleRow as { roles?: { key?: string } })?.roles?.key;
    if (!["system_admin", "hr"].includes(callerRoleKey || "")) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as CreateUserRequest;
    if (!body.email || !body.full_name || !body.role_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: email, full_name, role_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: roleRow, error: roleErr } = await adminClient.from("roles").select("key").eq("id", body.role_id).single();
    if (roleErr || !roleRow) {
      return new Response(JSON.stringify({ error: `Invalid role: ${roleErr?.message || "not found"}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const roleKey = (roleRow as { key: string }).key;
    const unlicensedSubtype = normalizeUnlicensedSubtype(roleKey, body.unlicensed_sales_subtype);

    const tempPassword = getDefaultPasswordFromFullName(body.full_name);
    const { data: createdAuth, error: createAuthError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: tempPassword,
      email_confirm: true,
    });

    if (createAuthError || !createdAuth?.user) {
      return new Response(JSON.stringify({ error: `Failed to create auth user: ${createAuthError?.message || "unknown error"}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = createdAuth.user.id;

    const { error: profileError } = await adminClient.from("users").insert({
      id: userId,
      email: body.email,
      full_name: body.full_name,
      phone: body.phone || null,
      role_id: body.role_id,
      call_center_id: body.call_center_id || null,
      status: "active",
      unlicensed_sales_subtype: unlicensedSubtype,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.permissions && body.permissions.length > 0) {
      const { error: permissionError } = await adminClient.from("user_permissions").insert(
        body.permissions.map((permission_id) => ({ user_id: userId, permission_id })),
      );

      if (permissionError) {
        await adminClient.from("users").delete().eq("id", userId);
        await adminClient.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: `Failed to assign permissions: ${permissionError.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email: body.email, full_name: body.full_name },
        temp_password: tempPassword,
        message: "User created successfully",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

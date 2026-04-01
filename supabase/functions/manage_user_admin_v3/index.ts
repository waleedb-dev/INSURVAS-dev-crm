import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "update_user" | "delete_user";

interface ManageUserRequest {
  action: Action;
  user_id: string;
  full_name?: string;
  phone?: string;
  role_id?: string;
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

    const body = (await req.json()) as ManageUserRequest;
    if (!body?.action || !body?.user_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: action, user_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.action === "update_user") {
      if (!body.full_name || !body.role_id) {
        return new Response(JSON.stringify({ error: "Missing required fields for update_user: full_name, role_id" }), {
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

      const { error: updateErr } = await adminClient
        .from("users")
        .update({
          full_name: body.full_name,
          phone: body.phone || null,
          role_id: body.role_id,
          call_center_id: body.call_center_id ?? null,
          status: "active",
          unlicensed_sales_subtype: unlicensedSubtype,
        })
        .eq("id", body.user_id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: `Failed to update user: ${updateErr.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: deletePermErr } = await adminClient.from("user_permissions").delete().eq("user_id", body.user_id);
      if (deletePermErr) {
        return new Response(JSON.stringify({ error: `Failed to reset permissions: ${deletePermErr.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      if (body.permissions && body.permissions.length > 0) {
        const { error: insertPermErr } = await adminClient.from("user_permissions").insert(
          body.permissions.map((permission_id) => ({ user_id: body.user_id, permission_id })),
        );
        if (insertPermErr) {
          return new Response(JSON.stringify({ error: `Failed to assign permissions: ${insertPermErr.message}` }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "User updated" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (body.action === "delete_user") {
      if (body.user_id === callerId) {
        return new Response(JSON.stringify({ error: "You cannot delete your own account" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: deletePermErr } = await adminClient.from("user_permissions").delete().eq("user_id", body.user_id);
      if (deletePermErr) {
        return new Response(JSON.stringify({ error: `Failed to delete user permissions: ${deletePermErr.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: deleteProfileErr } = await adminClient.from("users").delete().eq("id", body.user_id);
      if (deleteProfileErr) {
        return new Response(JSON.stringify({ error: `Failed to delete user profile: ${deleteProfileErr.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      const { error: deleteAuthErr } = await adminClient.auth.admin.deleteUser(body.user_id);
      if (deleteAuthErr) {
        return new Response(JSON.stringify({ error: `Deleted profile but failed to delete auth user: ${deleteAuthErr.message}` }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "User deleted" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: "Unsupported action" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

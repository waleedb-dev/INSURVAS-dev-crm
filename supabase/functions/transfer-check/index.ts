/**
 * Edge function: `transfer-check`
 * Proxies the agency transfer checker (TCPA / policy).
 *
 * `verify_jwt` is disabled at the API gateway so requests are not rejected with
 * `{ code: 401, message: "Invalid JWT" }` before this code runs (known friction
 * with some auth key / JWT setups). This handler still requires a valid user
 * session via `auth.getUser(jwt)`.
 *
 * Optional secret: TRANSFER_CHECK_UPSTREAM_URL
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_UPSTREAM = "https://livetransferchecker.vercel.app/api/transfer-check";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return new Response(
      JSON.stringify({ message: "Unauthorized", detail: userError?.message ?? null }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: { phone?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ message: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = String(body.phone ?? "");
  const digits = raw.replace(/\D/g, "");
  let cleanPhone: string;
  if (digits.length === 10) {
    cleanPhone = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    cleanPhone = digits.slice(1);
  } else {
    return new Response(JSON.stringify({ message: "Please provide a valid 10-digit US phone number." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const upstream = Deno.env.get("TRANSFER_CHECK_UPSTREAM_URL")?.trim() || DEFAULT_UPSTREAM;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: cleanPhone }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upstream transfer check unreachable";
    return new Response(JSON.stringify({ message: msg }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const text = await upstreamRes.text();
  return new Response(text, {
    status: upstreamRes.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

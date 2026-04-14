import type { SupabaseClient } from "@supabase/supabase-js";

function shouldRetryAfterRefresh(body: Record<string, unknown>, status: number): boolean {
  if (status !== 401) return false;
  const msg = String(body.message ?? body.error ?? "").toLowerCase();
  return msg.includes("jwt") || msg.includes("invalid") || body.code === 401;
}

async function parseFunctionsErrorBody(error: Error & { context?: Response }): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const res = error.context;
  const status = res?.status ?? 500;
  let body: Record<string, unknown> = { message: error.message };
  const readable = res && typeof res.clone === "function" ? res.clone() : res;
  if (readable && typeof readable.json === "function") {
    try {
      const j = await readable.json();
      if (j && typeof j === "object" && !Array.isArray(j)) {
        body = j as Record<string, unknown>;
      }
    } catch {
      /* keep message */
    }
  }
  return { status, body };
}

export type RunDncLookupOptions = {
  /** Optional lead row UUID — TCPA hit may deactivate via service role on the edge function. */
  leadId?: string;
};

/**
 * Calls `dnc-lookup` (RealValidito + Blacklist Alliance) with the same Bearer pattern as `transfer-check`.
 */
export async function runDncLookup(
  supabase: SupabaseClient,
  phone10: string,
  options?: RunDncLookupOptions,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession();
  let accessToken = initialSession?.access_token ?? null;
  if (!accessToken) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    accessToken = refreshed.session?.access_token ?? null;
  }
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      data: { message: "Your session expired. Please sign in again.", callStatus: "ERROR" },
    };
  }

  const body: Record<string, string> = { mobileNumber: phone10 };
  const lid = options?.leadId?.trim();
  if (lid) body.leadId = lid;

  const invoke = (token: string) =>
    supabase.functions.invoke("dnc-lookup", {
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let { data, error } = await invoke(accessToken);

  if (error) {
    const parsed = await parseFunctionsErrorBody(error as Error & { context?: Response });
    if (shouldRetryAfterRefresh(parsed.body, parsed.status)) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      const next = refreshed.session?.access_token;
      if (next) {
        ({ data, error } = await invoke(next));
      }
    }
  }

  if (error) {
    const parsed = await parseFunctionsErrorBody(error as Error & { context?: Response });
    return { ok: false, status: parsed.status, data: parsed.body };
  }

  const payload =
    data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  return { ok: true, status: 200, data: payload };
}

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shown when the agency transfer-check API returns success (no TCPA litigator / agency DQ block).
 * We intentionally do not surface raw API strings like “Customer not found in system — Approved…”.
 */
export const TRANSFER_CHECK_CLEAR_USER_MESSAGE = "Can be sent, approved";

/** Gateway often returns `{ code: 401, message: "Invalid JWT" }` for expired or mismatched tokens. */
function shouldRetryTransferCheckAfterRefresh(body: Record<string, unknown>, status: number): boolean {
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

/**
 * Calls the `transfer-check` Edge Function using the same pattern as other invokes in this app
 * (explicit `Authorization: Bearer <access_token>`). Raw `fetch` to `/functions/v1/...` is easy
 * to misconfigure and triggers gateway `401 Invalid JWT` if headers don’t match what Supabase expects.
 */
export async function runTransferCheck(
  supabase: SupabaseClient,
  phone10: string,
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
      data: { message: "Your session expired. Please sign in again." },
    };
  }

  const invoke = (token: string) =>
    supabase.functions.invoke("transfer-check", {
      body: { phone: phone10 },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let { data, error } = await invoke(accessToken);

  if (error) {
    const parsed = await parseFunctionsErrorBody(error as Error & { context?: Response });
    if (shouldRetryTransferCheckAfterRefresh(parsed.body, parsed.status)) {
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

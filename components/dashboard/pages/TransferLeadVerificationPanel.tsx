"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  loadVerificationItems,
  updateVerificationItem,
  type VerificationItemRow,
} from "./transferLeadParity";

type Props = {
  sessionId: string;
};

export default function TransferLeadVerificationPanel({ sessionId }: Props) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [items, setItems] = useState<VerificationItemRow[]>([]);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const loaded = await loadVerificationItems(supabase, sessionId);
        if (cancelled) return;
        setItems(loaded);
        setDraftValues(
          Object.fromEntries(
            loaded.map((item) => [item.id, item.verified_value ?? item.original_value ?? ""]),
          ),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load verification fields.");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sessionId, supabase]);

  const verifiedCount = items.filter((item) => item.is_verified).length;
  const progress = items.length > 0 ? Math.round((verifiedCount * 100) / items.length) : 0;

  const grouped = useMemo(() => {
    const byGroup = new Map<string, VerificationItemRow[]>();
    items.forEach((item) => {
      const key = item.field_category || "other";
      byGroup.set(key, [...(byGroup.get(key) || []), item]);
    });
    return Array.from(byGroup.entries());
  }, [items]);

  const saveOne = async (item: VerificationItemRow, nextIsVerified: boolean) => {
    setSavingIds((prev) => ({ ...prev, [item.id]: true }));
    setError(null);
    try {
      const nextValue = draftValues[item.id] ?? item.verified_value ?? item.original_value ?? "";
      await updateVerificationItem(supabase, item.id, {
        isVerified: nextIsVerified,
        verifiedValue: nextValue,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                is_verified: nextIsVerified,
                verified_value: nextValue,
              }
            : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save verification update.");
    } finally {
      setSavingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: `1.5px solid ${T.border}`,
        borderRadius: 18,
        boxShadow: T.shadowSm,
        padding: 18,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: T.textDark, fontWeight: 800 }}>Verification Panel</h3>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.textMid }}>
          {verifiedCount}/{items.length} fields verified
        </span>
      </div>
      <div style={{ marginTop: 10, marginBottom: 14 }}>
        <div style={{ height: 10, borderRadius: 999, backgroundColor: T.rowBg, overflow: "hidden" }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: progress >= 100 ? "#16a34a" : T.blue,
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: T.textMuted }}>Progress: {progress}%</p>
      </div>

      {error && (
        <div style={{ marginBottom: 10, color: "#991b1b", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
        {grouped.map(([groupName, groupItems]) => (
          <section key={groupName}>
            <h4 style={{ margin: "0 0 8px", textTransform: "capitalize", fontSize: 12, letterSpacing: 0.3, color: T.textMuted }}>
              {groupName}
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {groupItems.map((item) => {
                const isSaving = Boolean(savingIds[item.id]);
                return (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${T.border}`,
                      borderRadius: 10,
                      padding: 10,
                      backgroundColor: item.is_verified ? "#f0fdf4" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.textDark }}>{item.field_name.replaceAll("_", " ")}</span>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.textMid }}>
                        <input
                          type="checkbox"
                          checked={Boolean(item.is_verified)}
                          disabled={isSaving}
                          onChange={(e) => {
                            void saveOne(item, e.target.checked);
                          }}
                        />
                        Verified
                      </label>
                    </div>

                    <input
                      value={draftValues[item.id] ?? ""}
                      onChange={(e) => setDraftValues((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      onBlur={() => {
                        const current = draftValues[item.id] ?? "";
                        if (current === (item.verified_value ?? item.original_value ?? "")) return;
                        void saveOne(item, Boolean(item.is_verified));
                      }}
                      style={{
                        width: "100%",
                        border: `1px solid ${T.border}`,
                        borderRadius: 8,
                        padding: "7px 9px",
                        fontSize: 12,
                        color: T.textDark,
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

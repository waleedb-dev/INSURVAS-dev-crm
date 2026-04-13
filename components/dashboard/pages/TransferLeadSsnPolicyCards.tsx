"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { T } from "@/lib/theme";
import { LeadCard, InfoField, InfoGrid, formatCurrency, formatDate } from "./LeadCard";

type Props = {
  leadRowId: string;
  supabase: SupabaseClient;
};

function normalizeSsnDigits(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : null;
}

function formatMoney(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "—";
  const n = Number(String(raw).replace(/\$/g, "").replace(/,/g, "").trim());
  if (Number.isFinite(n)) return formatCurrency(n);
  return String(raw);
}

function displayText(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}

type LeadMeta = { submission_id: string; label: string };

export default function TransferLeadSsnPolicyCards({ leadRowId, supabase }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policySummary, setPolicySummary] = useState<string>("");
  const [policies, setPolicies] = useState<
    {
      row: Record<string, unknown>;
      meta: LeadMeta | null;
      isCurrentLead: boolean;
    }[]
  >([]);
  const [backup, setBackup] = useState<{
    has_backup_quote: boolean;
    backup_carrier: string | null;
    backup_product_type: string | null;
    backup_monthly_premium: string | null;
    backup_coverage_amount: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: leadOwn, error: leadErr } = await supabase
          .from("leads")
          .select(
            "social, has_backup_quote, backup_carrier, backup_product_type, backup_monthly_premium, backup_coverage_amount",
          )
          .eq("id", leadRowId)
          .maybeSingle();
        if (leadErr) throw leadErr;
        if (!leadOwn) throw new Error("Lead not found.");

        if (!cancelled) {
          setBackup({
            has_backup_quote: Boolean(leadOwn.has_backup_quote),
            backup_carrier: (leadOwn.backup_carrier as string | null) ?? null,
            backup_product_type: (leadOwn.backup_product_type as string | null) ?? null,
            backup_monthly_premium: (leadOwn.backup_monthly_premium as string | null) ?? null,
            backup_coverage_amount: (leadOwn.backup_coverage_amount as string | null) ?? null,
          });
        }

        const norm = normalizeSsnDigits(leadOwn.social as string | null);
        if (!norm) {
          if (!cancelled) {
            setPolicies([]);
            setPolicySummary("No SSN on file — policies cannot be matched by SSN.");
          }
          return;
        }

        const { data: allWithSocial, error: socialErr } = await supabase
          .from("leads")
          .select("id, submission_id, first_name, last_name, social")
          .not("social", "is", null);
        if (socialErr) throw socialErr;

        const matchingLeads = (allWithSocial || []).filter(
          (row) => normalizeSsnDigits(String(row.social || "")) === norm,
        );
        const metaById = new Map<string, LeadMeta>();
        for (const row of matchingLeads) {
          const sid = String((row as { submission_id?: string | null }).submission_id || "").trim() || "—";
          const fn = String((row as { first_name?: string | null }).first_name || "").trim();
          const ln = String((row as { last_name?: string | null }).last_name || "").trim();
          const label = [fn, ln].filter(Boolean).join(" ") || "Unnamed";
          metaById.set(String(row.id), { submission_id: sid, label });
        }

        const matchingIds = matchingLeads.map((r) => String(r.id));
        if (matchingIds.length === 0) {
          if (!cancelled) {
            setPolicies([]);
            setPolicySummary("No leads found with a matching normalized SSN.");
          }
          return;
        }

        const { data: polRows, error: polErr } = await supabase
          .from("policies")
          .select(
            "id, policy_number, carrier, policy_type, policy_status, status, effective_date, deal_value, sales_agent, disposition, notes, lead_id",
          )
          .in("lead_id", matchingIds)
          .order("id", { ascending: false });
        if (polErr) throw polErr;

        const list = (polRows || []).map((row) => {
          const lid = row.lead_id != null ? String(row.lead_id) : "";
          return {
            row: row as Record<string, unknown>,
            meta: lid ? metaById.get(lid) ?? null : null,
            isCurrentLead: lid === leadRowId,
          };
        });

        if (!cancelled) {
          setPolicies(list);
          setPolicySummary(
            `Matched ${matchingIds.length} lead record(s) on normalized SSN; ${list.length} policy row(s) in public.policies.`,
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load policy context.");
          setPolicies([]);
          setPolicySummary("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadRowId, supabase]);

  const hasBackupData =
    backup &&
    (backup.has_backup_quote ||
      Boolean(String(backup.backup_carrier || "").trim()) ||
      Boolean(String(backup.backup_product_type || "").trim()) ||
      Boolean(String(backup.backup_monthly_premium || "").trim()) ||
      Boolean(String(backup.backup_coverage_amount || "").trim()));

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: 16,
            border: `1.5px solid ${T.border}`,
            padding: "20px 24px",
            color: T.textMuted,
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Loading policy & backup quote from lead data…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          border: "1px solid #fecaca",
          borderRadius: 12,
          backgroundColor: "#fef2f2",
          color: "#991b1b",
          padding: "12px 14px",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <LeadCard icon="🛡️" title="Policies" defaultExpanded={false}>
        <p style={{ margin: "0 0 16px", fontSize: 12, color: T.textMuted, fontWeight: 600, lineHeight: 1.45 }}>
          {policySummary}
        </p>
        {policies.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: T.textMid, fontWeight: 600 }}>No policy rows to show.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {policies.map(({ row, meta, isCurrentLead }, idx) => (
              <div
                key={String(row.id ?? idx)}
                style={{
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: 14,
                  backgroundColor: T.pageBg,
                }}
              >
                <p style={{ margin: "0 0 12px", fontSize: 12, fontWeight: 800, color: T.textDark }}>
                  {meta ? (
                    <>
                      Submission <span style={{ fontWeight: 800 }}>{meta.submission_id}</span>
                      {" · "}
                      {meta.label}
                      {isCurrentLead ? " · this lead" : ""}
                    </>
                  ) : (
                    <>Policy record {idx + 1}</>
                  )}
                </p>
                <InfoGrid columns={4}>
                  <InfoField label="Policy number" value={displayText(row.policy_number)} />
                  <InfoField label="Carrier" value={displayText(row.carrier)} />
                  <InfoField label="Policy type" value={displayText(row.policy_type)} />
                  <InfoField label="Policy status" value={displayText(row.policy_status)} />
                </InfoGrid>
                <InfoGrid columns={4} bordered={false}>
                  <InfoField label="Status" value={displayText(row.status)} />
                  <InfoField
                    label="Effective date"
                    value={
                      row.effective_date
                        ? formatDate(String(row.effective_date).slice(0, 10))
                        : undefined
                    }
                  />
                  <InfoField
                    label="Deal value"
                    value={
                      row.deal_value != null && row.deal_value !== ""
                        ? formatMoney(row.deal_value as string | number)
                        : undefined
                    }
                  />
                  <InfoField label="Sales agent" value={displayText(row.sales_agent)} />
                </InfoGrid>
                <InfoGrid columns={1} bordered={false}>
                  <InfoField label="Disposition" value={displayText(row.disposition)} />
                  <InfoField label="Notes" value={displayText(row.notes)} />
                </InfoGrid>
              </div>
            ))}
          </div>
        )}
      </LeadCard>

      <LeadCard icon="📑" title="Backup Quote" defaultExpanded={false}>
        {backup &&
          (hasBackupData ? (
            <InfoGrid columns={4} bordered={false}>
              <InfoField label="Backup carrier" value={displayText(backup.backup_carrier)} />
              <InfoField label="Backup product type" value={displayText(backup.backup_product_type)} />
              <InfoField label="Backup monthly premium" value={formatMoney(backup.backup_monthly_premium)} />
              <InfoField label="Backup coverage amount" value={formatMoney(backup.backup_coverage_amount)} />
            </InfoGrid>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: T.textMid, fontWeight: 600 }}>No backup quote on this lead.</p>
          ))}
      </LeadCard>
    </div>
  );
}

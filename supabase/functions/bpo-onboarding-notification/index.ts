/**
 * Edge function: `bpo-onboarding-notification`
 *
 * Handles three notification types for the BPO centre lead pipeline:
 * 1. `form_submitted` — Alerts ops team when a new intake form is submitted.
 * 2. `actively_selling` — Auto-moves centre lead to "Actively Selling" on first sale.
 * 3. `needs_attention` — Auto-moves centre lead to "Needs Attention" when underperforming.
 *
 * All Slack messages post to #test-bpo via the shared SLACK_BOT_TOKEN.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SLACK_CHANNEL = "#test-bpo";

/**
 * Base URL of the Insurvas dashboard. `PORTAL_BASE_URL` is the shared edge-function
 * env var used across notification handlers (matches send-app-fix-notification etc).
 * Fallback points at the current Insurvas dev CRM deployment.
 */
const PORTAL_BASE_URL = (Deno.env.get("PORTAL_BASE_URL") || "https://insurvas-dev-crm.vercel.app").replace(/\/+$/, "");

/** Slack mrkdwn requires &, <, > to be escaped inside link labels. */
function escapeSlackText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildCentreLeadUrl(centerLeadId: string | null | undefined): string | null {
  const id = (centerLeadId ?? "").trim();
  if (!id) return null;
  return `${PORTAL_BASE_URL}/dashboard/system_admin/bpo-centre-leads/${encodeURIComponent(id)}`;
}

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

async function postSlack(payload: Record<string, unknown>) {
  if (!SLACK_BOT_TOKEN) {
    console.error("[bpo-onboarding-notification] SLACK_BOT_TOKEN not set");
    return { ok: false, error: "token_missing" };
  }
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

/** Format date as US-friendly string */
function fmtDate(iso: string | null): string {
  if (!iso) return "N/A";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// ─── Handler: form_submitted ───────────────────────────────────────────────────

async function handleFormSubmitted(body: Record<string, unknown>) {
  const centerLeadId = body.center_lead_id as string;
  const centreName = body.centre_name as string | undefined;
  const teamCount = body.team_count as number | undefined;
  const adminEmail = body.admin_email as string | undefined;

  const leadUrl = buildCentreLeadUrl(centerLeadId);
  const centreLabel = centreName?.trim() || "Unknown centre";
  const centreLine = leadUrl
    ? `*Centre:* <${leadUrl}|${escapeSlackText(centreLabel)}>`
    : `*Centre:* ${centreLabel}`;

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "📋 New BPO Centre Intake Submitted",
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `${centreLine}\n` +
          `*Team size:* ${teamCount ?? "?"} members\n` +
          `*Admin email:* ${adminEmail || "N/A"}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Submitted at ${fmtDate(new Date().toISOString())} • Stage: Pre-onboarding`,
        },
      ],
    },
  ];

  if (leadUrl) {
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Open centre lead", emoji: true },
          url: leadUrl,
          style: "primary",
          action_id: "open_centre_lead",
        },
      ],
    });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: "🔔 *Action needed:* Set up Slack, CRM, and DID credentials for this centre.",
    },
  });

  const slackResult = await postSlack({
    channel: SLACK_CHANNEL,
    blocks,
  });

  return { success: true, slack: slackResult };
}

// ─── Handler: actively_selling ─────────────────────────────────────────────────

async function handleActivelySelling(_body: Record<string, unknown>) {
  const supabase = supabaseAdmin();

  // Find all centre leads at "onboarding_completed" that have a linked centre
  const { data: leads, error: leadsErr } = await supabase
    .from("bpo_center_leads")
    .select("id, centre_display_name, lead_vendor_label, linked_crm_centre_label")
    .eq("stage", "onboarding_completed");

  if (leadsErr || !leads?.length) {
    return { success: true, message: "No leads at onboarding_completed", promoted: [] };
  }

  const promoted: string[] = [];

  for (const lead of leads) {
    const vendorName = lead.lead_vendor_label || lead.linked_crm_centre_label;
    if (!vendorName) continue;

    // Check if there's any submitted application in daily_deal_flow for this vendor
    const { count } = await supabase
      .from("daily_deal_flow")
      .select("id", { count: "exact", head: true })
      .ilike("lead_vendor", vendorName)
      .eq("status", "Pending Approval");

    if (count && count > 0) {
      await supabase
        .from("bpo_center_leads")
        .update({ stage: "actively_selling", updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("stage", "onboarding_completed");

      promoted.push(lead.id);

      const leadUrl = buildCentreLeadUrl(lead.id);
      const centreLabel = lead.centre_display_name || "Centre";
      const centreLink = leadUrl
        ? `<${leadUrl}|${escapeSlackText(centreLabel)}>`
        : escapeSlackText(centreLabel);

      const blocks: Record<string, unknown>[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `🎉 *${centreLink}* just made their first sale!\n` +
              `Auto-promoted to *Actively Selling*.`,
          },
        },
      ];
      if (leadUrl) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Open centre lead", emoji: true },
              url: leadUrl,
              action_id: "open_centre_lead",
            },
          ],
        });
      }

      await postSlack({
        channel: SLACK_CHANNEL,
        blocks,
      });
    }
  }

  return { success: true, promoted };
}

// ─── Handler: needs_attention ──────────────────────────────────────────────────

async function handleNeedsAttention(_body: Record<string, unknown>) {
  const supabase = supabaseAdmin();

  // Find centres that are "actively_selling" with committed targets
  const { data: leads, error: leadsErr } = await supabase
    .from("bpo_center_leads")
    .select(
      "id, centre_display_name, lead_vendor_label, linked_crm_centre_label, committed_daily_sales, expected_start_date",
    )
    .eq("stage", "actively_selling")
    .not("committed_daily_sales", "is", null);

  if (leadsErr || !leads?.length) {
    return { success: true, message: "No actively selling leads with targets", flagged: [] };
  }

  const flagged: string[] = [];

  for (const lead of leads) {
    const vendorName = lead.lead_vendor_label || lead.linked_crm_centre_label;
    if (!vendorName || !lead.committed_daily_sales) continue;

    // Only flag if past expected start date (ramp-up window)
    if (lead.expected_start_date) {
      const startDate = new Date(lead.expected_start_date);
      const rampUpEnd = new Date(startDate);
      rampUpEnd.setDate(rampUpEnd.getDate() + 7);
      if (new Date() < rampUpEnd) continue;
    }

    // Count sales for the last 3 days
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(threeDaysAgo);

    const { count: salesCount } = await supabase
      .from("daily_deal_flow")
      .select("id", { count: "exact", head: true })
      .ilike("lead_vendor", vendorName)
      .eq("status", "Pending Approval")
      .gte("date", threeDaysAgoStr);

    const dailyAvg = (salesCount ?? 0) / 3;
    const threshold = lead.committed_daily_sales * 0.5;

    if (dailyAvg < threshold) {
      await supabase
        .from("bpo_center_leads")
        .update({ stage: "needs_attention", updated_at: new Date().toISOString() })
        .eq("id", lead.id)
        .eq("stage", "actively_selling");

      flagged.push(lead.id);

      const leadUrl = buildCentreLeadUrl(lead.id);
      const centreLabel = lead.centre_display_name || "Centre";
      const centreLink = leadUrl
        ? `<${leadUrl}|${escapeSlackText(centreLabel)}>`
        : escapeSlackText(centreLabel);

      const blocks: Record<string, unknown>[] = [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `⚠️ *${centreLink}* needs attention.\n` +
              `Target: ${lead.committed_daily_sales}/day • Actual (3-day avg): ${dailyAvg.toFixed(1)}/day\n` +
              `Auto-moved to *Needs Attention*.`,
          },
        },
      ];
      if (leadUrl) {
        blocks.push({
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Open centre lead", emoji: true },
              url: leadUrl,
              action_id: "open_centre_lead",
            },
          ],
        });
      }

      await postSlack({
        channel: SLACK_CHANNEL,
        blocks,
      });
    }
  }

  return { success: true, flagged };
}

// ─── Main serve ────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    let result: Record<string, unknown>;

    switch (action) {
      case "form_submitted":
        result = await handleFormSubmitted(body);
        break;
      case "actively_selling":
        result = await handleActivelySelling(body);
        break;
      case "needs_attention":
        result = await handleNeedsAttention(body);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[bpo-onboarding-notification] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

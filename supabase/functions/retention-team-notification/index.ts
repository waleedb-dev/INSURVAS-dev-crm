import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const RETENTION_TEAM_CHANNEL = Deno.env.get("RETENTION_TEAM_SLACK_CHANNEL") || "#retention-team-portal";

/** Matches call-agent.md: application_submitted | fixed_banking | fulfilled_carrier_requirements */
type RetentionNotificationType =
  | "application_submitted"
  | "fixed_banking"
  | "fulfilled_carrier_requirements";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const submissionId = body.submissionId ?? body.submission_id ?? "N/A";
    const notificationType = body.notificationType as RetentionNotificationType | undefined;
    const leadData = body.leadData ?? {};
    const callResult = body.callResult ?? {};

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    if (!notificationType) {
      return new Response(JSON.stringify({ success: false, message: "notificationType is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allowed: RetentionNotificationType[] = [
      "application_submitted",
      "fixed_banking",
      "fulfilled_carrier_requirements",
    ];
    if (!allowed.includes(notificationType)) {
      return new Response(JSON.stringify({ success: false, message: `Invalid notificationType: ${notificationType}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerName = leadData.customer_full_name || callResult.customer_full_name || "Unknown Customer";
    const leadVendor = callResult.lead_vendor || leadData.lead_vendor || "N/A";
    const bufferAgent = callResult.buffer_agent || "N/A";
    const agentWhoTookCall = callResult.agent_who_took_call || "N/A";
    const status = callResult.status || "N/A";
    const notes = callResult.notes || "";
    const dqReason = callResult.dq_reason || callResult.status_reason || "";

    const titles: Record<RetentionNotificationType, string> = {
      application_submitted: "📋 Retention — Application submitted",
      fixed_banking: "🏦 Retention — Updated banking / draft date",
      fulfilled_carrier_requirements: "✅ Retention — Fulfilled carrier requirements",
    };

    const headerText = titles[notificationType];
    const detailLines = [
      `*Customer:* ${customerName}`,
      `*Submission ID:* ${submissionId}`,
      `*Lead vendor:* ${leadVendor}`,
      `*Buffer:* ${bufferAgent} | *Agent:* ${agentWhoTookCall}`,
      `*Status:* ${status}`,
    ];
    if (dqReason) detailLines.push(`*Reason:* ${dqReason}`);
    if (notes) detailLines.push(`*Notes:* ${notes}`);

    const slackMessage = {
      channel: RETENTION_TEAM_CHANNEL,
      text: `${headerText} — ${customerName} (${submissionId})`,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: headerText, emoji: true },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: detailLines.join("\n") },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `notificationType: \`${notificationType}\` | ${new Date().toISOString()}`,
            },
          ],
        },
      ],
    };

    const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    const slackResult = await slackResponse.json();

    if (!slackResult.ok) {
      console.error("[retention-team-notification] Slack error:", slackResult);
      return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageTs: slackResult.ts,
        channel: RETENTION_TEAM_CHANNEL,
        notificationType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[retention-team-notification]", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

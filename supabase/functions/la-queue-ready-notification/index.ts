import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

/** Queue rows labelled test-popup post to #test-bpo instead of the centre's configured channel. */
const TEST_BPO_SLACK_CHANNEL = "#test-bpo";

function isTestPopupCallCentreName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "test-popup" || n.includes("test-popup");
}

/**
 * Posts to the call centre Slack channel when an LA claims / marks ready on an unclaimed transfer queue row.
 * Payload mirrors `center-transfer-notification`: client resolves `slackChannel` from `call_centers.slack_channel`.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const rawBody = await req.text();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ success: false, message: "Invalid JSON body" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let slackChannel = typeof parsed.slackChannel === "string" ? parsed.slackChannel.trim() : "";
    const centerName = typeof parsed.centerName === "string" ? parsed.centerName.trim() : "";
    const queueCallCenterName =
      typeof parsed.queueCallCenterName === "string" ? parsed.queueCallCenterName : "";
    if (isTestPopupCallCentreName(queueCallCenterName)) {
      slackChannel = TEST_BPO_SLACK_CHANNEL;
    }
    const licensedAgentName =
      typeof parsed.licensedAgentName === "string" && parsed.licensedAgentName.trim() !== ""
        ? parsed.licensedAgentName.trim()
        : "Licensed agent";
    const submissionId = parsed.submissionId != null ? String(parsed.submissionId) : "";
    const clientName =
      typeof parsed.clientName === "string" && parsed.clientName.trim() !== ""
        ? parsed.clientName.trim()
        : "";

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }
    if (!slackChannel) {
      return new Response(
        JSON.stringify({ success: false, message: "No slackChannel provided" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const slackText = `*${licensedAgentName}* is ready for transfer.`;

    const slackMessage = {
      channel: slackChannel,
      text: slackText,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: slackText } },
        ...(clientName
          ? [
              {
                type: "section",
                text: { type: "mrkdwn", text: `*Customer:* ${clientName}` },
              },
            ]
          : []),
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Submission ID: ${submissionId || "N/A"} | Center: ${centerName || "N/A"}`,
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
      console.error("[la-queue-ready-notification] Slack API error:", slackResult);
      return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, messageTs: slackResult.ts, channel: slackChannel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[la-queue-ready-notification]", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

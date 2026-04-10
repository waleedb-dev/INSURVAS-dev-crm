import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SLACK_CHANNEL = Deno.env.get("APP_FIX_SLACK_CHANNEL") || "#app-fix-notifications";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("[DEBUG] send-app-fix-notification request:", rawBody);

    const {
      taskId,
      submissionId,
      customerName,
      assignedTo,
      retentionAgent,
      fixType,
      newDraftDate,
      carrier,
      requirementType,
      requirementDetails,
    } = JSON.parse(rawBody);

    if (!SLACK_BOT_TOKEN) {
      console.error("[ERROR] SLACK_BOT_TOKEN not configured");
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const portalBase = (Deno.env.get("PORTAL_BASE_URL") || "https://agents-portal-zeta.vercel.app").replace(
      /\/+$/,
      "",
    );
    const taskUrl = `${portalBase}/task-detail/${taskId}`;

    let notificationTitle = "";
    const additionalFields: Array<{ type: string; text: string }> = [];

    if (fixType === "banking_info") {
      notificationTitle = "🏦 New Banking Update Task";
      additionalFields.push({
        type: "mrkdwn",
        text: `*New Draft Date:*\n${newDraftDate}`,
      });
    } else if (fixType === "carrier_requirement") {
      notificationTitle = "📋 New Carrier Requirement Task";
      additionalFields.push(
        { type: "mrkdwn", text: `*Carrier:*\n${carrier}` },
        { type: "mrkdwn", text: `*Requirement Type:*\n${requirementType}` },
      );
    } else {
      notificationTitle = "📋 App fix task";
    }

    const slackText = `${notificationTitle}\nAssigned to: ${assignedTo} by ${retentionAgent}`;

    const blocks: Array<Record<string, unknown>> = [
      {
        type: "header",
        text: { type: "plain_text", text: notificationTitle, emoji: true },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Assigned To:*\n${assignedTo ?? ""}` },
          { type: "mrkdwn", text: `*Created By:*\n${retentionAgent ?? ""}` },
          { type: "mrkdwn", text: `*Customer:*\n${customerName ?? ""}` },
          { type: "mrkdwn", text: `*Submission ID:*\n${submissionId ?? ""}` },
          ...additionalFields,
        ],
      },
    ];

    if (fixType === "carrier_requirement" && requirementDetails) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Requirement Details:*\n${requirementDetails}` },
      });
    }

    blocks.push(
      { type: "divider" },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "📋 View Task Details", emoji: true },
            url: taskUrl,
            style: "primary",
            action_id: "view_task_detail",
          },
        ],
      },
      {
        type: "context",
        elements: [{ type: "mrkdwn", text: `Task ID: ${taskId} | Submission: ${submissionId}` }],
      },
    );

    const slackMessage = { channel: SLACK_CHANNEL, text: slackText, blocks };

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
      console.error("[ERROR] Slack API error:", slackResult);
      return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, messageTs: slackResult.ts, channel: SLACK_CHANNEL, debug: slackResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ERROR] send-app-fix-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        debug: String(error),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const rawBody = await req.text();
    console.log("[DEBUG] center-transfer-notification body:", rawBody);
    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      console.error("[ERROR] Failed to parse JSON body:", rawBody);
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON body" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { type, submissionId, leadData, bufferAgentName, licensedAgentName, agentName, slackChannel, centerName } = parsed;

    console.log("[DEBUG] Parsed payload:", { type, submissionId, slackChannel, centerName, leadData });

    if (!SLACK_BOT_TOKEN) {
      console.error("[ERROR] SLACK_BOT_TOKEN not configured");
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const centerChannel = slackChannel;
    console.log("[DEBUG] slackChannel value:", centerChannel, typeof centerChannel);
    if (!centerChannel) {
      console.error(`[ERROR] No slackChannel provided - slackChannel is: ${JSON.stringify(slackChannel)}`);
      return new Response(
        JSON.stringify({ success: false, message: `No slackChannel provided`, received: slackChannel }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let slackText = "";
    if (type === "call_dropped") {
      slackText = `:red_circle: Call with *${leadData?.customer_full_name || "Unknown Customer"}* dropped. Need to reconnect.`;
    } else if (type === "transfer_to_la") {
      slackText = `:arrow_right: *${bufferAgentName || "Buffer Agent"}* has transferred *${
        leadData?.customer_full_name || "Unknown Customer"
      }* to *${licensedAgentName || "Licensed Agent"}*.`;
    } else if (type === "verification_started") {
      const startedAgent = agentName || bufferAgentName || licensedAgentName;
      if (startedAgent && leadData?.customer_full_name) {
        slackText = `:white_check_mark: *${startedAgent}* is connected to *${leadData.customer_full_name}*`;
      } else {
        slackText = `:white_check_mark: Agent is connected to *${leadData?.customer_full_name || "Unknown Customer"}*`;
      }
    } else if (type === "reconnected") {
      const effectiveAgentName = agentName || bufferAgentName || licensedAgentName || "Agent";
      slackText = `*${effectiveAgentName}* get connected with *${leadData?.customer_full_name || "Unknown Customer"}*`;
    } else {
      slackText = "Notification.";
    }

    const slackMessage = {
      channel: centerChannel,
      text: slackText,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: slackText } },
        {
          type: "context",
          elements: [{ type: "mrkdwn", text: `Submission ID: ${submissionId || "N/A"} | Center: ${centerName || "N/A"}` }],
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
      console.error("[ERROR] Slack API error:", slackResult);
      return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ success: true, messageTs: slackResult.ts, channel: centerChannel }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[ERROR] center-transfer-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        debug: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

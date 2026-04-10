import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const MEDALERT_CHANNEL = Deno.env.get("MEDALERT_CHANNEL") || "#internal-medalert-sales-portal";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadData, agentName, status, dqReason } = await req.json();

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    if (!leadData || !leadData.customer_full_name) {
      return new Response(JSON.stringify({ success: false, message: "Customer name is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerName = leadData.customer_full_name || "Unknown";
    const phoneNumber = leadData.phone_number || "No phone number";
    const email = leadData.email || "No email";

    const slackMessage = {
      channel: MEDALERT_CHANNEL,
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: "📞 MEDALERT PITCH - CUSTOMER TRANSFER" },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*A Med Alert pitch has been initiated. Please prepare for call transfer.*",
          },
        },
        { type: "divider" },
        {
          type: "section",
          fields: [
            { type: "mrkdwn", text: `*Customer Name:*\n${customerName}` },
            { type: "mrkdwn", text: `*Phone Number:*\n${phoneNumber}` },
            { type: "mrkdwn", text: `*Email:*\n${email}` },
            { type: "mrkdwn", text: `*Original Status:*\n${status || "N/A"}` },
            { type: "mrkdwn", text: `*DQ Reason:*\n${dqReason || "N/A"}` },
            { type: "mrkdwn", text: `*Agent:*\n${agentName || "Unknown"}` },
          ],
        },
        { type: "divider" },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Med Alert DID: 475 236 5826 | Submitted by: ${agentName || "Unknown"} | Time: ${new Date().toLocaleString()}`,
            },
          ],
        },
      ],
    };

    console.log(`Sending Med Alert notification to ${MEDALERT_CHANNEL}`);

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
      console.error("Slack API error:", slackResult.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to send Slack notification",
          error: slackResult.error,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Med Alert notification sent successfully",
        channel: MEDALERT_CHANNEL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in medalert-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const TEST_CHANNEL = "#test-bpo";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const submissionId = body.submissionId ?? body.submission_id ?? "N/A";
    const leadData = body.leadData ?? {
      customer_full_name: body.customer_name,
      phone_number: body.phone_number,
      email: body.email,
      lead_vendor: body.lead_vendor,
    };
    const callResult = body.callResult ?? {
      status: body.status,
      dq_reason: body.dq_reason,
      notes: body.notes,
      lead_vendor: body.lead_vendor,
      agent_who_took_call: body.agent,
      buffer_agent: body.buffer_agent,
    };

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const statusText = callResult?.status || "Not Submitted";
    const reasonText = callResult?.dq_reason || "No specific reason provided";
    const notesText = callResult?.notes || "No additional notes";
    const customerName = leadData?.customer_full_name || "Unknown Customer";
    const leadVendor = callResult?.lead_vendor || leadData?.lead_vendor || "N/A";
    const normalizedStatus = String(callResult?.status || "").trim().normalize("NFKC");
    const normalizedReason = String(callResult?.dq_reason || "").trim().normalize("NFKC");

    let statusEmoji = "⚠️";
    if (normalizedStatus.includes("DQ") || normalizedReason.includes("Chargeback DQ")) {
      statusEmoji = "🚫";
    } else if (normalizedStatus.toLowerCase().includes("callback")) {
      statusEmoji = "📞";
    } else if (normalizedStatus.toLowerCase().includes("not interested")) {
      statusEmoji = "🙅‍♂️";
    } else if (normalizedStatus.toLowerCase().includes("future")) {
      statusEmoji = "📅";
    } else if (normalizedStatus.toLowerCase().includes("submitted")) {
      statusEmoji = "✅";
    }

    const centerSlackMessage = {
      channel: TEST_CHANNEL,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `${statusEmoji} - ${statusText}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Customer Name:* ${customerName}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Status:* ${statusText}\n*Reason:* ${reasonText}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Notes:*\n${notesText}` } },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Lead Vendor: ${leadVendor} | Agent: ${callResult?.agent_who_took_call || "N/A"} | Buffer: ${callResult?.buffer_agent || "N/A"} | Submission ID: ${submissionId}`,
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
      body: JSON.stringify(centerSlackMessage),
    });
    const slackResult = await slackResponse.json();

    if (!slackResult.ok) {
      throw new Error(`Slack API error: ${slackResult.error}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageTs: slackResult.ts,
        channel: TEST_CHANNEL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

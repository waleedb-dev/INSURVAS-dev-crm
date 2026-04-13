import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const BUFFER_CALLBACK_CHANNEL = Deno.env.get("RETENTION_BUFFER_SLACK_CHANNEL") || "#sales-team-callback-portal";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("[DEBUG] retention-call-notification request:", rawBody);

    const {
      type,
      submissionId,
      verificationSessionId,
      bufferAgentName,
      licensedAgentName,
      customerName,
      leadVendor,
      notificationId,
      retentionType,
      retentionNotes,
      quoteDetails,
      portalBaseUrl,
      laReadyUrl,
      updateCallResultUrl,
    } = JSON.parse(rawBody);

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const resolvedPortalBaseUrl =
      typeof portalBaseUrl === "string" && portalBaseUrl.trim().length
        ? portalBaseUrl.replace(/\/+$/, "")
        : Deno.env.get("PORTAL_BASE_URL") || "http://localhost:8080";

    const resolvedLaReadyUrl =
      typeof laReadyUrl === "string" && laReadyUrl.trim().length
        ? laReadyUrl
        : `${resolvedPortalBaseUrl}/call-result-update?submissionId=${encodeURIComponent(
            submissionId ?? "",
          )}&sessionId=${encodeURIComponent(
            verificationSessionId ?? "",
          )}&notificationId=${encodeURIComponent(notificationId ?? "")}`;

    const resolvedUpdateCallResultUrl =
      typeof updateCallResultUrl === "string" && updateCallResultUrl.trim().length
        ? updateCallResultUrl
        : `${resolvedPortalBaseUrl}/agent/call-update?submissionId=${encodeURIComponent(
            submissionId ?? "",
          )}&sessionId=${encodeURIComponent(verificationSessionId ?? "")}`;

    const postSlack = async (slackMessage: Record<string, unknown>) => {
      const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(slackMessage),
      });
      return slackResponse.json();
    };

    if (type === "buffer_connected") {
      let retentionDetailsText = "";

      if (retentionType === "new_sale") {
        retentionDetailsText = "\n\n*Retention Type:* New Sale";
        if (quoteDetails) {
          retentionDetailsText += "\n*Quote Details:*";
          if (quoteDetails.carrier) retentionDetailsText += `\n• Carrier: ${quoteDetails.carrier}`;
          if (quoteDetails.product) retentionDetailsText += `\n• Product: ${quoteDetails.product}`;
          if (quoteDetails.coverage) retentionDetailsText += `\n• Coverage: ${quoteDetails.coverage}`;
          if (quoteDetails.monthlyPremium) {
            retentionDetailsText += `\n• Monthly Premium: ${quoteDetails.monthlyPremium}`;
          }
          if (quoteDetails.draftDate) retentionDetailsText += `\n• Draft Date: ${quoteDetails.draftDate}`;
        }
      } else if (retentionType === "fixed_payment") {
        retentionDetailsText = "\n\n*Retention Type:* Fixed Failed Payment";
        if (retentionNotes) retentionDetailsText += `\n*Notes:* ${retentionNotes}`;
      } else if (retentionType === "carrier_requirements") {
        retentionDetailsText = "\n\n*Retention Type:* Fulfilling Carrier Requirements";
        if (retentionNotes) retentionDetailsText += `\n*Notes:* ${retentionNotes}`;
      }

      const slackMessage = {
        channel: BUFFER_CALLBACK_CHANNEL,
        text: `:phone: Retention Call - ${bufferAgentName} connected with ${customerName}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "📞 Retention Call - Agent Connected", emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Retention Agent:*\n${bufferAgentName || "N/A"}` },
              { type: "mrkdwn", text: `*Customer:*\n${customerName || "N/A"}` },
              { type: "mrkdwn", text: `*Lead Vendor:*\n${leadVendor || "N/A"}` },
              { type: "mrkdwn", text: `*Submission ID:*\n${submissionId || "N/A"}` },
            ],
          },
          ...(retentionDetailsText
            ? [{ type: "section", text: { type: "mrkdwn", text: retentionDetailsText } }]
            : []),
          {
            type: "section",
            text: { type: "mrkdwn", text: "*Use one of the actions below:*" },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "✅ Ready", emoji: true },
                style: "primary",
                url: resolvedLaReadyUrl,
                action_id: "la_ready_button",
              },
              {
                type: "button",
                text: { type: "plain_text", text: "📝 Update call result", emoji: true },
                url: resolvedUpdateCallResultUrl,
                action_id: "update_call_result_button",
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Ready opens the LA flow. Update call result opens the portal call update page.",
              },
            ],
          },
        ],
      };

      const slackResult = await postSlack(slackMessage);
      if (!slackResult.ok) {
        return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: "buffer_connected",
          messageTs: slackResult.ts,
          channel: BUFFER_CALLBACK_CHANNEL,
          notificationId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (type === "la_ready") {
      const slackText =
        `✅ *Licensed agent ready*\n` +
        `*LA:* ${licensedAgentName || "N/A"} | *Customer:* ${customerName || "N/A"}\n` +
        `*Vendor:* ${leadVendor || "N/A"} | *Submission:* ${submissionId || "N/A"}`;

      const slackMessage = {
        channel: BUFFER_CALLBACK_CHANNEL,
        text: slackText,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "Licensed agent ready", emoji: true },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Licensed Agent:*\n${licensedAgentName || "N/A"}` },
              { type: "mrkdwn", text: `*Customer:*\n${customerName || "N/A"}` },
              { type: "mrkdwn", text: `*Lead Vendor:*\n${leadVendor || "N/A"}` },
              { type: "mrkdwn", text: `*Submission ID:*\n${submissionId || "N/A"}` },
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Links:* <${resolvedLaReadyUrl}|Call result> · <${resolvedUpdateCallResultUrl}|Update call>`,
            },
          },
        ],
      };

      const slackResult = await postSlack(slackMessage);
      if (!slackResult.ok) {
        return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          type: "la_ready",
          messageTs: slackResult.ts,
          channel: BUFFER_CALLBACK_CHANNEL,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: false, message: `Unknown notification type: ${type}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

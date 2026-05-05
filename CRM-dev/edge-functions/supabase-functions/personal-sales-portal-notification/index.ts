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
    console.log("[DEBUG] personal-sales-portal-notification body:", rawBody);
    const { callResultData, verificationItems } = JSON.parse(rawBody);
    if (!SLACK_BOT_TOKEN) {
      console.error("[ERROR] SLACK_BOT_TOKEN not configured");
      throw new Error("SLACK_BOT_TOKEN not configured");
    }
    const licensedAgent = callResultData.licensed_agent_account;
    if (!licensedAgent || licensedAgent === "N/A") {
      console.log("[INFO] No licensed agent specified or N/A - skipping notes posting");
      return new Response(JSON.stringify({ success: true, message: "No licensed agent - notes not posted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const licensePortalMapping: Record<string, string> = {
      Lydia: "#sales-portal-lydia-sutton",
      Benjamin: "#sales-portal-ben-wunder",
      Isaac: "#sales-portal-isaac-reed",
      Claudia: "#sales-portal-tatumn-scott",
      Noah: "#sales-portal-zack-lesnar",
      Tatumn: "#sales-portal-tatumn-scott",
      Trinity: "#sales-portal-tatumn-scott",
    };
    const portalChannel = licensePortalMapping[licensedAgent];
    if (!portalChannel) {
      console.error(`[ERROR] No portal channel mapping for licensed agent: ${licensedAgent}`);
      return new Response(
        JSON.stringify({
          success: false,
          message: `No portal channel mapping for licensed agent: ${licensedAgent}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const verifiedItems = verificationItems?.filter((item: { is_verified?: boolean }) => item.is_verified) || [];
    if (verifiedItems.length === 0) {
      console.log("[INFO] No verified items found - skipping notes posting");
      return new Response(JSON.stringify({ success: true, message: "No verified items - notes not posted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const fieldValues: Record<string, string> = {};
    verifiedItems.forEach((item: { field_name: string; verified_value?: string; original_value?: string }) => {
      fieldValues[item.field_name] = item.verified_value || item.original_value || "N/A";
    });
    const clientInfo = [
      `customer_full_name:${fieldValues.customer_full_name || "N/A"}`,
      `Address: ${fieldValues.street_address || ""} ${fieldValues.city || ""}, ${fieldValues.state || ""} ${fieldValues.zip_code || ""}`,
      `Beneficiary Information: ${fieldValues.beneficiary_information || "N/A"}`,
      `Billing and mailing address is the same: (Y/N)`,
      `Date of Birth: ${fieldValues.date_of_birth || "N/A"}`,
      `Birth State: ${fieldValues.birth_state || "N/A"}`,
      `Age: ${fieldValues.age || "N/A"}`,
      `Number: ${fieldValues.phone_number || "N/A"}`,
      `Call phone/landline: ${fieldValues.call_phone_landline || ""}`,
      `Social: ${fieldValues.social_security || "N/A"}`,
    ].join("\n");
    const callResults = [
      `Customer Name: ${callResultData.customer_full_name || fieldValues.customer_full_name || "N/A"}`,
      `Status: ${callResultData.status || "N/A"}`,
      `Reason: ${callResultData.status_reason || "No specific reason provided"}`,
      `Notes: ${callResultData.notes || "No additional notes"}`,
    ].join("\n");
    const messageText = [
      `Notes Posted:`,
      ``,
      `Client Information:`,
      clientInfo,
      `---------------------------------------`,
      `Call Results:`,
      callResults,
      `---------------------------------------------------------------------------------------------------`,
    ].join("\n");
    const submissionId =
      callResultData.submission_id ?? callResultData.submissionId ?? "N/A";
    const slackMessage = {
      channel: portalChannel,
      text: messageText,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Notes Posted for ${licensedAgent}:*` },
        },
        {
          type: "section",
          text: { type: "plain_text", text: messageText },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Submission ID: ${submissionId} | Licensed Agent: ${licensedAgent}`,
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
      console.error("[ERROR] Slack API error:", slackResult);
      return new Response(JSON.stringify({ success: false, message: slackResult.error, debug: slackResult }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({
        success: true,
        messageTs: slackResult.ts,
        channel: portalChannel,
        licensedAgent,
        verifiedItemsCount: verifiedItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ERROR] personal-sales-portal-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        debug: String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

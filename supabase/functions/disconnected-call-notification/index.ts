import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || Deno.env.get("NEXT_PUBLIC_SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
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
      application_submitted: body.application_submitted,
      sent_to_underwriting: body.sent_to_underwriting,
      status: body.status,
      notes: body.notes,
      agent_who_took_call: body.agent,
      buffer_agent: body.buffer_agent,
      lead_vendor: body.lead_vendor,
      carrier: body.carrier,
      product_type: body.product_type,
      draft_date: body.draft_date,
      monthly_premium: body.monthly_premium,
      face_amount: body.face_amount,
    };

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const isUnderwriting =
      callResult &&
      callResult.application_submitted === true &&
      callResult.sent_to_underwriting === true;

    const isDisconnected =
      callResult &&
      (callResult.status === "Disconnected" || callResult.status === "Disconnected - Never Retransferred");

    const isDropped =
      callResult &&
      (callResult.status === "Call Never Sent" ||
        callResult.status === "Call Back Fix" ||
        callResult.status === "Call Dropped" ||
        (callResult.status === "Not Submitted" &&
          String(callResult.notes || "").toLowerCase().includes("dropped")));

    if (!isDisconnected && !isDropped && !isUnderwriting) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No notification sent - not a disconnected call, dropped call, or underwriting submission",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (isUnderwriting) {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Supabase credentials not configured");
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      let counter = 0;
      let mentionPerson = "Ben";
      const benSlackId = "U07ULU99VD4";
      const zeeSlackId = "U09AWBNGBQF";

      try {
        const { data: counterRow, error: getError } = await supabase
          .from("underwriting_mention_counter")
          .select("counter_value")
          .eq("id", 1)
          .single();

        if (getError) {
          const { count } = await supabase
            .from("call_results")
            .select("*", { count: "exact", head: true })
            .eq("application_submitted", true)
            .eq("sent_to_underwriting", true);
          counter = count || 0;
        } else {
          counter = counterRow?.counter_value || 0;
        }

        counter += 1;
        mentionPerson = counter % 2 === 1 ? "Ben" : "Zee";

        await supabase
          .from("underwriting_mention_counter")
          .upsert({ id: 1, counter_value: counter, updated_at: new Date().toISOString() });
      } catch {
        const { count } = await supabase
          .from("call_results")
          .select("*", { count: "exact", head: true })
          .eq("application_submitted", true)
          .eq("sent_to_underwriting", true);
        counter = (count || 0) + 1;
        mentionPerson = counter % 2 === 1 ? "Ben" : "Zee";
      }

      const mentionText = mentionPerson === "Ben" ? `<@${benSlackId}>` : `<@${zeeSlackId}>`;
      const customerName = leadData.customer_full_name || "Unknown Customer";
      const phoneNumber = leadData.phone_number || "No phone number";
      const email = leadData.email || "No email";
      const leadVendor = callResult?.lead_vendor || leadData?.lead_vendor || "N/A";

      const slackMessage = {
        channel: TEST_CHANNEL,
        text: `New submission sent to underwriting - ${customerName}`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: `📋 Submission Sent to Underwriting - ${customerName}` } },
          { type: "section", text: { type: "mrkdwn", text: `${mentionText} - New submission sent to underwriting from agent portal` } },
          { type: "section", text: { type: "mrkdwn", text: `*Customer:* ${customerName}\n*Phone:* ${phoneNumber}\n*Email:* ${email}` } },
          { type: "section", text: { type: "mrkdwn", text: `*Carrier:* ${callResult.carrier || "N/A"}\n*Product Type:* ${callResult.product_type || "N/A"}\n*Draft Date:* ${callResult.draft_date || "N/A"}` } },
          { type: "section", text: { type: "mrkdwn", text: `*Monthly Premium:* $${callResult.monthly_premium || "N/A"}\n*Coverage Amount:* $${callResult.face_amount || "N/A"}\n*Lead Vendor:* ${leadVendor}` } },
          { type: "section", text: { type: "mrkdwn", text: `*Agent:* ${callResult.agent_who_took_call || "N/A"}\n*Buffer Agent:* ${callResult.buffer_agent || "N/A"}` } },
          { type: "section", text: { type: "mrkdwn", text: `*Notes:*\n${callResult.notes || "No additional notes"}` } },
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
      if (!slackResult.ok) throw new Error(`Slack API error: ${slackResult.error}`);

      return new Response(
        JSON.stringify({
          success: true,
          messageTs: slackResult.ts,
          channel: TEST_CHANNEL,
          notificationType: "Underwriting Submission",
          mentionedPerson: mentionPerson,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const customerName = leadData.customer_full_name || "Unknown Customer";
    const statusText = callResult.status || "Disconnected";
    const notificationType = isDisconnected ? "Disconnected Call" : "Dropped Call";
    const statusEmoji = isDisconnected ? "❌" : "📞";

    const slackMessage = {
      channel: TEST_CHANNEL,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `${statusEmoji} ${notificationType} - ${customerName}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Customer:* ${customerName}\n*Phone:* ${leadData.phone_number || "No phone number"}\n*Email:* ${leadData.email || "No email"}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Status:* ${statusText}\n*Lead Vendor:* ${callResult?.lead_vendor || leadData?.lead_vendor || "N/A"}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Agent:* ${callResult.agent_who_took_call || "N/A"}\n*Buffer Agent:* ${callResult.buffer_agent || "N/A"}` } },
        { type: "section", text: { type: "mrkdwn", text: `*Notes:*\n${callResult.notes || "No additional notes"}` } },
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
    if (!slackResult.ok) throw new Error(`Slack API error: ${slackResult.error}`);

    return new Response(
      JSON.stringify({
        success: true,
        messageTs: slackResult.ts,
        channel: TEST_CHANNEL,
        notificationType,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

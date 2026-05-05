import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

const formatDateAmerican = (dateString: string | null | undefined): string => {
  if (!dateString || dateString === "N/A" || dateString.trim() === "") return "N/A";
  const trimmed = dateString.trim();
  const yyyymmddPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  if (yyyymmddPattern.test(trimmed)) {
    const [_, y, m, d] = trimmed.match(yyyymmddPattern)!;
    return `${m}/${d}/${y}`;
  }
  return trimmed;
};

async function postSlack(payload: Record<string, unknown>) {
  return await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  }).then(res => res.json());
}

async function getCenterInfo(supabaseClient: ReturnType<typeof createClient>, callCenterId?: string | null) {
  if (!callCenterId) return { name: null, slack_channel: null };

  const { data, error } = await supabaseClient
    .from("call_centers")
    .select("name, slack_channel")
    .eq("id", callCenterId)
    .maybeSingle();

  if (error) {
    console.error("Error looking up call_centers:", error.message);
    return { name: null, slack_channel: null };
  }

  return { name: data?.name || null, slack_channel: data?.slack_channel || null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { submissionId, leadData, callResult, callCenterId } = body;

    console.log("[center-notification] Received payload:", JSON.stringify(body, null, 2));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const centerInfo = await getCenterInfo(supabase, callCenterId);
    console.log("[center-notification] Center info:", centerInfo);

    const customerName = leadData?.customer_full_name || "Unknown Customer";
    const statusText = callResult?.status || "Not Submitted";
    const reasonText = callResult?.dq_reason || "No specific reason provided";
    const notesText = callResult?.notes || "No additional notes";
    const centerName = centerInfo.name || "N/A";
    const centerChannel = centerInfo.slack_channel || "#test-bpo";

    const normalizedStatus = String(statusText).trim().normalize("NFKC");
    const normalizedReason = String(reasonText).trim().normalize("NFKC");

    let statusEmoji = "⚠️";
    if (normalizedStatus.includes("DQ") || normalizedReason.includes("Chargeback DQ")) {
      statusEmoji = "🚫";
    } else if (normalizedStatus.toLowerCase().includes("callback")) {
      statusEmoji = "📞";
    } else if (normalizedStatus.toLowerCase().includes("not interested")) {
      statusEmoji = "🙅‍♂️";
    } else if (normalizedStatus.toLowerCase().includes("future")) {
      statusEmoji = "📅";
    } else if (normalizedStatus.toLowerCase().includes("submitted") || normalizedStatus.toLowerCase().includes("underwriting")) {
      statusEmoji = "✅";
    }

    const isSubmitted = callResult?.application_submitted === true;
    const sentToUnderwriting = callResult?.sent_to_underwriting === true;

    const results: Record<string, unknown>[] = [];

    if (isSubmitted) {
      // SUBMITTED: Send to global submission portal AND individual center channel
      const globalMessage = {
        channel: "#submission-portal",
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `✅ Application Submitted!${callResult?.buffer_agent || "N/A"} - ${callResult?.agent_who_took_call || "N/A"} - ${centerName} - ${customerName} - ${callResult?.carrier || "N/A"} - ${callResult?.product_type || "N/A"} - ${formatDateAmerican(callResult?.draft_date)} - $${callResult?.monthly_premium || "0"} - $${callResult?.face_amount || "0"} - ${sentToUnderwriting ? "Sent to Underwriting" : "Submitted"}`
            }
          }
        ]
      };

      const globalResult = await postSlack(globalMessage);
      console.log("[center-notification] Global channel result:", JSON.stringify(globalResult));
      results.push({ channel: "#submission-portal", result: globalResult });

      // Detailed message to center channel
      const detailedMessage = {
        channel: centerChannel,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "🚀 Application Submitted" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*${customerName}*\n\n` +
                `Carrier: ${callResult?.carrier || "N/A"}\n` +
                `Product Type: ${callResult?.product_type || "N/A"}\n` +
                `Draft Date: ${formatDateAmerican(callResult?.draft_date)}\n` +
                `Monthly Premium: $${callResult?.monthly_premium || "N/A"}\n` +
                `Coverage Amount: $${callResult?.face_amount || "N/A"}\n` +
                `Sent to Underwriting: ${sentToUnderwriting ? "Yes" : "No"}`,
            },
          },
        ],
      };

      const detailedResult = await postSlack(detailedMessage);
      console.log("[center-notification] Center channel result:", JSON.stringify(detailedResult));
      results.push({ channel: centerChannel, result: detailedResult });

    } else {
      // NOT SUBMITTED: Only send to individual center channel
      const notSubmittedMessage = {
        channel: centerChannel,
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
                text: `Center: ${centerName} | Agent: ${callResult?.agent_who_took_call || "N/A"} | Buffer: ${callResult?.buffer_agent || "N/A"} | Submission ID: ${submissionId || "N/A"}`,
              },
            ],
          },
        ],
      };

      const notSubmittedResult = await postSlack(notSubmittedMessage);
      console.log("[center-notification] Not submitted result:", JSON.stringify(notSubmittedResult));
      results.push({ channel: centerChannel, result: notSubmittedResult });
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        centerInfo,
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

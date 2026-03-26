/**
 * Supabase Edge Function name: `slack-notification`
 * Deploy: folder must be `supabase/functions/slack-notification/`
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

const formatDateAmerican = (dateString: string | null | undefined): string => {
  if (!dateString || dateString === "N/A" || dateString.trim() === "") {
    return "N/A";
  }

  const trimmed = dateString.trim();

  const yyyymmddPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  if (yyyymmddPattern.test(trimmed)) {
    const match = trimmed.match(yyyymmddPattern)!;
    const year = match[1];
    const month = match[2];
    const day = match[3];
    return `${month}/${day}/${year}`;
  }

  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  if (slashPattern.test(trimmed)) {
    const match = trimmed.match(slashPattern)!;
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    const year = match[3];

    if (first > 12 && second <= 12) {
      return `${second}/${first}/${year}`;
    }
    if (second > 12 && first <= 12) {
      return trimmed;
    }
    return trimmed;
  }

  return trimmed;
};

/** Lead vendor / BPO name → Slack channel (source of truth in this function). */
const leadVendorChannelMapping: Record<string, string> = {
  "Ark Tech": "#orbit-team-ark-tech",
  "GrowthOnics BPO": "#orbit-team-growthonics-bpo",
  Maverick: "#sample-center-transfer-channel",
  "Omnitalk BPO": "#orbit-team-omnitalk-bpo",
  "Vize BPO": "#orbit-team-vize-bpo",
  Corebiz: "#orbit-team-corebiz-bpo",
  Digicon: "#orbit-team-digicon-bpo",
  Ambition: "#orbit-team-ambition-bpo",
  "AJ BPO": "#orbit-team-aj-bpo",
  "Pro Solutions BPO": "#orbit-team-pro-solutions-bpo",
  "Emperor BPO": "#orbit-team-emperor-bpo",
  Benchmark: "#orbit-team-benchmark-bpo",
  Poshenee: "#orbit-team-poshenee-tech-bpo",
  Plexi: "#orbit-team-plexi-bpo",
  Gigabite: "#orbit-team-gigabite-bpo",
  "Everline solution": "#orbit-team-everline-bpo",
  "Progressive BPO": "#orbit-team-progressive-bpo",
  "Cerberus BPO": "#orbit-team-cerberus-bpo",
  NanoTech: "#orbit-team-nanotech-bpo",
  "Optimum BPO": "#orbit-team-optimum-bpo",
  "Ethos BPO": "#orbit-team-ethos-bpo",
  "Trust Link": "#orbit-team-trust-link",
  "Quotes BPO": "#obit-team-quotes-bpo",
  "Zupax Marketing": "#orbit-team-zupax-marketing",
  "Argon Comm": "#orbit-team-argon-comm",
  "Care Solutions": "#unlimited-team-care-solutions",
  "Cutting Edge": "#unlimited-team-cutting-edge",
  "Next Era": "#unlimited-team-next-era",
  "Rock BPO": "#orbit-team-rock-bpo",
  "Avenue Consultancy": "#orbit-team-avenue-consultancy",
  "Crown Connect BPO": "#orbit-team-crown-connect-bpo",
  Networkize: "#orbit-team-networkize",
  "LightVerse BPO": "#orbit-team-lightverse-bpo",
  "Leads BPO": "#orbit-team-leads-bpo",
  "Helix BPO": "#orbit-team-helix-bpo",
  CrossNotch: "#orbit-team-crossnotch",
  TechPlanet: "#orbit-team-techplanet",
  "Exito BPO": "#orbit-team-exito-bpo",
  "StratiX BPO": "#orbit-team-stratix-bpo",
  "Lumenix BPO": "#orbit-team-lumenix-bpo",
  "All-Star BPO": "#orbit-team-allstar-bpo",
  "DownTown BPO": "#orbit-team-downtown-bpo",
  "Livik BPO": "#orbit-team-livik-bpo",
  "NexGen BPO": "#orbit-team-nexgen-bpo",
  "Quoted-Leads BPO": "#orbit-team-quotedleads-bpo",
  "SellerZ BPO": "#orbit-team-sellerz-bpo",
  "Venom BPO": "#orbit-team-venom-bpo",
  WinBPO: "#orbit-team-win-bpo",
  "Techvated Marketing": "#orbit-team-techvated-marketing",
  "Core Marketing": "#orbit-team-core-marketing",
  "Everest BPO": "#orbit-team-everest-bpo",
  "Riztech BPO": "#orbit-team-riztech-bpo",
  "Tekelec BPO": "#orbit-team-tekelec-bpo",
  "Alternative BPO": "#orbit-team-alternative-bpo",
  "Broker Leads BPO": "#orbit-team-broker-leads-bpo",
  "Hexa Affiliates": "#orbit-team-hexa-affiliates",
  "Unified Systems BPO": "#orbit-team-unified-systems-bpo",
  "Lavish BPO": "#orbit-team-lavish-bpo",
  "Winners Limited": "#orbit-team-winners-limited",
  "Futures BPO": "#orbit-team-futures-bpo",
  "Redeemer BPO": "#orbit-team-redeemer-bpo",
  "Libra V2": "#orbit-team-libra",
  "Ascendra BPO": "#orbit-team-ascendra-bpo",
  "INB BPO": "#orbit-team-inb-bpo",
  "JoLu Solutions": "#orbit-team-jolu-solutions",
  "Jason BPO": "#orbit-team-jason-bpo",
};

async function postSlack(payload: Record<string, unknown>): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return (await slackResponse.json()) as { ok: boolean; ts?: string; error?: string };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const body = (await req.json()) as {
      submissionId?: string;
      leadData?: Record<string, unknown>;
      callResult?: Record<string, unknown>;
      event?: string;
      callCenterName?: string;
      channel?: string;
      /** BPO / lead vendor name — keys in `leadVendorChannelMapping` (same as submitted-application flow). */
      lead_vendor?: string;
    };

    const { submissionId, leadData, callResult, event, callCenterName } = body;
    const leadVendorForTransfer = String(body.lead_vendor ?? "").trim();
    const channelOverride = String(body.channel ?? "").trim();

    // Transfer Portal: hardcoded test channel for transfer uploads.
    if (event === "transfer_portal_lead_created" && leadData) {
      const customerName = String(leadData.customer_full_name ?? "N/A");
      const carrier = String(leadData.carrier ?? "N/A");
      const productType = String(leadData.product_type ?? "N/A");
      const draftDate = formatDateAmerican(leadData.draft_date as string | undefined);
      const monthly = leadData.monthly_premium ?? "N/A";
      const face = leadData.coverage_amount ?? "N/A";
      const phone = String(leadData.phone ?? "N/A");
      const leadUniqueId = String(leadData.lead_unique_id ?? "").trim();
      const center = (callCenterName || "").trim();

      const mainMessage = {
        channel: "#test-bpo",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "📥 New Transfer Portal Lead" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*${customerName}* — ${carrier} — ${productType}\n` +
                `Draft: ${draftDate} | Premium: $${monthly} | Coverage: $${face}\n` +
                `Phone: ${phone}\n` +
                `Lead ID: ${leadUniqueId || "N/A"}\n` +
                `Submission ID: ${submissionId ?? "N/A"}\n` +
                `Lead vendor: ${leadVendorForTransfer || "N/A"}\n` +
                `Call center: ${center || "N/A"}`,
            },
          },
        ],
      };

      let slackResult = await postSlack(mainMessage);
      if (!slackResult.ok) {
        console.error("Slack main (transfer portal):", slackResult.error);
        if (slackResult.error !== "channel_not_found") {
          throw new Error(`Slack API error: ${slackResult.error}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageTs: slackResult?.ts,
          mainChannelSuccess: slackResult?.ok || false,
          vendorChannel: "#test-bpo",
          event: "transfer_portal_lead_created",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Original: submitted application (call center flow)
    const isSubmittedApplication = callResult && callResult.application_submitted === true;
    let slackMessage: Record<string, unknown> | undefined;

    if (isSubmittedApplication) {
      let finalStatus = String(callResult!.status || "Submitted");
      if (callResult!.application_submitted === true) {
        finalStatus = callResult!.sent_to_underwriting === true ? "Underwriting" : "Submitted";
      }
      const statusDisplay = finalStatus === "Underwriting" ? "Sent to Underwriting" : finalStatus;

      slackMessage = {
        channel: channelOverride || "#submission-portal",
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: "✅ Application Submitted!" },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                `*${callResult!.buffer_agent || "N/A"}* - *${callResult!.agent_who_took_call || "N/A"}* - *${callResult!.lead_vendor || "N/A"}* - *${(leadData as { customer_full_name?: string })?.customer_full_name || "N/A"}* - *${callResult!.carrier || "N/A"}* - *${callResult!.product_type || "N/A"}* - *${formatDateAmerican(callResult!.draft_date as string)}* - *$${callResult!.monthly_premium || "N/A"}* - *$${callResult!.face_amount || "N/A"}* - *${statusDisplay}*`,
            },
          },
        ],
      };
    } else {
      console.log("Skipping notification - only submitted applications trigger Slack messages (legacy path)");
    }

    let slackResult: { ok: boolean; ts?: string; error?: string } = { ok: false };

    if (slackMessage) {
      slackResult = await postSlack(slackMessage);
      console.log("Slack API Response:", JSON.stringify(slackResult, null, 2));
      if (!slackResult.ok) {
        console.error(`Slack API error: ${slackResult.error}`);
        if (slackResult.error === "channel_not_found") {
          console.log("Channel not found, skipping main notification");
        } else {
          throw new Error(`Slack API error: ${slackResult.error}`);
        }
      } else {
        console.log("Slack message sent successfully");
      }
    }

    console.log("Debug - callResult data:", JSON.stringify(callResult, null, 2));
    console.log("Debug - isSubmittedApplication:", isSubmittedApplication);
    console.log("Debug - callResult.lead_vendor:", callResult?.lead_vendor);

    if (!channelOverride && isSubmittedApplication && callResult!.lead_vendor) {
      const vendorChannel = leadVendorChannelMapping[String(callResult!.lead_vendor)];
      console.log(`Debug - Looking for vendor: "${callResult!.lead_vendor}"`);
      console.log(`Debug - Found channel: ${vendorChannel}`);
      if (vendorChannel) {
        const sentToUnderwriting = callResult!.sent_to_underwriting === true ? "Yes" : "No";
        const vendorSlackMessage = {
          channel: vendorChannel,
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "✅ Application Submitted!" },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  `*${(leadData as { customer_full_name?: string })?.customer_full_name || "N/A"}*\n\n` +
                  `Carrier: ${callResult!.carrier || "N/A"}\n` +
                  `Product Type: ${callResult!.product_type || "N/A"}\n` +
                  `Draft Date: ${formatDateAmerican(callResult!.draft_date as string)}\n` +
                  `Monthly Premium: $${callResult!.monthly_premium || "N/A"}\n` +
                  `Coverage Amount: $${callResult!.face_amount || "N/A"}\n` +
                  `Sent to Underwriting: ${sentToUnderwriting}`,
              },
            },
          ],
        };
        try {
          const vendorSlackResult = await postSlack(vendorSlackMessage);
          console.log(`Vendor Slack API Response for ${vendorChannel}:`, JSON.stringify(vendorSlackResult, null, 2));
          if (vendorSlackResult.ok) {
            console.log(`Vendor notification sent to ${vendorChannel} successfully`);
          } else {
            console.error(`Failed to send vendor notification to ${vendorChannel}: ${vendorSlackResult.error}`);
            if (vendorSlackResult.error === "channel_not_found") {
              console.log(`Channel ${vendorChannel} not found, vendor may need to create it or invite the bot`);
            }
          }
        } catch (vendorError) {
          console.error(`Error sending vendor notification to ${vendorChannel}:`, vendorError);
        }
      } else {
        console.log(`No channel mapping found for lead vendor: "${callResult!.lead_vendor}"`);
      }
    } else {
      console.log("Debug - Vendor notification not sent because:");
      console.log(`  - isSubmittedApplication: ${isSubmittedApplication}`);
      console.log(`  - callResult.lead_vendor exists: ${!!callResult?.lead_vendor}`);
      console.log(`  - callResult.lead_vendor value: "${callResult?.lead_vendor}"`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageTs: slackResult?.ts,
        mainChannelSuccess: slackResult?.ok || false,
        vendorNotificationAttempted: !channelOverride && isSubmittedApplication && !!callResult?.lead_vendor,
        vendorChannel: !channelOverride && isSubmittedApplication && callResult?.lead_vendor
          ? leadVendorChannelMapping[String(callResult.lead_vendor)]
          : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in slack-notification:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

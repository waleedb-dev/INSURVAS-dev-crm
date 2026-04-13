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
    const { type, submissionId, leadData, bufferAgentName, licensedAgentName, agentName } = JSON.parse(
      rawBody,
    );
    if (!SLACK_BOT_TOKEN) {
      console.error("[ERROR] SLACK_BOT_TOKEN not configured");
      throw new Error("SLACK_BOT_TOKEN not configured");
    }
    const leadVendorCenterMapping: Record<string, string> = {
      "Ark Tech": "#orbit-team-ark-tech",
      "Lumenix BPO": "#orbit-team-lumenix-bpo",
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
      "Lavish BPO": "#orbit-team-lavish-bpo",
      Gigabite: "#orbit-team-gigabite-bpo",
      "Everline solution": "#orbit-team-everline-bpo",
      "Cerberus BPO": "#orbit-team-cerberus-bpo",
      NanoTech: "#orbit-team-nanotech-bpo",
      "Optimum BPO": "#orbit-team-optimum-bpo",
      "Ethos BPO": "#orbit-team-ethos-bpo",
      "Trust Link": "#orbit-team-trust-link",
      "Quotes BPO": "#orbit-team-quotes-bpo",
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
      "Exito BPO": "#orbit-team-exito-bpo",
      TechPlanet: "#orbit-team-techplanet",
      CrossNotch: "#orbit-team-crossnotch",
      "StratiX BPO": "#orbit-team-stratix-bpo",
      "All-Star BPO": "#orbit-team-allstar-bpo",
      "DownTown BPO": "#orbit-team-downtown-bpo",
      "Livik BPO": "#orbit-team-livik-bpo",
      "NexGen BPO": "#orbit-team-nexgen-bpo",
      "Quoted-Leads BPO": "#orbit-team-quotedleads-bpo",
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
      "Winners Limited": "#orbit-team-winners-limited",
      "Futures BPO": "#orbit-team-futures-bpo",
      "Redeemer BPO": "#orbit-team-redeemer-bpo",
      "Libra V2": "#orbit-team-libra",
      "Ascendra BPO": "#orbit-team-ascendra-bpo",
      "INB BPO": "#orbit-team-inb-bpo",
      "JoLu Solutions": "#orbit-team-jolu-solutions",
      "Jason BPO": "#orbit-team-jason-bpo",
      MBG: "#orbit-team-mbg",
      "Progressive BPO": "#orbit-team-progressive-bpo",
      "NextPoint BPO": "#orbit-team-nextpoint-bpo",
      "Sellerz BPO": "#orbit-team-sellerz-bpo",
    };
    const leadVendor = leadData?.lead_vendor;
    if (!leadVendor) {
      console.error("[ERROR] No lead vendor specified in payload:", leadData);
      return new Response(JSON.stringify({ success: false, message: "No lead vendor specified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const centerChannel = leadVendorCenterMapping[leadVendor];
    if (!centerChannel) {
      console.error(`[ERROR] No center channel mapping for vendor: ${leadVendor}`);
      return new Response(
        JSON.stringify({ success: false, message: `No center channel mapping for vendor: ${leadVendor}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let slackText = "";
    if (type === "call_dropped") {
      slackText = `:red_circle: Call with *${leadData.customer_full_name || "Unknown Customer"}* dropped. Need to reconnect.`;
    } else if (type === "transfer_to_la") {
      slackText = `:arrow_right: *${bufferAgentName || "Buffer Agent"}* has transferred *${
        leadData.customer_full_name || "Unknown Customer"
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
          elements: [{ type: "mrkdwn", text: `Submission ID: ${submissionId}` }],
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
      JSON.stringify({ success: true, messageTs: slackResult.ts, channel: centerChannel, debug: slackResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
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

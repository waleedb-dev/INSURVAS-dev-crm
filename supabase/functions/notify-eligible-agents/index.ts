/**
 * Edge function: `notify-eligible-agents`
 * Finds eligible agents (RPC), posts Slack to center channel.
 * Temporary: all Slack notifications go to #bpo_test (SLACK_CHANNEL_OVERRIDE).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

/** Temporary: route all Slack posts here. Restore per-vendor mapping when leaving test mode. */
const SLACK_CHANNEL_OVERRIDE = "#bpo_test";

type AgentRow = {
  agent_name: string;
  upline_name?: string | null;
  upline_required?: boolean | null;
};

type AgentSlackInfo = {
  slackId: string;
  displayName: string;
  speaksSpanish?: boolean;
};

const agentSlackIdMapping: Record<string, AgentSlackInfo> = {
  Abdul: {
    slackId: "U07ULU99VD4",
    displayName: "Benjamin Wunder - Sales Manager",
  },
  Benjamin: {
    slackId: "U07ULU99VD4",
    displayName: "Benjamin Wunder - Sales Manager",
  },
  Zack: {
    slackId: "U09AWBNGBQF",
    displayName: "Zack Lesnar - Insurance Agent",
  },
  Lydia: {
    slackId: "U08216BSGE4",
    displayName: "Lydia Sutton - Insurance Agent",
  },
  Tatumn: {
    slackId: "U09FKU50KFT",
    displayName: "Tatumn - Insurance Agent",
    speaksSpanish: true,
  },
  Isaac: {
    slackId: "U099W0RKYDB",
    displayName: "Isaac Reed - Insurance Agent",
  },
  "Brandon Blake Flinchum": {
    slackId: "U0A4HAT5GN6",
    displayName: "Brandon Flinchum - Insurance Agent",
  },
  Brandon: {
    slackId: "U0A4HAT5GN6",
    displayName: "Brandon Flinchum - Insurance Agent",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("[DEBUG] Notify eligible agents request:", rawBody);

    const { carrier, state, lead_vendor, language = "English" } = JSON.parse(rawBody);
    const isSpanishLead = String(language).toLowerCase() === "spanish";

    if (!SLACK_BOT_TOKEN) {
      console.error("[ERROR] SLACK_BOT_TOKEN not configured");
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    if (!carrier || !state || !lead_vendor) {
      console.error("[ERROR] Missing required fields: carrier, state, or lead_vendor");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields: carrier, state, or lead_vendor",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const centerChannel = SLACK_CHANNEL_OVERRIDE;

    console.log(`[DEBUG] Fetching eligible agents for carrier: ${carrier}, state: ${state}`);
    let eligibleAgents: AgentRow[] | null;
    let agentsError: { message: string } | null;

    if (carrier.toLowerCase() === "aetna") {
      console.log("[DEBUG] Using Aetna-specific eligibility function");
      const result = await supabase.rpc("get_eligible_agents_for_aetna", {
        p_state_name: state,
      });
      eligibleAgents = result.data as AgentRow[] | null;
      agentsError = result.error;
    } else {
      const result = await supabase.rpc("get_eligible_agents_with_upline_check", {
        p_carrier_name: carrier,
        p_state_name: state,
      });
      eligibleAgents = result.data as AgentRow[] | null;
      agentsError = result.error;
    }

    if (agentsError) {
      console.error("[ERROR] Failed to fetch eligible agents:", agentsError);
      throw new Error(`Failed to fetch eligible agents: ${agentsError.message}`);
    }

    let agents = eligibleAgents;
    if (isSpanishLead && agents) {
      console.log("[DEBUG] Applying Spanish language filter");
      agents = agents.filter((agent) => {
        const agentInfo = agentSlackIdMapping[agent.agent_name];
        return agentInfo && agentInfo.speaksSpanish === true;
      });
      if (agents.length > 1) {
        agents = [agents[0]];
      }
    }

    if (lead_vendor === "Techvated Marketing" && agents) {
      console.log("[DEBUG] Applying Techvated Marketing exception filter");
      agents = agents.filter((agent) => {
        const agentInfo = agentSlackIdMapping[agent.agent_name];
        if (agentInfo && agentInfo.slackId === "U08216BSGE4") {
          console.log(`[DEBUG] Excluding agent ${agent.agent_name} (Lydia) from Techvated Marketing`);
          return false;
        }
        return true;
      });
    }

    eligibleAgents = agents;
    console.log(
      `[DEBUG] Found ${eligibleAgents?.length || 0} eligible agents (after filters):`,
      eligibleAgents,
    );

    const hasOverrideState =
      eligibleAgents && eligibleAgents.length > 0 && eligibleAgents[0]?.upline_required;

    if (!eligibleAgents || eligibleAgents.length === 0) {
      const noAgentsText = `🚨 *New ${isSpanishLead ? "🇪🇸 SPANISH " : ""}Lead Available* - No eligible agents found for ${carrier} in ${state}`;

      const noAgentsMessage = {
        channel: centerChannel,
        text: noAgentsText,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `🚨 New ${isSpanishLead ? "Spanish " : ""}Lead Available`,
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Call Center:*\n${lead_vendor}` },
              { type: "mrkdwn", text: `*Carrier:*\n${carrier}` },
              { type: "mrkdwn", text: `*State:*\n${state}` },
              ...(isSpanishLead ? [{ type: "mrkdwn", text: `*Language:*\nSpanish 🇪🇸` }] : []),
            ],
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "⚠️ *No eligible agents found for this carrier/state/language combination*",
            },
          },
        ],
      };

      const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(noAgentsMessage),
      });
      const slackResult = await slackResponse.json();
      console.log("[DEBUG] Slack API response (no agents):", slackResult);

      return new Response(
        JSON.stringify({
          success: true,
          eligible_agents_count: 0,
          message: "No eligible agents found (after checks), notification sent",
          channel: centerChannel,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sortedAgents = [...eligibleAgents].sort((a, b) => {
      const aInfo = agentSlackIdMapping[a.agent_name];
      const bInfo = agentSlackIdMapping[b.agent_name];
      if (aInfo && bInfo) {
        const aIsSalesManager = aInfo.displayName.includes("Sales Manager");
        const bIsSalesManager = bInfo.displayName.includes("Sales Manager");
        if (aIsSalesManager && !bIsSalesManager) return 1;
        if (!aIsSalesManager && bIsSalesManager) return -1;
      }
      return a.agent_name.localeCompare(b.agent_name);
    });

    const excludedAgents = ["Ben", "Coleman", "Aidan Coleman"];
    const filteredAgents = sortedAgents.filter((agent) => {
      const agentName = agent.agent_name?.toLowerCase() || "";
      const isExcluded = excludedAgents.some((excluded) =>
        agentName.includes(excluded.toLowerCase()),
      );
      return !isExcluded;
    });

    const seenSlackIds = new Set<string>();
    const uniqueAgents = filteredAgents.filter((agent) => {
      const agentInfo = agentSlackIdMapping[agent.agent_name];
      if (agentInfo) {
        if (seenSlackIds.has(agentInfo.slackId)) return false;
        seenSlackIds.add(agentInfo.slackId);
        return true;
      }
      return true;
    });

    const agentMentions = uniqueAgents
      .map((agent) => {
        const agentInfo = agentSlackIdMapping[agent.agent_name];
        if (agentInfo) {
          if (carrier.toLowerCase() === "aetna" && agentInfo.slackId === "U0A4HAT5GN6") {
            return `• <@${agentInfo.slackId}> (Will submit with Aflac)`;
          }
          return `• <@${agentInfo.slackId}>`;
        }
        return `• ${agent.agent_name}`;
      })
      .join("\n");

    const slackText = `🔔 *New ${isSpanishLead ? "🇪🇸 SPANISH " : ""}Lead Available for ${carrier} in ${state}*`;
    const messageBlocks: Record<string, unknown>[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `🔔 New ${isSpanishLead ? "Spanish " : ""}Lead Available`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Call Center:*\n${lead_vendor}` },
          { type: "mrkdwn", text: `*Carrier:*\n${carrier}` },
          { type: "mrkdwn", text: `*State:*\n${state}` },
          ...(isSpanishLead ? [{ type: "mrkdwn", text: `*Language:*\nSpanish 🇪🇸` }] : []),
        ],
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Agent${isSpanishLead ? " (Spanish Speaker)" : "s"} who can take this call:*\n${agentMentions}`,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `${uniqueAgents.length} eligible agent(s)`,
          },
        ],
      },
    ];

    const slackMessage = {
      channel: centerChannel,
      text: slackText,
      blocks: messageBlocks,
    };

    console.log("[DEBUG] Slack message payload:", JSON.stringify(slackMessage, null, 2));
    const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    const slackResult = await slackResponse.json();
    console.log("[DEBUG] Slack API response:", slackResult);
    if (!slackResult.ok) {
      console.error("[ERROR] Slack API error:", slackResult);
      return new Response(
        JSON.stringify({
          success: false,
          message: slackResult.error,
          debug: slackResult,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        eligible_agents_count: eligibleAgents.length,
        eligible_agents: eligibleAgents.map((a) => ({
          name: a.agent_name,
          upline: a.upline_name,
          upline_required: a.upline_required,
        })),
        override_state: hasOverrideState,
        messageTs: slackResult.ts,
        channel: centerChannel,
        debug: slackResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[ERROR] Exception in notify-eligible-agents:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        debug: String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

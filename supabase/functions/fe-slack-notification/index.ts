/**
 * Edge function: `fe-slack-notification`
 * Posts to Slack via chat.postMessage.
 * Temporary: all messages route to SLACK_CHANNEL_OVERRIDE (#bpo_test) for testing.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

/** Temporary: route all Slack posts here (remove override when going to prod channels). */
const SLACK_CHANNEL_OVERRIDE = "#bpo_test";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, blocks } = await req.json();

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    if (!message) {
      throw new Error("Missing message");
    }

    const channel = SLACK_CHANNEL_OVERRIDE;

    const slackMessage: Record<string, unknown> = {
      channel,
      text: message,
    };

    if (blocks) {
      slackMessage.blocks = blocks;
    }

    const slackResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(slackMessage),
    });

    const slackResult = await slackResponse.json();
    console.log("Slack API Response:", JSON.stringify(slackResult, null, 2));

    if (!slackResult.ok) {
      console.error(`Slack API error: ${slackResult.error}`);

      if (slackResult.error === "channel_not_found") {
        return new Response(
          JSON.stringify({
            success: false,
            message: `Channel ${channel} not found`,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      throw new Error(`Slack API error: ${slackResult.error}`);
    }

    console.log("Slack message sent successfully");

    return new Response(
      JSON.stringify({
        success: true,
        channel,
        messageTs: slackResult.ts,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in fe-slack-notification:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

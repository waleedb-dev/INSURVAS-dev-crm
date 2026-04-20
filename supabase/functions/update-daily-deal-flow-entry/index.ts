import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const NOTIFY_ELIGIBLE_AGENTS_ENDPOINT =
  Deno.env.get("NOTIFY_ELIGIBLE_AGENTS_URL") ||
  "https://gqhcjqxcvhgwsqfqgekh.supabase.co/functions/v1/notify-eligible-agents";
const NOTIFY_ELIGIBLE_AGENTS_BEARER_TOKEN =
  Deno.env.get("NOTIFY_ELIGIBLE_AGENTS_ANON_KEY") ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxaGNqcXhjdmhnd3NxZnFnZWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNjAyNjEsImV4cCI6MjA2NzkzNjI2MX0.s4nuUN7hw_XCltM-XY3jC9o0og3froDRq_i80UCQ-rA";

/** Calendar date `YYYY-MM-DD` in US Eastern (same as browser `getTodayInEasternYyyyMmDd` / `daily-deal-flow/helpers`). */
const getTodayDateEST = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

/** Store `updated_at` as actual UTC (timestamptz); Eastern calendar date uses `getTodayDateEST` only. */
const getCurrentTimestampEST = () => new Date().toISOString();

const generateCallbackSubmissionId = (originalSubmissionId: string) => {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `CB${randomDigits}${originalSubmissionId}`;
};

const mapStatusToSheetValue = (userSelectedStatus?: string) => {
  const statusMap: Record<string, string> = {
    "Needs callback": "Needs BPO Callback",
    "Call Never Sent": "Incomplete Transfer",
    "Not Interested": "Returned To Center - DQ",
    DQ: "DQ'd Can't be sold",
    "⁠DQ": "DQ'd Can't be sold",
    "Future Submission Date": "Application Withdrawn",
    Disconnected: "Incomplete Transfer",
    "Disconnected - Never Retransferred": "Incomplete Transfer",
    "Fulfilled carrier requirements": "Fulfilled carrier requirements",
    "Updated Banking/draft date": "Pending Failed Payment Fix",
    "Chargeback DQ": "Chargeback DQ",
  };
  const cleanStatus = userSelectedStatus?.trim().replace(/⁠/g, "");
  return statusMap[cleanStatus || ""] || statusMap[userSelectedStatus || ""] || userSelectedStatus || "Not Submitted";
};

const determineFinalStatus = (
  applicationSubmitted: boolean | null,
  sentToUnderwriting: boolean | null,
  originalStatus?: string,
) => {
  if (applicationSubmitted === true) return "Pending Approval";
  return originalStatus || "Not Submitted";
};

const determineCallResultStatus = (
  applicationSubmitted: boolean | null,
  sentToUnderwriting: boolean | null,
  originalCallResult?: string,
) => {
  if (applicationSubmitted === true) {
    return sentToUnderwriting === true ? "Underwriting" : "Submitted";
  }
  return originalCallResult || "Not Submitted";
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const incomingAuthHeader = req.headers.get("Authorization") ?? "";
    const invokeHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (incomingAuthHeader) {
      invokeHeaders.Authorization = incomingAuthHeader;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json();
    const {
      submission_id,
      call_source,
      buffer_agent,
      retention_agent,
      agent,
      licensed_agent_account,
      status,
      call_result,
      carrier,
      product_type,
      draft_date,
      monthly_premium,
      face_amount,
      notes,
      policy_number,
      carrier_audit,
      product_type_carrier,
      level_or_gi,
      from_callback,
      is_callback = false,
      application_submitted = null,
      sent_to_underwriting = null,
      lead_vendor,
      insured_name,
      client_phone_number,
      is_retention_call = false,
      dq_reason = null,
      new_draft_date = null,
      disposition_path = null,
      generated_note = null,
      manual_note = null,
      quick_disposition_tag = null,
    } = body;

    if (!submission_id) throw new Error("Missing required field: submission_id");
    if (!call_source) throw new Error("Missing required field: call_source");

    const todayDate = getTodayDateEST();
    const { data: leadData } = await supabase
      .from("leads")
      .select("first_name, last_name, phone, email, state, call_center_id, call_centers(name)")
      .eq("submission_id", submission_id)
      .maybeSingle();

    const resolvedInsuredName =
      `${String(leadData?.first_name || "").trim()} ${String(leadData?.last_name || "").trim()}`.trim() ||
      insured_name ||
      null;
    const resolvedPhone = leadData?.phone ?? client_phone_number ?? null;

    const centerName = leadData?.call_centers?.name ?? null;
    let slackChannel = "#test-bpo";
    if (centerName) {
      const { data: centerData } = await supabase
        .from("call_centers")
        .select("slack_channel")
        .ilike("name", centerName)
        .maybeSingle();
      if (centerData?.slack_channel) {
        slackChannel = centerData.slack_channel;
      }
    }

    const finalStatus = determineFinalStatus(application_submitted, sent_to_underwriting, status);
    const callResultStatus = call_result || determineCallResultStatus(
      application_submitted,
      sent_to_underwriting,
      status,
    );

    let finalSubmissionId = submission_id as string;
    let operation = "inserted";
    let savedRecord: unknown = null;

    if (call_source === "First Time Transfer") {
      // If a callback row for this base submission already exists today, reuse it and update in-place.
      const { data: existingCallbackToday } = await supabase
        .from("daily_deal_flow")
        .select("submission_id")
        .eq("date", todayDate)
        .like("submission_id", `CB%${submission_id}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingCallbackToday?.submission_id) {
        finalSubmissionId = existingCallbackToday.submission_id;
      } else {
      const { data: latestEntry } = await supabase
        .from("daily_deal_flow")
        .select("id, date")
        .eq("submission_id", submission_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const shouldCreateCallback = !!(latestEntry?.date && latestEntry.date !== todayDate);
      finalSubmissionId = shouldCreateCallback ? generateCallbackSubmissionId(submission_id) : submission_id;
      }
    }

    const { data: existingTodayEntry } = await supabase
      .from("daily_deal_flow")
      .select("id, lead_vendor, call_center_id")
      .eq("submission_id", finalSubmissionId)
      .eq("date", todayDate)
      .maybeSingle();

    const resolvedCallCenterId = leadData?.call_center_id ?? existingTodayEntry?.call_center_id ?? null;
    const resolvedLeadVendor =
      leadData?.call_centers?.name ??
      existingTodayEntry?.lead_vendor ??
      null;

    const dailyFlowPayload = {
      submission_id: finalSubmissionId,
      lead_vendor: resolvedLeadVendor,
      call_center_id: resolvedCallCenterId,
      insured_name: resolvedInsuredName,
      client_phone_number: resolvedPhone,
      date: todayDate,
      buffer_agent,
      retention_agent,
      agent,
      licensed_agent_account,
      status: finalStatus,
      call_result: callResultStatus,
      carrier,
      product_type,
      draft_date,
      monthly_premium,
      face_amount,
      notes,
      from_callback,
      is_callback,
      is_retention_call,
      updated_at: getCurrentTimestampEST(),
    };

    if (existingTodayEntry?.id) {
      const { data, error } = await supabase
        .from("daily_deal_flow")
        .update(dailyFlowPayload)
        .eq("id", existingTodayEntry.id)
        .select()
        .single();
      if (error) throw new Error(`Failed to update entry: ${error.message}`);
      operation = "updated";
      savedRecord = data;
    } else {
      const { data, error } = await supabase
        .from("daily_deal_flow")
        .insert(dailyFlowPayload)
        .select()
        .single();
      if (error) throw new Error(`Failed to create entry: ${error.message}`);
      operation = "inserted";
      savedRecord = data;
    }

    try {
      await supabase
        .from("verification_sessions")
        .update({ status: "completed" })
        .eq("submission_id", submission_id)
        .in("status", ["pending", "in_progress", "ready_for_transfer", "transferred"]);
    } catch (sessionError) {
      console.error("Verification session update failed:", sessionError);
    }

    if (application_submitted === true) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-notification`, {
          method: "POST",
          headers: invokeHeaders,
          body: JSON.stringify({
            leadData: {
              customer_full_name: resolvedInsuredName,
              phone: resolvedPhone,
            },
            callResult: {
              application_submitted,
              sent_to_underwriting,
              carrier,
              product_type,
              draft_date,
              monthly_premium,
              face_amount,
            },
            channel: slackChannel,
            channelOverride: "#submission-portal",
          }),
        });
      } catch (slackError) {
        console.error("Slack notification error:", slackError);
      }
    }

    // Keep draft-edit flow aligned with first-time create flow:
    // notify eligible agents when we have carrier/state/vendor context.
    if (application_submitted === true && carrier && leadData?.state && resolvedLeadVendor) {
      try {
        const notifyResponse = await fetch(NOTIFY_ELIGIBLE_AGENTS_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${NOTIFY_ELIGIBLE_AGENTS_BEARER_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            carrier,
            state: leadData.state,
            lead_vendor: resolvedLeadVendor,
            language: "English",
          }),
        });
        if (!notifyResponse.ok) {
          const responseText = await notifyResponse.text();
          console.error("Notify eligible agents error:", responseText || `HTTP ${notifyResponse.status}`);
        }
      } catch (notifyEligibleError) {
        console.error("Notify eligible agents error:", notifyEligibleError);
      }
    }

    if (application_submitted === false) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/center-notification`, {
          method: "POST",
          headers: invokeHeaders,
          body: JSON.stringify({
            submissionId: finalSubmissionId,
            leadData: {
              customer_full_name: resolvedInsuredName,
              phone_number: resolvedPhone,
              email: leadData?.email,
              lead_vendor: resolvedLeadVendor,
            },
            callResult: {
              status: finalStatus,
              dq_reason: dq_reason ?? null,
              notes,
              lead_vendor: resolvedLeadVendor,
              agent_who_took_call: agent,
              buffer_agent,
              call_source,
            },
          }),
        });
      } catch (centerError) {
        console.error("Center notification error:", centerError);
      }
    }

    if (
      application_submitted === false &&
      (status === "Disconnected" || status === "Disconnected - Never Retransferred")
    ) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/disconnected-call-notification`, {
          method: "POST",
          headers: invokeHeaders,
          body: JSON.stringify({
            submissionId: finalSubmissionId,
            leadData: {
              customer_full_name: resolvedInsuredName,
              phone_number: resolvedPhone,
              email: leadData?.email,
              lead_vendor: resolvedLeadVendor,
            },
            callResult: {
              application_submitted,
              sent_to_underwriting,
              status: finalStatus,
              notes,
              lead_vendor: resolvedLeadVendor,
              agent_who_took_call: agent,
              buffer_agent,
              call_source,
              carrier,
              product_type,
              draft_date,
              monthly_premium,
              face_amount,
            },
          }),
        });
      } catch (disconnectedError) {
        console.error("Disconnected call notification error:", disconnectedError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        operation,
        submission_id: finalSubmissionId,
        data: savedRecord,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

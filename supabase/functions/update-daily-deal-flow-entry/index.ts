import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isDST = (date: Date) => {
  const year = date.getFullYear();
  const marchSecondSunday = new Date(year, 2, 1);
  marchSecondSunday.setDate(1 + (7 - marchSecondSunday.getDay()) + 7);
  const novemberFirstSunday = new Date(year, 10, 1);
  novemberFirstSunday.setDate(1 + ((7 - novemberFirstSunday.getDay()) % 7));
  return date >= marchSecondSunday && date < novemberFirstSunday;
};

const getTodayDateEST = () => {
  const now = new Date();
  const offset = isDST(now) ? -4 : -5;
  const estDate = new Date(now.getTime() + offset * 60 * 60 * 1000);
  return estDate.toISOString().split("T")[0];
};

const getCurrentTimestampEST = () => {
  const now = new Date();
  const offset = isDST(now) ? -4 : -5;
  const estDate = new Date(now.getTime() + offset * 60 * 60 * 1000);
  return estDate.toISOString();
};

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
  return mapStatusToSheetValue(originalStatus || "Not Submitted");
};

const determineCallResultStatus = (
  applicationSubmitted: boolean | null,
  sentToUnderwriting: boolean | null,
) => {
  if (applicationSubmitted === true) {
    return sentToUnderwriting === true ? "Underwriting" : "Submitted";
  }
  return "Not Submitted";
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
      is_retention_call = false,
      dq_reason = null,
    } = body;

    if (!submission_id) throw new Error("Missing required field: submission_id");
    if (!call_source) throw new Error("Missing required field: call_source");

    const todayDate = getTodayDateEST();
    const { data: leadData } = await supabase
      .from("leads")
      .select("customer_full_name, phone_number, email, lead_vendor")
      .eq("submission_id", submission_id)
      .maybeSingle();

    const finalStatus = determineFinalStatus(application_submitted, sent_to_underwriting, status);
    const callResultStatus = determineCallResultStatus(application_submitted, sent_to_underwriting);

    let finalSubmissionId = submission_id as string;
    let operation = "inserted";
    let savedRecord: unknown = null;

    if (call_source === "First Time Transfer") {
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

    const { data: existingTodayEntry } = await supabase
      .from("daily_deal_flow")
      .select("id")
      .eq("submission_id", finalSubmissionId)
      .eq("date", todayDate)
      .maybeSingle();

    const dailyFlowPayload = {
      submission_id: finalSubmissionId,
      lead_vendor: leadData?.lead_vendor ?? lead_vendor ?? null,
      insured_name: leadData?.customer_full_name ?? null,
      client_phone_number: leadData?.phone_number ?? null,
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
      policy_number,
      carrier_audit,
      product_type_carrier,
      level_or_gi,
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

    if (application_submitted === true && lead_vendor) {
      try {
        await supabase.from("leads").update({ lead_vendor }).eq("submission_id", submission_id);
      } catch (leadVendorError) {
        console.error("Lead vendor update failed:", leadVendorError);
      }
    }

    if (application_submitted === true) {
      try {
        await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/slack-notification`, {
          method: "POST",
          headers: invokeHeaders,
          body: JSON.stringify({
            channel: "#test-bpo",
            submissionId: finalSubmissionId,
            leadData: { customer_full_name: leadData?.customer_full_name },
            callResult: {
              application_submitted,
              status: finalStatus,
              call_source,
              buffer_agent,
              agent_who_took_call: agent,
              licensed_agent_account,
              carrier,
              product_type,
              draft_date,
              monthly_premium,
              face_amount,
              sent_to_underwriting,
              notes,
              lead_vendor: leadData?.lead_vendor ?? lead_vendor ?? null,
            },
          }),
        });
      } catch (slackError) {
        console.error("Slack notification error:", slackError);
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
              customer_full_name: leadData?.customer_full_name,
              phone_number: leadData?.phone_number,
              email: leadData?.email,
              lead_vendor: leadData?.lead_vendor ?? lead_vendor ?? null,
            },
            callResult: {
              status: finalStatus,
              dq_reason: dq_reason ?? null,
              notes,
              lead_vendor: leadData?.lead_vendor ?? lead_vendor ?? null,
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
              customer_full_name: leadData?.customer_full_name,
              phone_number: leadData?.phone_number,
              email: leadData?.email,
              lead_vendor: leadData?.lead_vendor ?? lead_vendor ?? null,
            },
            callResult: {
              application_submitted,
              sent_to_underwriting,
              status: finalStatus,
              notes,
              lead_vendor: leadData?.lead_vendor ?? lead_vendor ?? null,
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

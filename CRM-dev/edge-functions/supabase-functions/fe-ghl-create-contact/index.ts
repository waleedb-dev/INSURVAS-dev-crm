/**
 * Edge function: `fe-ghl-create-contact`
 * Creates a LeadConnector (GHL) contact and updates `leads` with ghlcontactid / ghl_location_id.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      lead_vendor,
      first_name,
      last_name,
      phone_number,
      email: _email,
      date_of_birth: _date_of_birth,
      state: _state,
      city: _city,
      street_address: _street_address,
      zip_code: _zip_code,
      carrier: _carrier,
      product_type: _product_type,
      monthly_premium: _monthly_premium,
      coverage_amount: _coverage_amount,
      submission_id,
    } = await req.json();

    if (!lead_vendor || !phone_number) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields: lead_vendor and phone_number are required",
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

    const { data: locationSecret, error: secretError } = await supabase
      .from("ghl_location_secrets")
      .select("locationid, api_token")
      .eq("lead_vendor", lead_vendor)
      .single();

    if (secretError || !locationSecret?.locationid || !locationSecret?.api_token) {
      console.error("No GHL location/token found for vendor:", lead_vendor);
      return new Response(
        JSON.stringify({
          success: false,
          message: `No GHL location/token found for lead vendor: ${lead_vendor}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const locationId = locationSecret.locationid;
    const apiToken = locationSecret.api_token;

    const centerTag = `child${(lead_vendor || "").substring(0, 2).toLowerCase()}`;
    const contactPayload: Record<string, unknown> = {
      locationId: locationId,
      firstName: first_name || "",
      lastName: last_name || "",
      phone: phone_number,
      type: "lead",
      source: "Jotform-call center",
      tags: ["call center", centerTag],
    };

    console.log("Creating GHL contact with payload:", JSON.stringify(contactPayload, null, 2));

    const ghlResponse = await fetch("https://services.leadconnectorhq.com/contacts/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Version: "2021-07-28",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(contactPayload),
    });

    const ghlResult = await ghlResponse.json();
    console.log("GHL API Response:", JSON.stringify(ghlResult, null, 2));

    if (!ghlResponse.ok) {
      console.error("GHL API Error:", ghlResult);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to create contact in GHL",
          error: ghlResult,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (ghlResult.contact?.id && submission_id) {
      await supabase
        .from("leads")
        .update({
          ghlcontactid: ghlResult.contact.id,
          ghl_location_id: locationId,
        })
        .eq("submission_id", submission_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Contact created successfully in GHL",
        contactId: ghlResult.contact?.id,
        locationId: locationId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in fe-ghl-create-contact:", error);
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

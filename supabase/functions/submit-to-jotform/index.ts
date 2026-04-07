/**
 * Edge function: `submit-to-jotform`
 * Submits transfer lead application data to JotForm
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JOTFORM_API_KEY = Deno.env.get("JOTFORM_API_KEY");
const JOTFORM_FORM_ID = Deno.env.get("JOTFORM_FORM_ID") || "252715341682457";
const JOTFORM_API_URL = "https://api.jotform.com";

interface JotFormSubmission {
  submissionDate: string;
  firstName: string;
  lastName: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  age: string;
  dateOfBirth: string;
  social: string;
  height: string;
  weight: string;
  doctorName: string;
  tobaccoUse: string;
  healthConditions: string;
  medications: string;
  monthlyPremium: string;
  coverageAmount: string;
  draftDate: string;
  beneficiaryInformation: string;
  institutionName: string;
  routingNumber: string;
  accountNumber: string;
  futureDraftDate: string;
  additionalInformation: string;
  driverLicenseNumber: string;
  existingCoverageLast2Years: string;
  existingCoverageDetails: string;
  previousApplications2Years: string;
  carrier: string;
  productType: string;
  bankAccountType: string;
  birthState: string;
}

function formatPhoneForJotform(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatDateForJotform(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function mapToJotformSubmission(data: JotFormSubmission): Record<string, string> {
  const submission: Record<string, string> = {};

  submission["submission[3]"] = formatDateForJotform(data.submissionDate);
  
  submission["submission[4_first]"] = data.firstName;
  submission["submission[4_last]"] = data.lastName;
  
  submission["submission[5_addr_line1]"] = data.street1;
  submission["submission[5_addr_line2]"] = data.street2 || "";
  submission["submission[5_city]"] = data.city;
  submission["submission[5_state]"] = data.state;
  submission["submission[5_zip]"] = data.zipCode;
  
  submission["submission[6]"] = formatPhoneForJotform(data.phone);
  
  submission["submission[9]"] = data.age;
  submission["submission[10]"] = formatDateForJotform(data.dateOfBirth);
  submission["submission[11]"] = data.social;
  submission["submission[12]"] = data.height;
  submission["submission[13]"] = data.weight;
  submission["submission[14]"] = data.doctorName;
  
  submission["submission[15]"] = data.tobaccoUse;
  submission["submission[16]"] = data.healthConditions;
  submission["submission[17]"] = data.medications;
  
  submission["submission[18]"] = data.monthlyPremium;
  submission["submission[19]"] = data.coverageAmount;
  
  submission["submission[22]"] = formatDateForJotform(data.draftDate);
  submission["submission[23]"] = data.beneficiaryInformation;
  submission["submission[24]"] = data.institutionName;
  submission["submission[25]"] = data.routingNumber;
  submission["submission[26]"] = data.accountNumber;
  submission["submission[27]"] = formatDateForJotform(data.futureDraftDate);
  submission["submission[28]"] = data.additionalInformation;
  
  submission["submission[33]"] = data.driverLicenseNumber;
  submission["submission[34]"] = data.existingCoverageLast2Years;
  submission["submission[35]"] = data.previousApplications2Years;
  
  submission["submission[41]"] = data.carrier;
  submission["submission[42]"] = data.productType;
  
  submission["submission[43]"] = data.bankAccountType === "Checking" ? "Checking Account" : data.bankAccountType === "Savings" ? "Saving Account" : data.bankAccountType;
  
  submission["submission[44]"] = data.birthState;

  return submission;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!JOTFORM_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "JOTFORM_API_KEY environment variable is not set",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const payload: JotFormSubmission = await req.json();

    if (!payload.phone || !payload.firstName || !payload.lastName) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required fields: phone, firstName, lastName are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const jotformData = mapToJotformSubmission(payload);
    
    const url = `${JOTFORM_API_URL}/form/${JOTFORM_FORM_ID}/submissions`;
    
    const formBody = new URLSearchParams();
    for (const [key, value] of Object.entries(jotformData)) {
      formBody.append(key, value);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "APIKey": JOTFORM_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formBody.toString(),
    });

    const result = await response.json();

    if (response.ok && result.responseCode === 200) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Application submitted to JotForm successfully",
          submissionId: result.content?.id || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          message: result.message || "Failed to submit to JotForm",
          details: result,
        }),
        {
          status: response.status || 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

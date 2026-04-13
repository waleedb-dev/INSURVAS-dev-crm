# Edge functions: verification, app fix, and call result

This document lists **Supabase edge functions** invoked from the portal for three flows: **verification**, **app fix**, and **call result submit**. It focuses on **notification-style** functions and notes **non-notification** helpers where relevant.

---

## Case 1: Verification

**Primary UI:** `src/components/StartVerificationModal.tsx`, `src/components/VerificationPanel.tsx`  
**LA Ready:** `src/pages/CallResultUpdate.tsx`, `src/pages/CallResultUpdateV2.tsx`

| Edge function | When it runs | Body / `type` (when applicable) |
|---------------|--------------|-----------------------------------|
| `center-transfer-notification` | User starts verification after modal success | `type: 'verification_started'` — buffer path includes `bufferAgentName`, `agentType: 'buffer'`, `leadData`; licensed path includes `licensedAgentName`, `agentType: 'licensed'`, `leadData` |
| `center-transfer-notification` | User taps **Call Dropped** in verification panel | `type: 'call_dropped'`, `submissionId`, `leadData` |
| `disconnected-call-notification` | Immediately after **Call Dropped** (same handler) | `callResult.status: "Call Dropped"`, `call_source: "Verification Session"`, lead snippet, agent fields (`buffer_agent` or `agent_who_took_call`) |
| `center-transfer-notification` | Buffer taps **Transfer to LA** | `type: 'transfer_to_la'`, `submissionId`, `leadData`, `bufferAgentName`, `licensedAgentName` (placeholders in current UI) |
| `retention-call-notification` | LA Ready URL flow on call result update pages | `type: 'la_ready'` — notifies buffer that licensed agent is ready |
| `validate-usps-address` | User validates address from verification panel | **Not** a center/Slack notification — USPS validation only |

---

## Case 2: App fix

**Create task — banking:** `src/components/AppFixBankingForm.tsx`  
**Create task — carrier:** `src/components/AppFixCarrierForm.tsx`  
**Complete task:** `src/pages/TaskDetailView.tsx`

| Edge function | When it runs | Notes |
|---------------|--------------|--------|
| `send-app-fix-notification` | Submit **banking** app fix form | Notifies assigned licensed agent (`taskId`, `submissionId`, `customerName`, `assignedTo`, `retentionAgent`, `fixType: 'banking_info'`, `newDraftDate`) |
| *(none)* | Submit **carrier requirement** app fix form | Inserts `app_fix_tasks` + `app_fix_carrier_requirements` only; no notification edge function in client code |
| `update-daily-deal-flow-entry` | Licensed agent completes app fix task | Syncs `daily_deal_flow` (e.g. `call_result: 'App Fix Completed'`); not the same as verification center-transfer notifications |

---

## Case 3: Call result form submit

**Primary UI:** `src/components/CallResultForm.tsx` (`handleSubmit`)

### Always (sync, not necessarily a “notification”)

| Edge function | Purpose |
|---------------|---------|
| `update-daily-deal-flow-entry` | Upsert/sync daily deal flow row from form payload |

### Conditional notifications and integrations

| Edge function | Condition |
|---------------|-----------|
| `create-new-callback-sheet` | New callback submission id path (sheet row creation) |
| `google-sheets-update` | Existing submission — update sheet row |
| `slack-notification` | `applicationSubmitted === true` |
| `center-notification` | `applicationSubmitted === false` |
| `disconnected-call-notification` | Not submitted **and** final status is disconnected-style (`Disconnected`, `Disconnected - Never Retransferred`) |
| `disconnected-call-notification` | Submitted **and** `sentToUnderwriting === true` (underwriting path; same function name, different payload) |
| `create-lead` | Med Alert pitch checked |
| `medalert-notification` | Med Alert pitch checked (after/create alongside `create-lead`) |
| `personal-sales-portal-notification` | `licensedAgentAccount` set and not `'N/A'` |
| `retention-team-notification` | `isRetentionCall` **and** derived `notificationType` is set: `application_submitted`, `fixed_banking` (status `Updated Banking/draft date`), or `fulfilled_carrier_requirements` (status `Fulfilled carrier requirements`) |

---

## Quick reference: notification functions by name

| Function | Typical consumers |
|----------|-------------------|
| `center-transfer-notification` | Verification start, drop, transfer to LA |
| `disconnected-call-notification` | Verification call dropped; call result disconnected; underwriting notify |
| `retention-call-notification` | LA ready (buffer notify) |
| `retention-team-notification` | Call result with retention flag + specific outcomes |
| `slack-notification` | Call result — application submitted |
| `center-notification` | Call result — application not submitted |
| `send-app-fix-notification` | App fix banking task created |
| `medalert-notification` | Call result — Med Alert pitch |
| `personal-sales-portal-notification` | Call result — licensed agent notes/portal |

---

## Related source files

- `src/components/VerificationPanel.tsx`
- `src/components/StartVerificationModal.tsx`
- `src/pages/CallResultUpdate.tsx`, `src/pages/CallResultUpdateV2.tsx`
- `src/components/CallResultForm.tsx`
- `src/components/AppFixBankingForm.tsx`, `src/components/AppFixCarrierForm.tsx`
- `src/pages/TaskDetailView.tsx`
- `src/hooks/useRealtimeVerification.ts` (data channel; no direct `invoke` list here)

Edge function **implementations** live under `supabase/functions/<function-name>/`.



personal sales portal notification:


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Log incoming request for debugging
    const rawBody = await req.text();
    console.log('[DEBUG] Incoming request body:', rawBody);
    const { callResultData, verificationItems } = JSON.parse(rawBody);
    if (!SLACK_BOT_TOKEN) {
      console.error('[ERROR] SLACK_BOT_TOKEN not configured');
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    // Check if we should post notes
    const licensedAgent = callResultData.licensed_agent_account;
    // Don't post if no licensed agent or licensed agent is N/A
    if (!licensedAgent || licensedAgent === 'N/A') {
      console.log('[INFO] No licensed agent specified or N/A - skipping notes posting');
      return new Response(JSON.stringify({
        success: true,
        message: 'No licensed agent - notes not posted'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // License account to portal mapping
    const licensePortalMapping = {
      "Lydia": "#sales-portal-lydia-sutton",
      "Benjamin": "#sales-portal-ben-wunder",
      "Isaac": "#sales-portal-isaac-reed",
      "Claudia": "#sales-portal-tatumn-scott",
      "Noah": "#sales-portal-zack-lesnar",
      "Tatumn" : "#sales-portal-tatumn-scott",
      "Trinity":"#sales-portal-tatumn-scott"
    };
    const portalChannel = licensePortalMapping[licensedAgent];
    if (!portalChannel) {
      console.error(`[ERROR] No portal channel mapping for licensed agent: ${licensedAgent}`);
      return new Response(JSON.stringify({
        success: false,
        message: `No portal channel mapping for licensed agent: ${licensedAgent}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Filter only verified items (with checkmark)
    const verifiedItems = verificationItems?.filter((item)=>item.is_verified) || [];
    if (verifiedItems.length === 0) {
      console.log('[INFO] No verified items found - skipping notes posting');
      return new Response(JSON.stringify({
        success: true,
        message: 'No verified items - notes not posted'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create field values map from verified items
    const fieldValues = {};
    verifiedItems.forEach((item)=>{
      fieldValues[item.field_name] = item.verified_value || item.original_value || 'N/A';
    });
    // Build client information section
    const clientInfo = [
      `customer_full_name:${fieldValues.customer_full_name || 'N/A'}`,
      `Address: ${fieldValues.street_address || ''} ${fieldValues.city || ''}, ${fieldValues.state || ''} ${fieldValues.zip_code || ''}`,
      `Beneficiary Information: ${fieldValues.beneficiary_information || 'N/A'}`,
      `Billing and mailing address is the same: (Y/N)`,
      `Date of Birth: ${fieldValues.date_of_birth || 'N/A'}`,
      `Birth State: ${fieldValues.birth_state || 'N/A'}`,
      `Age: ${fieldValues.age || 'N/A'}`,
      `Number: ${fieldValues.phone_number || 'N/A'}`,
      `Call phone/landline: ${fieldValues.call_phone_landline || ''}`,
      `Social: ${fieldValues.social_security || 'N/A'}`
    ].join('\n');
    // Build call results section
    const callResults = [
      `Customer Name: ${callResultData.customer_full_name || fieldValues.customer_full_name || 'N/A'}`,
      `Status: ${callResultData.status || 'N/A'}`,
      `Reason: ${callResultData.status_reason || 'No specific reason provided'}`,
      `Notes: ${callResultData.notes || 'No additional notes'}`
    ].join('\n');
    // Create the complete message
    const messageText = [
      `Notes Posted:`,
      ``,
      `Client Information:`,
      clientInfo,
      `---------------------------------------`,
      `Call Results:`,
      callResults,
      `---------------------------------------------------------------------------------------------------`
    ].join('\n');
    const slackMessage = {
      channel: portalChannel,
      text: messageText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Notes Posted for ${licensedAgent}:*`
          }
        },
        {
          type: 'section',
          text: {
            type: 'plain_text',
            text: messageText
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Submission ID: ${callResultData.submission_id} | Licensed Agent: ${licensedAgent}`
            }
          ]
        }
      ]
    };
    console.log('[DEBUG] Slack message payload:', JSON.stringify(slackMessage, null, 2));
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });
    const slackResult = await slackResponse.json();
    console.log('[DEBUG] Slack API response:', slackResult);
    if (!slackResult.ok) {
      console.error('[ERROR] Slack API error:', slackResult);
      return new Response(JSON.stringify({
        success: false,
        message: slackResult.error,
        debug: slackResult
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult.ts,
      channel: portalChannel,
      licensedAgent: licensedAgent,
      verifiedItemsCount: verifiedItems.length
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[ERROR] Exception in function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      debug: error
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});


medalert:


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const MEDALERT_CHANNEL = Deno.env.get('MEDALERT_CHANNEL') || '#internal-medalert-sales-portal';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { leadData, agentName, status, dqReason } = await req.json();
    
    if (!SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }

    if (!leadData || !leadData.customer_full_name) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Customer name is required'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const customerName = leadData.customer_full_name || 'Unknown';
    const phoneNumber = leadData.phone_number || 'No phone number';
    const email = leadData.email || 'No email';

    const slackMessage = {
      channel: MEDALERT_CHANNEL,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '📞 MEDALERT PITCH - CUSTOMER TRANSFER'
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*A Med Alert pitch has been initiated. Please prepare for call transfer.*`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Customer Name:*\n${customerName}`
            },
            {
              type: 'mrkdwn',
              text: `*Phone Number:*\n${phoneNumber}`
            },
            {
              type: 'mrkdwn',
              text: `*Email:*\n${email}`
            },
            {
              type: 'mrkdwn',
              text: `*Original Status:*\n${status || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*DQ Reason:*\n${dqReason || 'N/A'}`
            },
            {
              type: 'mrkdwn',
              text: `*Agent:*\n${agentName || 'Unknown'}`
            }
          ]
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Med Alert DID: 475 236 5826 | Submitted by: ${agentName || 'Unknown'} | Time: ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    };

    console.log(`Sending Med Alert notification to ${MEDALERT_CHANNEL}`);
    
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    const slackResult = await slackResponse.json();
    console.log('Slack API Response:', JSON.stringify(slackResult, null, 2));

    if (!slackResult.ok) {
      console.error('Slack API error:', slackResult.error);
      return new Response(JSON.stringify({
        success: false,
        message: 'Failed to send Slack notification',
        error: slackResult.error
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('Med Alert notification sent successfully');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Med Alert notification sent successfully',
      channel: MEDALERT_CHANNEL
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error in medalert-notification:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});



send-app-fix-notification:

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SLACK_CHANNEL = '#app-fix-notifications'; // Configure your Slack channel

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }

  try {
    const rawBody = await req.text();
    console.log('[DEBUG] App Fix notification request:', rawBody);
    
    const { 
      taskId, 
      submissionId, 
      customerName, 
      assignedTo, 
      retentionAgent,
      fixType,
      newDraftDate,
      carrier,
      requirementType,
      requirementDetails
    } = JSON.parse(rawBody);

    if (!SLACK_BOT_TOKEN) {
      console.error('[ERROR] SLACK_BOT_TOKEN not configured');
      throw new Error('SLACK_BOT_TOKEN not configured');
    }

    // Build the task detail URL
    const taskUrl = `https://agents-portal-zeta.vercel.app/task-detail/${taskId}`;

    // Determine notification title and details based on fix type
    let notificationTitle = '';
    let additionalFields: any[] = [];

    if (fixType === 'banking_info') {
      notificationTitle = '🏦 New Banking Update Task';
      additionalFields = [
        {
          type: 'mrkdwn',
          text: `*New Draft Date:*\n${newDraftDate}`
        }
      ];
    } else if (fixType === 'carrier_requirement') {
      notificationTitle = '📋 New Carrier Requirement Task';
      additionalFields = [
        {
          type: 'mrkdwn',
          text: `*Carrier:*\n${carrier}`
        },
        {
          type: 'mrkdwn',
          text: `*Requirement Type:*\n${requirementType}`
        }
      ];
    }

    // Build Slack message
    const slackText = `${notificationTitle}\nAssigned to: ${assignedTo} by ${retentionAgent}`;
    
    const slackMessage = {
      channel: SLACK_CHANNEL,
      text: slackText,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: notificationTitle,
            emoji: true
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Assigned To:*\n${assignedTo}`
            },
            {
              type: 'mrkdwn',
              text: `*Created By:*\n${retentionAgent}`
            },
            {
              type: 'mrkdwn',
              text: `*Customer:*\n${customerName}`
            },
            {
              type: 'mrkdwn',
              text: `*Submission ID:*\n${submissionId}`
            },
            ...additionalFields
          ]
        }
      ]
    };

    // Add requirement details for carrier requirements
    if (fixType === 'carrier_requirement' && requirementDetails) {
      slackMessage.blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Requirement Details:*\n${requirementDetails}`
        }
      });
    }

    // Add action button
    slackMessage.blocks.push(
      {
        type: 'divider'
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📋 View Task Details',
              emoji: true
            },
            url: taskUrl,
            style: 'primary',
            action_id: 'view_task_detail'
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Task ID: ${taskId} | Submission: ${submissionId}`
          }
        ]
      }
    );

    console.log('[DEBUG] Slack message payload:', JSON.stringify(slackMessage, null, 2));

    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });

    const slackResult = await slackResponse.json();
    console.log('[DEBUG] Slack API response:', slackResult);

    if (!slackResult.ok) {
      console.error('[ERROR] Slack API error:', slackResult);
      return new Response(JSON.stringify({
        success: false,
        message: slackResult.error,
        debug: slackResult
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200 // Return 200 even on Slack errors to not fail the task creation
      });
    }

    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult.ts,
      channel: SLACK_CHANNEL,
      debug: slackResult
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('[ERROR] Exception in send-app-fix-notification function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      debug: error.toString()
    }), {
      status: 200, // Return 200 to not fail task creation
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});





center-notification
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { submissionId, leadData, callResult } = await req.json();
    if (!SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    // Center mapping for different lead vendors
    const leadVendorCenterMapping = {
      "Ark Tech": "#orbit-team-ark-tech",
      "GrowthOnics BPO": "#orbit-team-growthonics-bpo",
      "Maverick": "#sample-center-transfer-channel",
      "Omnitalk BPO": "#orbit-team-omnitalk-bpo",
      "Vize BPO": "#orbit-team-vize-bpo",
      "Corebiz": "#orbit-team-corebiz-bpo",
      "Digicon": "#orbit-team-digicon-bpo",
      "Ambition": "#orbit-team-ambition-bpo",
      "AJ BPO": "#orbit-team-aj-bpo",
      "Pro Solutions BPO": "#orbit-team-pro-solutions-bpo",
      "Emperor BPO": "#orbit-team-emperor-bpo",
      "Benchmark": "#orbit-team-benchmark-bpo",
      "Poshenee": "#orbit-team-poshenee-tech-bpo",
      "Plexi": "#orbit-team-plexi-bpo",
      "Gigabite": "#orbit-team-gigabite-bpo",
      "Everline solution": "#orbit-team-everline-bpo",
      "Cerberus BPO": "#orbit-team-cerberus-bpo",
      "NanoTech": "#orbit-team-nanotech-bpo",
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
      "Networkize": "#orbit-team-networkize",
      "LightVerse BPO": "#orbit-team-lightverse-bpo",
      "Leads BPO": "#orbit-team-leads-bpo",
      "Helix BPO": "#orbit-team-helix-bpo",
      "CrossNotch": "#orbit-team-crossnotch",
      "TechPlanet": "#orbit-team-techplanet",
      "Exito BPO": "#orbit-team-exito-bpo",
      "StratiX BPO": "#orbit-team-stratix-bpo",
      "Lumenix BPO": "#orbit-team-lumenix-bpo",
      "All-Star BPO": "#orbit-team-allstar-bpo",
      "DownTown BPO": "#orbit-team-downtown-bpo",
      "Livik BPO": "#orbit-team-livik-bpo",
      "NexGen BPO": "#orbit-team-nexgen-bpo",
      "Quoted-Leads BPO": "#orbit-team-quotedleads-bpo",
      "Venom BPO": "#orbit-team-venom-bpo",
      "WinBPO": "#orbit-team-win-bpo",
      "TechPlanet": "#orbit-team-techplanet",
      "Techvated Marketing": "#orbit-team-techvated-marketing",
      "Core Marketing":"#orbit-team-core-marketing",
      "Everest BPO":"#orbit-team-everest-bpo",
      "Riztech BPO":"#orbit-team-riztech-bpo",
      "Tekelec BPO": "#orbit-team-tekelec-bpo",
      "Alternative BPO":"#orbit-team-alternative-bpo",
      "Broker Leads BPO":"#orbit-team-broker-leads-bpo",
      "Alternative BPO":"#orbit-team-alternative-bpo",
      "Hexa Affiliates":"#orbit-team-hexa-affiliates",
      "Unified Systems BPO":"#orbit-team-unified-systems-bpo",
      "Lavish BPO":"#orbit-team-lavish-bpo",
      "Winners Limited":"#orbit-team-winners-limited",
      "Futures BPO":"#orbit-team-futures-bpo",
      "Redeemer BPO":"#orbit-team-redeemer-bpo",
      "Libra V2":"#orbit-team-libra",
      "Ascendra BPO":"#orbit-team-ascendra-bpo",
      "INB BPO":"#orbit-team-inb-bpo",
      "JoLu Solutions":"#orbit-team-jolu-solutions",
      "Jason BPO":"#orbit-team-jason-bpo",
      "MBG":"#orbit-team-mbg",
      "Progressive BPO":"#orbit-team-progressive-bpo",
      "NextPoint BPO":"#orbit-team-nextpoint-bpo",
      "Sellerz BPO":"#orbit-team-sellerz-bpo"
    };
    // Send notifications for all call results (submitted or not)
    // No filtering - centers need to know about all outcomes
    console.log('Debug - callResult data:', JSON.stringify(callResult, null, 2));
    console.log('Debug - leadData:', JSON.stringify(leadData, null, 2));
    // Get the lead vendor from callResult or leadData
    const leadVendor = callResult?.lead_vendor || leadData?.lead_vendor;
    if (!leadVendor) {
      console.log('No lead vendor found, cannot determine center channel');
      return new Response(JSON.stringify({
        success: false,
        message: 'No lead vendor specified'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const centerChannel = leadVendorCenterMapping[leadVendor];
    if (!centerChannel) {
      console.log(`No center channel mapping found for lead vendor: "${leadVendor}"`);
      return new Response(JSON.stringify({
        success: false,
        message: `No center channel mapping for vendor: ${leadVendor}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Create the notification message with notes and reason
    const statusText = callResult.status || 'Not Submitted';
    const reasonText = callResult.dq_reason || 'No specific reason provided';
    const notesText = callResult.notes || 'No additional notes';
    const customerName = leadData.customer_full_name || 'Unknown Customer';
    const phoneNumber = leadData.phone_number || 'No phone number';
    const email = leadData.email || 'No email';
    // Format the message with status emoji
    // Use trim() and normalize to handle invisible characters and whitespace
    const normalizedStatus = (callResult.status || '').trim().normalize('NFKC');
    const normalizedReason = (callResult.dq_reason || '').trim().normalize('NFKC');
    let statusEmoji = '✅';
    // Use includes() for partial matching to handle variations and invisible characters
    if (normalizedStatus.includes('DQ') || normalizedStatus === 'DQ' || normalizedReason.includes('Chargeback DQ')) {
      statusEmoji = '🚫';
    } else if (normalizedStatus.includes('callback') || normalizedStatus.includes('Callback')) {
      statusEmoji = '📞';
    } else if (normalizedStatus.includes('Not Interested') || normalizedStatus.includes('not interested')) {
      statusEmoji = '🙅‍♂️';
    } else if (normalizedStatus.includes('Future') || normalizedStatus.includes('future')) {
      statusEmoji = '📅';

    } else if (normalizedStatus.includes('Submitted') || normalizedStatus.includes('submitted')) {
      statusEmoji = '✅';
    }
    else if (normalizedStatus.includes('App Fix Completed') || normalizedStatus.includes('App Fix Completed')) {
      statusEmoji = '✅';

    } else if (normalizedStatus.includes('Updated Banking/draft date') || normalizedStatus.includes('updated banking/draft date')) {
      statusEmoji = '✅';
    } else if (normalizedStatus.includes('Fulfilled carrier requirements') || normalizedStatus.includes('fulfilled carrier requirements')) {
      statusEmoji = '✅';
    } else {
      // Default for unknown statuses
      statusEmoji = '⚠️';
    }
    const centerSlackMessage = {
      channel: centerChannel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusEmoji} - ${statusText}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Customer Name:* ${customerName}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Status:* ${statusText}\n*Reason:* ${reasonText}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Notes:*\n${notesText}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Lead Vendor: ${leadVendor} | Agent: ${callResult.agent_who_took_call || 'N/A'} | Buffer: ${callResult.buffer_agent || 'N/A'}`
            }
          ]
        }
      ]
    };
    console.log(`Sending center notification to ${centerChannel} for vendor ${leadVendor}`);
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(centerSlackMessage)
    });
    const slackResult = await slackResponse.json();
    console.log(`Center Slack API Response for ${centerChannel}:`, JSON.stringify(slackResult, null, 2));
    if (!slackResult.ok) {
      console.error(`Slack API error: ${slackResult.error}`);
      if (slackResult.error === 'channel_not_found') {
        console.log(`Channel ${centerChannel} not found, center may need to create it or invite the bot`);
        return new Response(JSON.stringify({
          success: false,
          message: `Channel ${centerChannel} not found`,
          error: slackResult.error
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else {
        throw new Error(`Slack API error: ${slackResult.error}`);
      }
    }
    console.log(`Center notification sent to ${centerChannel} successfully`);
    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult.ts,
      channel: centerChannel,
      leadVendor: leadVendor,
      status: statusText,
      reason: reasonText
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in center-notification:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});




slack-notification:
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');

// Helper function to format dates to American format (MM/DD/YYYY)
const formatDateAmerican = (dateString: string | null | undefined): string => {
  if (!dateString || dateString === 'N/A' || dateString.trim() === '') {
    return 'N/A';
  }
  
  const trimmed = dateString.trim();
  
  // If in YYYY-MM-DD format (ISO), convert to MM/DD/YYYY
  const yyyymmddPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  if (yyyymmddPattern.test(trimmed)) {
    const match = trimmed.match(yyyymmddPattern)!;
    const year = match[1];
    const month = match[2];
    const day = match[3];
    return `${month}/${day}/${year}`;
  }
  
  // Check if it's in DD/MM/YYYY or MM/DD/YYYY format
  const slashPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  if (slashPattern.test(trimmed)) {
    const match = trimmed.match(slashPattern)!;
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    const year = match[3];
    
    // If first part > 12, it's likely DD/MM/YYYY, so swap
    if (first > 12 && second <= 12) {
      return `${second}/${first}/${year}`;
    }
    // If second part > 12, it's already MM/DD/YYYY, return as is
    if (second > 12 && first <= 12) {
      return trimmed;
    }
    // If both <= 12, assume it's already MM/DD/YYYY (most common case)
    return trimmed;
  }
  
  // If we can't parse it, return as is
  return trimmed;
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { submissionId, leadData, callResult } = await req.json();
    if (!SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    // Lead vendor to Slack channel mapping
    const leadVendorChannelMapping = {
      "Ark Tech": "#orbit-team-ark-tech",
      "GrowthOnics BPO": "#orbit-team-growthonics-bpo",
      "Maverick": "#sample-center-transfer-channel",
      "Omnitalk BPO": "#orbit-team-omnitalk-bpo",
      "Vize BPO": "#orbit-team-vize-bpo",
      "Corebiz": "#orbit-team-corebiz-bpo",
      "Digicon": "#orbit-team-digicon-bpo",
      "Ambition": "#orbit-team-ambition-bpo",
      "AJ BPO": "#orbit-team-aj-bpo",
      "Pro Solutions BPO": "#orbit-team-pro-solutions-bpo",
      "Emperor BPO": "#orbit-team-emperor-bpo",
      "Benchmark": "#orbit-team-benchmark-bpo",
      "Poshenee": "#orbit-team-poshenee-tech-bpo",
      "Plexi": "#orbit-team-plexi-bpo",
      "Gigabite": "#orbit-team-gigabite-bpo",
      "Everline solution": "#orbit-team-everline-bpo",
      "Progressive BPO": "#orbit-team-progressive-bpo",
      "Cerberus BPO": "#orbit-team-cerberus-bpo",
      "NanoTech": "#orbit-team-nanotech-bpo",
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
      "Networkize": "#orbit-team-networkize",
      "LightVerse BPO": "#orbit-team-lightverse-bpo",
      "Leads BPO": "#orbit-team-leads-bpo",
      "Helix BPO": "#orbit-team-helix-bpo",
      "CrossNotch": "#orbit-team-crossnotch",
      "TechPlanet": "#orbit-team-techplanet",
      "Exito BPO": "#orbit-team-exito-bpo",
      "StratiX BPO": "#orbit-team-stratix-bpo",
      "Lumenix BPO": "#orbit-team-lumenix-bpo",
      "All-Star BPO": "#orbit-team-allstar-bpo",
      "DownTown BPO": "#orbit-team-downtown-bpo",
      "Livik BPO": "#orbit-team-livik-bpo",
      "NexGen BPO": "#orbit-team-nexgen-bpo",
      "Quoted-Leads BPO": "#orbit-team-quotedleads-bpo",
      "Venom BPO": "#orbit-team-venom-bpo",
      "WinBPO": "#orbit-team-win-bpo",
      "TechPlanet": "#orbit-team-techplanet",
      "Techvated Marketing": "#orbit-team-techvated-marketing",
      "Core Marketing":"#orbit-team-core-marketing",
      "Everest BPO":"#orbit-team-everest-bpo",
      "Riztech BPO":"#orbit-team-riztech-bpo",
      "Tekelec BPO": "#orbit-team-tekelec-bpo",
      "Alternative BPO":"#orbit-team-alternative-bpo",
      "Broker Leads BPO":"#orbit-team-broker-leads-bpo",
      "Hexa Affiliates":"#orbit-team-hexa-affiliates",
      "Unified Systems BPO":"#orbit-team-unified-systems-bpo",
      "Lavish BPO":"#orbit-team-lavish-bpo",
      "Winners Limited":"#orbit-team-winners-limited",
      "Futures BPO":"#orbit-team-futures-bpo",
      "Redeemer BPO":"#orbit-team-redeemer-bpo",
      "Libra V2":"#orbit-team-libra",
      "Ascendra BPO":"#orbit-team-ascendra-bpo",
      "INB BPO":"#orbit-team-inb-bpo",
      "JoLu Solutions":"#orbit-team-jolu-solutions",
      "Jason BPO":"#orbit-team-jason-bpo",
      "MBG":"#orbit-team-mbg",
      "NextPoint BPO":"#orbit-team-nextpoint-bpo",
      "Sellerz BPO":"#orbit-team-sellerz-bpo"
    };
    const isSubmittedApplication = callResult && callResult.application_submitted === true;
    let slackMessage;
    // Only send notifications for submitted applications
    if (isSubmittedApplication) {
      // Determine final status based on underwriting field
      let finalStatus = callResult.status || 'Submitted';
      if (callResult.application_submitted === true) {
        finalStatus = callResult.sent_to_underwriting === true ? "Underwriting" : "Submitted";
      }
      // Add status display text
      const statusDisplay = finalStatus === "Underwriting" ? "Sent to Underwriting" : finalStatus;
      // Template for submitted applications
      slackMessage = {
        channel: '#submission-portal',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '✅ Application Submitted!'
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*${callResult.buffer_agent || 'N/A'}* - *${callResult.agent_who_took_call || 'N/A'}* - *${callResult.lead_vendor || 'N/A'}* - *${leadData.customer_full_name || 'N/A'}* - *${callResult.carrier || 'N/A'}* - *${callResult.product_type || 'N/A'}* - *${formatDateAmerican(callResult.draft_date)}* - *$${callResult.monthly_premium || 'N/A'}* - *$${callResult.face_amount || 'N/A'}* - *${statusDisplay}*`
            }
          }
        ]
      };
    } else {
      // No notification for new leads, only log
      console.log('Skipping notification - only submitted applications trigger Slack messages');
    }
    // Only send Slack message if we have one (for submitted applications)
    let slackResult = {
      ok: false
    };
    if (slackMessage) {
      const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackMessage)
      });
      slackResult = await slackResponse.json();
      console.log('Slack API Response:', JSON.stringify(slackResult, null, 2));
      if (!slackResult.ok) {
        console.error(`Slack API error: ${slackResult.error}`);
        // If the main channel fails, try with a direct message instead
        if (slackResult.error === 'channel_not_found') {
          console.log('Channel not found, skipping main notification');
        // Don't throw error, just log and continue
        } else {
          throw new Error(`Slack API error: ${slackResult.error}`);
        }
      } else {
        console.log('Slack message sent successfully');
      }
    }
    // Debug logging to check the received data
    console.log('Debug - callResult data:', JSON.stringify(callResult, null, 2));
    console.log('Debug - isSubmittedApplication:', isSubmittedApplication);
    console.log('Debug - callResult.lead_vendor:', callResult?.lead_vendor);
    // Send additional notification to lead vendor specific channel if application is submitted
    if (isSubmittedApplication && callResult.lead_vendor) {
      const vendorChannel = leadVendorChannelMapping[callResult.lead_vendor];
      console.log(`Debug - Looking for vendor: "${callResult.lead_vendor}"`);
      console.log(`Debug - Found channel: ${vendorChannel}`);
      if (vendorChannel) {
        // Calculate status display for vendor message
        const sentToUnderwriting = callResult.sent_to_underwriting === true ? "Yes" : "No";
        const vendorSlackMessage = {
          channel: vendorChannel,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: '✅ Application Submitted!'
              }
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*${leadData.customer_full_name || 'N/A'}*\n\nCarrier: ${callResult.carrier || 'N/A'}\nProduct Type: ${callResult.product_type || 'N/A'}\nDraft Date: ${formatDateAmerican(callResult.draft_date)}\nMonthly Premium: $${callResult.monthly_premium || 'N/A'}\nCoverage Amount: $${callResult.face_amount || 'N/A'}\nSent to Underwriting: ${sentToUnderwriting}`
              }
            }
          ]
        };
        try {
          const vendorSlackResponse = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(vendorSlackMessage)
          });
          const vendorSlackResult = await vendorSlackResponse.json();
          console.log(`Vendor Slack API Response for ${vendorChannel}:`, JSON.stringify(vendorSlackResult, null, 2));
          if (vendorSlackResult.ok) {
            console.log(`Vendor notification sent to ${vendorChannel} successfully`);
          } else {
            console.error(`Failed to send vendor notification to ${vendorChannel}: ${vendorSlackResult.error}`);
            if (vendorSlackResult.error === 'channel_not_found') {
              console.log(`Channel ${vendorChannel} not found, vendor may need to create it or invite the bot`);
            }
          }
        } catch (vendorError) {
          console.error(`Error sending vendor notification to ${vendorChannel}:`, vendorError);
        }
      } else {
        console.log(`No channel mapping found for lead vendor: "${callResult.lead_vendor}"`);
      }
    } else {
      console.log('Debug - Vendor notification not sent because:');
      console.log(`  - isSubmittedApplication: ${isSubmittedApplication}`);
      console.log(`  - callResult.lead_vendor exists: ${!!callResult?.lead_vendor}`);
      console.log(`  - callResult.lead_vendor value: "${callResult?.lead_vendor}"`);
    }
    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult?.ts,
      mainChannelSuccess: slackResult?.ok || false,
      vendorNotificationAttempted: isSubmittedApplication && !!callResult?.lead_vendor,
      vendorChannel: isSubmittedApplication && callResult?.lead_vendor ? leadVendorChannelMapping[callResult.lead_vendor] : null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in slack-notification:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});






Retention-call-notification:

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const BUFFER_CALLBACK_CHANNEL = "#sales-team-callback-portal";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    console.log("[DEBUG] Retention call notification request:", rawBody);

    const {
      type,
      submissionId,
      verificationSessionId,
      bufferAgentId,
      bufferAgentName,
      licensedAgentId,
      licensedAgentName,
      customerName,
      leadVendor,
      notificationId,
      retentionType,
      retentionNotes,
      quoteDetails,
      portalBaseUrl,
      laReadyUrl,
      updateCallResultUrl,
    } = JSON.parse(rawBody);

    if (!SLACK_BOT_TOKEN) {
      throw new Error("SLACK_BOT_TOKEN not configured");
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const resolvedPortalBaseUrl =
      typeof portalBaseUrl === "string" && portalBaseUrl.trim().length
        ? portalBaseUrl.replace(/\/+$/, "")
        : "http://localhost:8080";

    const resolvedLaReadyUrl =
      typeof laReadyUrl === "string" && laReadyUrl.trim().length
        ? laReadyUrl
        : `${resolvedPortalBaseUrl}/call-result-update?submissionId=${encodeURIComponent(
            submissionId ?? "",
          )}&sessionId=${encodeURIComponent(
            verificationSessionId ?? "",
          )}&notificationId=${encodeURIComponent(notificationId ?? "")}`;

    const resolvedUpdateCallResultUrl =
      typeof updateCallResultUrl === "string" && updateCallResultUrl.trim().length
        ? updateCallResultUrl
        : `${resolvedPortalBaseUrl}/agent/call-update?submissionId=${encodeURIComponent(
            submissionId ?? "",
          )}&sessionId=${encodeURIComponent(verificationSessionId ?? "")}`;

    if (type === "buffer_connected") {
      let retentionDetailsText = "";

      if (retentionType === "new_sale") {
        retentionDetailsText = "\n\n*Retention Type:* New Sale";
        if (quoteDetails) {
          retentionDetailsText += "\n*Quote Details:*";
          if (quoteDetails.carrier) retentionDetailsText += `\n• Carrier: ${quoteDetails.carrier}`;
          if (quoteDetails.product) retentionDetailsText += `\n• Product: ${quoteDetails.product}`;
          if (quoteDetails.coverage) retentionDetailsText += `\n• Coverage: ${quoteDetails.coverage}`;
          if (quoteDetails.monthlyPremium) retentionDetailsText += `\n• Monthly Premium: ${quoteDetails.monthlyPremium}`;
          if (quoteDetails.draftDate) retentionDetailsText += `\n• Draft Date: ${quoteDetails.draftDate}`;
        }
      } else if (retentionType === "fixed_payment") {
        retentionDetailsText = "\n\n*Retention Type:* Fixed Failed Payment";
        if (retentionNotes) retentionDetailsText += `\n*Notes:* ${retentionNotes}`;
      } else if (retentionType === "carrier_requirements") {
        retentionDetailsText = "\n\n*Retention Type:* Fulfilling Carrier Requirements";
        if (retentionNotes) retentionDetailsText += `\n*Notes:* ${retentionNotes}`;
      }

      const slackMessage = {
        channel: BUFFER_CALLBACK_CHANNEL,
        text: `:phone: Retention Call - ${bufferAgentName} connected with ${customerName}`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📞 Retention Call - Agent Connected",
              emoji: true,
            },
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Retention Agent:*\n${bufferAgentName || "N/A"}`,
              },
              {
                type: "mrkdwn",
                text: `*Customer:*\n${customerName || "N/A"}`,
              },
              {
                type: "mrkdwn",
                text: `*Lead Vendor:*\n${leadVendor || "N/A"}`,
              },
              {
                type: "mrkdwn",
                text: `*Submission ID:*\n${submissionId || "N/A"}`,
              },
            ],
          },
          ...(retentionDetailsText
            ? [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: retentionDetailsText,
                  },
                },
              ]
            : []),
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "*Use one of the actions below:*",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "✅ Ready",
                  emoji: true,
                },
                style: "primary",
                url: resolvedLaReadyUrl,
                action_id: "la_ready_button",
              },
              {
                type: "button",
                text: {
                  type: "plain_text",
                  text: "📝 Update call result",
                  emoji: true,
                },
                url: resolvedUpdateCallResultUrl,
                action_id: "update_call_result_button",
              },
            ],
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: "Ready notifies the retention agent. Update call result opens the portal page directly.",
              },
            ],
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
          type: "buffer_connected",
          messageTs: slackResult.ts,
          channel: BUFFER_CALLBACK_CHANNEL,
          notificationId,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // keep your existing la_ready block unchanged...

    return new Response(
      JSON.stringify({
        success: false,
        message: `Unknown notification type: ${type}`,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
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







center transformation notificaion:


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    // Log incoming request for debugging
    const rawBody = await req.text();
    console.log('[DEBUG] Incoming request body:', rawBody);
    const { type, submissionId, leadData, bufferAgentName, licensedAgentName, agentName } = JSON.parse(rawBody);
    if (!SLACK_BOT_TOKEN) {
      console.error('[ERROR] SLACK_BOT_TOKEN not configured');
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    // Center mapping for different lead vendors
    const leadVendorCenterMapping = {
      "Ark Tech": "#orbit-team-ark-tech",
      "Lumenix BPO": "#orbit-team-lumenix-bpo",
      "GrowthOnics BPO": "#orbit-team-growthonics-bpo",
      "Maverick": "#sample-center-transfer-channel",
      "Omnitalk BPO": "#orbit-team-omnitalk-bpo",
      "Vize BPO": "#orbit-team-vize-bpo",
      "Corebiz": "#orbit-team-corebiz-bpo",
      "Digicon": "#orbit-team-digicon-bpo",
      "Ambition": "#orbit-team-ambition-bpo",
      "AJ BPO": "#orbit-team-aj-bpo",
      "Pro Solutions BPO": "#orbit-team-pro-solutions-bpo",
      "Emperor BPO": "#orbit-team-emperor-bpo",
      "Benchmark": "#orbit-team-benchmark-bpo",
      "Poshenee": "#orbit-team-poshenee-tech-bpo",
      "Plexi": "#orbit-team-plexi-bpo",
      "Lavish BPO":"#orbit-team-lavish-bpo",
      "Gigabite": "#orbit-team-gigabite-bpo",
      "Everline solution": "#orbit-team-everline-bpo",
      "Cerberus BPO": "#orbit-team-cerberus-bpo",
      "NanoTech": "#orbit-team-nanotech-bpo",
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
      "Networkize": "#orbit-team-networkize",
      "LightVerse BPO": "#orbit-team-lightverse-bpo",
      "Leads BPO": "#orbit-team-leads-bpo",
      "Helix BPO": "#orbit-team-helix-bpo",
      "Exito BPO": "#orbit-team-exito-bpo",
      "TechPlanet": "#orbit-team-techplanet",
      "CrossNotch": "#orbit-team-crossnotch",
      "StratiX BPO": "#orbit-team-stratix-bpo",
      "All-Star BPO": "#orbit-team-allstar-bpo",
      "DownTown BPO": "#orbit-team-downtown-bpo",
      "Livik BPO": "#orbit-team-livik-bpo",
      "NexGen BPO": "#orbit-team-nexgen-bpo",
      "Quoted-Leads BPO": "#orbit-team-quotedleads-bpo",
      "Venom BPO": "#orbit-team-venom-bpo",
      "WinBPO": "#orbit-team-win-bpo",
      "TechPlanet": "#orbit-team-techplanet",
      "Techvated Marketing": "#orbit-team-techvated-marketing",
      "Core Marketing":"#orbit-team-core-marketing",
      "Everest BPO":"#orbit-team-everest-bpo",
      "Riztech BPO":"#orbit-team-riztech-bpo",
      "Tekelec BPO": "#orbit-team-tekelec-bpo",
      "Alternative BPO":"#orbit-team-alternative-bpo",
      "Broker Leads BPO":"#orbit-team-broker-leads-bpo",
      "Hexa Affiliates":"#orbit-team-hexa-affiliates",
      "Unified Systems BPO":"#orbit-team-unified-systems-bpo",
      "Winners Limited":"#orbit-team-winners-limited",
      "Futures BPO":"#orbit-team-futures-bpo",
      "Redeemer BPO":"#orbit-team-redeemer-bpo",
      "Libra V2":"#orbit-team-libra",
      "Ascendra BPO":"#orbit-team-ascendra-bpo",
      "INB BPO":"#orbit-team-inb-bpo",
      "Jason BPO":"#orbit-team-jason-bpo",
      "MBG":"#orbit-team-mbg",
      "Progressive BPO":"#orbit-team-progressive-bpo",
      "NextPoint BPO":"#orbit-team-nextpoint-bpo",
      "Sellerz BPO":"#orbit-team-sellerz-bpo"
    };
    const leadVendor = leadData?.lead_vendor;
    if (!leadVendor) {
      console.error('[ERROR] No lead vendor specified in payload:', leadData);
      return new Response(JSON.stringify({
        success: false,
        message: 'No lead vendor specified'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const centerChannel = leadVendorCenterMapping[leadVendor];
    if (!centerChannel) {
      console.error(`[ERROR] No center channel mapping for vendor: ${leadVendor}`);
      return new Response(JSON.stringify({
        success: false,
        message: `No center channel mapping for vendor: ${leadVendor}`
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Notification message logic
    let slackText = '';
    if (type === 'call_dropped') {
      slackText = `:red_circle: Call with *${leadData.customer_full_name || 'Unknown Customer'}* dropped. Need to reconnect.`;
    } else if (type === 'transfer_to_la') {
      slackText = `:arrow_right: *${bufferAgentName || 'Buffer Agent'}* has transferred *${leadData.customer_full_name || 'Unknown Customer'}* to *${licensedAgentName || 'Licensed Agent'}*.`;
    } else if (type === 'verification_started') {
      // Debug log for verification_started
      console.log('[DEBUG] Verification started payload:', {
        type,
        submissionId,
        leadData,
        bufferAgentName,
        licensedAgentName
      });
      // Prefer explicit agentName if provided, otherwise fall back to specific roles
      const startedAgent = agentName || bufferAgentName || licensedAgentName;
      if (startedAgent && leadData?.customer_full_name) {
        slackText = `:white_check_mark: *${startedAgent}* is connected to *${leadData.customer_full_name}*`;
      } else {
        slackText = `:white_check_mark: Agent is connected to *${leadData?.customer_full_name || 'Unknown Customer'}*`;
      }
    } else if (type === 'reconnected') {
      // Notification for agent claim and reconnect after dropped call
      const effectiveAgentName = agentName || bufferAgentName || licensedAgentName || 'Agent';
      // Copy requested phrasing: "Agent name get connected with <Customer>"
      slackText = `*${effectiveAgentName}* get connected with *${leadData?.customer_full_name || 'Unknown Customer'}*`;
    } else {
      slackText = 'Notification.';
    }
    const slackMessage = {
      channel: centerChannel,
      text: slackText,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: slackText
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Submission ID: ${submissionId}`
            }
          ]
        }
      ]
    };
    console.log('[DEBUG] Slack message payload:', slackMessage);
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });
    const slackResult = await slackResponse.json();
    console.log('[DEBUG] Slack API response:', slackResult);
    if (!slackResult.ok) {
      console.error('[ERROR] Slack API error:', slackResult);
      return new Response(JSON.stringify({
        success: false,
        message: slackResult.error,
        debug: slackResult
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult.ts,
      channel: centerChannel,
      debug: slackResult
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[ERROR] Exception in function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      debug: error
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});



disconnected-call-notification


import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const SLACK_BOT_TOKEN = Deno.env.get('SLACK_BOT_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('NEXT_PUBLIC_SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { submissionId, leadData, callResult } = await req.json();
    if (!SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    
    // Check if this is an underwriting notification
    const isUnderwriting = callResult && callResult.application_submitted === true && callResult.sent_to_underwriting === true;
    
    // Only send notifications for disconnected calls, dropped calls, or underwriting submissions
    const isDisconnected = callResult && (callResult.status === "Disconnected" || callResult.status === "Disconnected - Never Retransferred");
    const isDropped = callResult && (callResult.status === "Call Never Sent" || callResult.status === "Call Back Fix" || callResult.status === "Call Dropped" || callResult.status === "Not Submitted" && callResult.notes?.toLowerCase().includes("dropped"));
    
    if (!isDisconnected && !isDropped && !isUnderwriting) {
      console.log('Skipping notification - not a disconnected call, dropped call, or underwriting submission');
      return new Response(JSON.stringify({
        success: true,
        message: 'No notification sent - not a disconnected call, dropped call, or underwriting submission'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    console.log('Debug - callResult data:', JSON.stringify(callResult, null, 2));
    console.log('Debug - leadData:', JSON.stringify(leadData, null, 2));
    
    // Single channel for all notifications
    const notificationChannel = "#calls-review-portal";
    
    // Handle underwriting notifications
    if (isUnderwriting) {
      // Initialize Supabase client
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase credentials not configured');
      }
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Use a simple counter stored in database for reliable alternation
      // IMPORTANT: Counter increments EVERY TIME this function is triggered for underwriting
      // This means it increments for both new submissions AND updates to existing records
      // Counter: 1=Ben, 2=Zee, 3=Ben, 4=Zee, 5=Ben, 6=Zee...
      
      let counter = 0;
      let mentionPerson = 'Ben'; // Default
      
      try {
        // Get current counter value from database
        const { data: counterRow, error: getError } = await supabase
          .from('underwriting_mention_counter')
          .select('counter_value')
          .eq('id', 1)
          .single();
        
        if (getError) {
          // Table doesn't exist yet, use count as fallback until migration runs
          console.log('[UNDERWRITING NOTIFICATION] Counter table not found, using count-based fallback');
          
          const { count } = await supabase
            .from('call_results')
            .select('*', { count: 'exact', head: true })
            .eq('application_submitted', true)
            .eq('sent_to_underwriting', true);
          
          counter = (count || 0);
        } else {
          counter = counterRow?.counter_value || 0;
        }
        
        // ALWAYS increment counter when function is triggered for underwriting
        // This happens for both new submissions and updates
        counter = counter + 1;
        
        // Alternate: Odd = Ben, Even = Zee
        mentionPerson = counter % 2 === 1 ? 'Ben' : 'Zee';
        
        console.log(`[UNDERWRITING NOTIFICATION] Counter incremented to: ${counter}, Mentioning: ${mentionPerson}`);
        
        // Save incremented counter back to database for next time
        const { error: updateError } = await supabase
          .from('underwriting_mention_counter')
          .upsert({ id: 1, counter_value: counter, updated_at: new Date().toISOString() });
        
        if (updateError) {
          console.log('[UNDERWRITING NOTIFICATION] Counter table update failed (table may not exist yet):', updateError.message);
          // Table will be created by migration, counter will work next time
        } else {
          console.log(`[UNDERWRITING NOTIFICATION] Counter saved to database: ${counter}`);
        }
        
      } catch (counterError) {
        console.error('[UNDERWRITING NOTIFICATION] Counter error:', counterError);
        // Fallback: use count
        const { count } = await supabase
          .from('call_results')
          .select('*', { count: 'exact', head: true })
          .eq('application_submitted', true)
          .eq('sent_to_underwriting', true);
        counter = (count || 0) + 1;
        mentionPerson = counter % 2 === 1 ? 'Ben' : 'Zee';
        console.log(`[UNDERWRITING NOTIFICATION] Using fallback count: ${counter}, Mentioning: ${mentionPerson}`);
      }
      
      // Slack user IDs from notify-eligible-agents function
      // Ben: U07ULU99VD4 (Benjamin Wunder - Sales Manager)
      // Zee: Need to add Zee's Slack user ID - format: UXXXXXXXXXX
      const benSlackId = "U07ULU99VD4";
      const zeeSlackId = "U09AWBNGBQF"; // TODO: Replace with Zee's actual Slack user ID (currently using Zack's ID as placeholder)
      
      const mentionText = mentionPerson === 'Ben' ? `<@${benSlackId}>` : `<@${zeeSlackId}>`;
      
      const customerName = leadData.customer_full_name || 'Unknown Customer';
      const phoneNumber = leadData.phone_number || 'No phone number';
      const email = leadData.email || 'No email';
      const leadVendor = callResult?.lead_vendor || leadData?.lead_vendor || 'N/A';
      const agentName = callResult.agent_who_took_call || 'N/A';
      const bufferAgent = callResult.buffer_agent || 'N/A';
      const carrier = callResult.carrier || 'N/A';
      const productType = callResult.product_type || 'N/A';
      const draftDate = callResult.draft_date || 'N/A';
      const monthlyPremium = callResult.monthly_premium || 'N/A';
      const faceAmount = callResult.face_amount || 'N/A';
      const notesText = callResult.notes || 'No additional notes';
      
      const slackMessage = {
        channel: notificationChannel,
        text: `New submission sent to underwriting - ${customerName}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `📋 Submission Sent to Underwriting - ${customerName}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${mentionText} - New submission sent to underwriting from agent portal`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Customer:* ${customerName}\n*Phone:* ${phoneNumber}\n*Email:* ${email}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Carrier:* ${carrier}\n*Product Type:* ${productType}\n*Draft Date:* ${draftDate}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Monthly Premium:* $${monthlyPremium}\n*Coverage Amount:* $${faceAmount}\n*Lead Vendor:* ${leadVendor}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Agent:* ${agentName}\n*Buffer Agent:* ${bufferAgent}`
            }
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Notes:*\n${notesText}`
            }
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Submission ID: ${submissionId} | Time: ${new Date().toLocaleString()}`
              }
            ]
          }
        ]
      };
      
      console.log(`Sending underwriting notification to ${notificationChannel} mentioning ${mentionPerson}`);
      const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(slackMessage)
      });
      
      const slackResult = await slackResponse.json();
      console.log(`Slack API Response for ${notificationChannel}:`, JSON.stringify(slackResult, null, 2));
      
      if (!slackResult.ok) {
        console.error(`Slack API error: ${slackResult.error}`);
        if (slackResult.error === 'channel_not_found') {
          console.log(`Channel ${notificationChannel} not found, please create it or invite the bot`);
          return new Response(JSON.stringify({
            success: false,
            message: `Channel ${notificationChannel} not found`,
            error: slackResult.error
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } else {
          throw new Error(`Slack API error: ${slackResult.error}`);
        }
      }
      
      console.log(`Underwriting notification sent to ${notificationChannel} successfully`);
      return new Response(JSON.stringify({
        success: true,
        messageTs: slackResult.ts,
        channel: notificationChannel,
        notificationType: 'Underwriting Submission',
        customerName: customerName,
        mentionedPerson: mentionPerson
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Handle disconnected/dropped call notifications (existing logic)
    const statusText = callResult.status || 'Disconnected';
    const customerName = leadData.customer_full_name || 'Unknown Customer';
    const phoneNumber = leadData.phone_number || 'No phone number';
    const email = leadData.email || 'No email';
    const leadVendor = callResult?.lead_vendor || leadData?.lead_vendor || 'N/A';
    const agentName = callResult.agent_who_took_call || 'N/A';
    const bufferAgent = callResult.buffer_agent || 'N/A';
    const notesText = callResult.notes || 'No additional notes';
    // Format the message with appropriate emoji
    let statusEmoji = '❌';
    let notificationType = 'Disconnected Call';
    if (isDisconnected) {
      statusEmoji = '❌';
      notificationType = 'Disconnected Call';
    } else if (isDropped) {
      statusEmoji = '📞';
      notificationType = 'Dropped Call';
    }
    const slackMessage = {
      channel: notificationChannel,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${statusEmoji} ${notificationType} - ${customerName}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Customer:* ${customerName}\n*Phone:* ${phoneNumber}\n*Email:* ${email}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Status:* ${statusText}\n*Lead Vendor:* ${leadVendor}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Agent:* ${agentName}\n*Buffer Agent:* ${bufferAgent}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Notes:*\n${notesText}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Submission ID: ${submissionId} | Time: ${new Date().toLocaleString()}`
            }
          ]
        }
      ]
    };
    console.log(`Sending disconnected call notification to ${notificationChannel}`);
    const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackMessage)
    });
    const slackResult = await slackResponse.json();
    console.log(`Slack API Response for ${notificationChannel}:`, JSON.stringify(slackResult, null, 2));
    if (!slackResult.ok) {
      console.error(`Slack API error: ${slackResult.error}`);
      if (slackResult.error === 'channel_not_found') {
        console.log(`Channel ${notificationChannel} not found, please create it or invite the bot`);
        return new Response(JSON.stringify({
          success: false,
          message: `Channel ${notificationChannel} not found`,
          error: slackResult.error
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } else {
        throw new Error(`Slack API error: ${slackResult.error}`);
      }
    }
    console.log(`Disconnected call notification sent to ${notificationChannel} successfully`);
    return new Response(JSON.stringify({
      success: true,
      messageTs: slackResult.ts,
      channel: notificationChannel,
      notificationType: notificationType,
      customerName: customerName,
      status: statusText
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in disconnected-call-notification:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

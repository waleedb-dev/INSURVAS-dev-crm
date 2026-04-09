export const TRANSFER_STAGE_TO_REASON_STATUS: Record<string, string> = {
  "Transfer API": "Needs callback",
  "Chargeback Fix API": "Updated Banking/draft date",
  "Incomplete Transfer": "Needs callback",
  "Needs BPO Callback": "Needs callback",
  "Returned To Center - DQ": "DQ",
  "DQ'd Can't be sold": "DQ",
  "Application Withdrawn": "Future Submission Date",
  "Pending Approval": "Fulfilled carrier requirements",
  "GI DQ": "GI - Currently DQ",
  "Fulfilled Carrier Requirement": "Fulfilled carrier requirements",
  "New Submission": "Needs callback",
  "test stage": "Needs callback",
};

export const REASON_MAP: Record<string, string[]> = {
  DQ: [
    "Multiple Chargebacks",
    "Not Cognatively Functional",
    "Transferred Many Times Without Success",
    "TCPA",
    "Decline All Available Carriers",
    "Already a DQ in our System",
    "Other",
  ],
  "Chargeback DQ": [
    "Chargeback DQ",
    "Multiple Chargebacks",
    "Not Cognatively Functional",
    "Transferred Many Times Without Success",
    "TCPA",
    "Decline All Available Carriers",
    "Already a DQ in our System",
    "Other",
  ],
  "Needs callback": ["Banking information invalid", "Existing Policy - Draft hasn't passed", "Other"],
  "Not Interested": ["Existing coverage - Not Looking for More", "Other"],
  "Future Submission Date": [
    "Future Submission Date - Draft Date Too Far Away",
    "Future Submission Date - Birthday is before draft date",
    "Other",
  ],
  "Updated Banking/draft date": ["Updated Banking and draft date", "Updated draft w/ same banking information"],
  "Fulfilled carrier requirements": ["Fulfilled carrier requirements"],
};

export const REASON_STATUSES_WITH_DROPDOWN = new Set([
  "DQ",
  "Chargeback DQ",
  "Needs callback",
  "Not Interested",
  "Future Submission Date",
  "Updated Banking/draft date",
  "Fulfilled carrier requirements",
]);

const formatDateUs = (dateText: string): string => {
  if (!dateText) return "[Please select a date]";
  const [year, month, day] = dateText.split("-");
  if (!year || !month || !day) return "[Please select a date]";
  return `${month}/${day}/${year}`;
};

export const getReasonStatusFromStage = (stageName: string): string => {
  const normalized = String(stageName || "").trim();
  if (TRANSFER_STAGE_TO_REASON_STATUS[normalized]) return TRANSFER_STAGE_TO_REASON_STATUS[normalized];

  const lowered = normalized.toLowerCase();
  if (lowered.includes("chargeback fix") || lowered.includes("failed payment")) return "Updated Banking/draft date";
  if (lowered.includes("callback")) return "Needs callback";
  if (lowered.includes("withdrawn")) return "Future Submission Date";
  if (lowered.includes("pending approval")) return "Fulfilled carrier requirements";
  if (lowered.includes("not interested")) return "Not Interested";
  if (lowered.includes("chargeback dq")) return "Chargeback DQ";
  if (lowered.includes("dq")) return "DQ";
  return normalized;
};

export const getNoteText = (
  status: string,
  reason: string,
  clientName: string = "[Client Name]",
  newDraftDate?: string,
) => {
  const statusReasonMapping: { [status: string]: { [reason: string]: string } } = {
    DQ: {
      "Multiple Chargebacks": `${clientName} has been DQ'd. They have caused multiple chargebacks in our agency, so we cannot submit another application for them`,
      "Not Cognatively Functional": `${clientName} has been DQ'd. They are not mentally able to make financial decisions. We cannot submit an application for them`,
      "Transferred Many Times Without Success": `We have spoken with ${clientName} more than 5 times and have not been able to successfully submit an application. We should move on from this caller`,
      TCPA: `${clientName} IS A TCPA LITIGATOR. PLEASE REMOVE FROM YOUR SYSTEM IMMEDIATELY`,
      "Decline All Available Carriers": `${clientName} was denied through all carriers they are elligible to apply for`,
      "Already a DQ in our System": `${clientName} is already a DQ in our system. We will not accept this caller again.`,
      Other: "Custom message if none of the above fit",
    },
    "Chargeback DQ": {
      "Chargeback DQ": `${clientName} has caused multiple chargebacks. We will not accept this caller into our agency`,
      "Multiple Chargebacks": `${clientName} has been DQ'd. They have caused multiple chargebacks in our agency, so we cannot submit another application for them`,
      "Not Cognatively Functional": `${clientName} has been DQ'd. They are not mentally able to make financial decisions. We cannot submit an application for them`,
      "Transferred Many Times Without Success": `We have spoken with ${clientName} more than 5 times and have not been able to successfully submit an application. We should move on from this caller`,
      TCPA: `${clientName} IS A TCPA LITIGATOR. PLEASE REMOVE FROM YOUR SYSTEM IMMEDIATELY`,
      "Decline All Available Carriers": `${clientName} was denied through all carriers they are elligible to apply for`,
      "Already a DQ in our System": `${clientName} is already a DQ in our system. We will not accept this caller again.`,
      Other: "Custom message if none of the above fit",
    },
    "Needs callback": {
      "Banking information invalid": `The banking information for ${clientName} could not be validated. We need to call them back and verify a new form of payment`,
      "Existing Policy - Draft hasn't passed": `${clientName} has an existing policy with an initial draft date that hasn't passed. We can call them [a week after entered draft date] to see if they want additional coverage`,
      Other: "Custom message if none of the above fit",
    },
    "Not Interested": {
      "Existing coverage - Not Looking for More": `${clientName} has exsiting coverage and cannot afford additional coverage`,
      Other: "Custom message if none of the above fit",
    },
    "Future Submission Date": {
      "Future Submission Date - Draft Date Too Far Away": `The application for ${clientName} has been filled out and signed, but we cannot submit until [Submission date] because the draft date is too far out`,
      "Future Submission Date - Birthday is before draft date": `${clientName}'s birthday is before their initial draft, so we need to call them on [the day after client DOB] to requote and submit application`,
      Other: "Custom message if none of the above fit",
    },
    "Updated Banking/draft date": {
      "Updated Banking and draft date": `New Draft date ${formatDateUs(newDraftDate || "")}`,
      "Updated draft w/ same banking information": `New Draft date ${formatDateUs(newDraftDate || "")}`,
    },
  };
  return statusReasonMapping[status]?.[reason] || "";
};

"use client";

export interface DailyDealFlowRow {
  id: string;
  submission_id: string;
  client_phone_number?: string | null;
  lead_vendor?: string | null;
  date?: string | null;
  insured_name?: string | null;
  buffer_agent?: string | null;
  retention_agent?: string | null;
  retention_agent_id?: string | null;
  agent?: string | null;
  licensed_agent_account?: string | null;
  status?: string | null;
  call_result?: string | null;
  carrier?: string | null;
  product_type?: string | null;
  draft_date?: string | null;
  monthly_premium?: number | null;
  face_amount?: number | null;
  from_callback?: boolean | null;
  is_callback?: boolean | null;
  is_retention_call?: boolean | null;
  notes?: string | null;
  policy_number?: string | null;
  carrier_audit?: string | null;
  product_type_carrier?: string | null;
  level_or_gi?: string | null;
  la_callback?: string | null;
  call_center_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DdfFilters {
  searchTerm: string;
  dateFilter?: Date;
  dateFromFilter?: Date;
  dateToFilter?: Date;
  bufferAgentFilter: string;
  retentionAgentFilter: string[];
  licensedAgentFilter: string;
  leadVendorFilter: string;
  statusFilter: string;
  carrierFilter: string;
  callResultFilter: string;
  retentionFilter: string;
  incompleteUpdatesFilter: string;
  laCallbackFilter: string;
  hourFromFilter: string;
  hourToFilter: string;
}

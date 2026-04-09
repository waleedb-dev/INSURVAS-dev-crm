/** Client-side model for disposition wizard (loaded from Supabase). */

export type DispositionPathStep =
  | {
      kind: "choice";
      node_key: string;
      option_key: string;
      option_label: string;
      quick_tag_label?: string | null;
    }
  | { kind: "carrier_multi"; node_key: string; carriers: string[] }
  | { kind: "text"; node_key: string; manual_text: string };

export type DispositionFlowOptionDef = {
  option_key: string;
  option_label: string;
  sort_order: number;
  next_node_key: string | null;
  template_key: string | null;
  quick_tag_label: string | null;
  requires_manual_note: boolean;
};

export type DispositionFlowNodeDef = {
  node_key: string;
  node_type: "choice" | "carrier_multi" | "text";
  node_label: string;
  sort_order: number;
  metadata: Record<string, unknown>;
  options: DispositionFlowOptionDef[];
};

export type DispositionFlowDefinition = {
  flow_key: string;
  pipeline_stage_name: string;
  flow_label: string;
  root_node_key: string;
  nodes: Record<string, DispositionFlowNodeDef>;
  templates: Record<string, string>;
};

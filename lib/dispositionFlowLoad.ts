import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispositionFlowDefinition, DispositionFlowNodeDef, DispositionFlowOptionDef } from "./dispositionFlowTypes";

/** Load active disposition flow for a Transfer Portal stage name (pipeline_stages.name). */
export async function loadDispositionFlowForStage(
  supabase: SupabaseClient,
  pipelineStageName: string,
): Promise<DispositionFlowDefinition | null> {
  const stage = pipelineStageName.trim();
  if (!stage) return null;

  const { data: flowRow, error: flowErr } = await supabase
    .from("disposition_flows")
    .select("id, flow_key, pipeline_stage_name, flow_label, root_node_key")
    .eq("pipeline_stage_name", stage)
    .eq("is_active", true)
    .maybeSingle();

  if (flowErr || !flowRow?.id) return null;

  const flowId = flowRow.id as number;

  const { data: nodesWithIds, error: n2Err } = await supabase
    .from("disposition_flow_nodes")
    .select("id, node_key, node_type, node_label, sort_order, metadata")
    .eq("flow_id", flowId)
    .order("sort_order", { ascending: true });

  if (n2Err || !nodesWithIds?.length) return null;

  const nodeIds = nodesWithIds.map((r) => (r as { id: number }).id);

  const { data: optionsAll, error: o2Err } = await supabase
    .from("disposition_flow_options")
    .select(
      "node_id, option_key, option_label, sort_order, next_node_key, template_key, quick_tag_label, requires_manual_note",
    )
    .in("node_id", nodeIds);

  if (o2Err) return null;

  const { data: tmplRows } = await supabase.from("disposition_note_templates").select("template_key, template_body");

  const templates: Record<string, string> = {};
  for (const t of tmplRows || []) {
    const row = t as { template_key: string; template_body: string };
    if (row.template_key) templates[row.template_key] = row.template_body || "";
  }

  const optionsByNodeId = new Map<number, DispositionFlowOptionDef[]>();
  for (const o of optionsAll || []) {
    const r = o as {
      node_id: number;
      option_key: string;
      option_label: string;
      sort_order: number;
      next_node_key: string | null;
      template_key: string | null;
      quick_tag_label: string | null;
      requires_manual_note: boolean;
    };
    const list = optionsByNodeId.get(r.node_id) || [];
    list.push({
      option_key: r.option_key,
      option_label: r.option_label,
      sort_order: r.sort_order,
      next_node_key: r.next_node_key,
      template_key: r.template_key,
      quick_tag_label: r.quick_tag_label,
      requires_manual_note: Boolean(r.requires_manual_note),
    });
    optionsByNodeId.set(r.node_id, list);
  }

  const nodes: Record<string, DispositionFlowNodeDef> = {};
  for (const n of nodesWithIds) {
    const r = n as {
      id: number;
      node_key: string;
      node_type: string;
      node_label: string;
      sort_order: number;
      metadata: Record<string, unknown> | null;
    };
    const opts = (optionsByNodeId.get(r.id) || []).sort((a, b) => a.sort_order - b.sort_order);
    nodes[r.node_key] = {
      node_key: r.node_key,
      node_type: r.node_type as DispositionFlowNodeDef["node_type"],
      node_label: r.node_label,
      sort_order: r.sort_order,
      metadata: (r.metadata || {}) as Record<string, unknown>,
      options: opts,
    };
  }

  return {
    flow_key: String(flowRow.flow_key),
    pipeline_stage_name: String(flowRow.pipeline_stage_name),
    flow_label: String(flowRow.flow_label),
    root_node_key: String(flowRow.root_node_key),
    nodes,
    templates,
  };
}

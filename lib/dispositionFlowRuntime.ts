import type { DispositionFlowDefinition } from "./dispositionFlowTypes";

export function applyDispositionTemplate(
  templateBody: string,
  vars: { client_name: string; carriers?: string; field_label?: string },
): string {
  let s = templateBody;
  s = s.replace(/\{\{client_name\}\}/g, vars.client_name || "[Client Name]");
  s = s.replace(/\{\{carriers\}\}/g, vars.carriers || "");
  s = s.replace(/\{\{field_label\}\}/g, vars.field_label || "");
  return s.trim();
}

export function resolveTemplateKeyFromNode(flow: DispositionFlowDefinition, nodeKey: string): string | null {
  const meta = flow.nodes[nodeKey]?.metadata;
  const key = meta?.template_key_after_carriers;
  return typeof key === "string" && key ? key : null;
}

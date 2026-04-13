import type { DispositionFlowDefinition, DispositionPathStep } from "./dispositionFlowTypes";

/**
 * Final note for Needs BPO → Couldn't complete signature, after:
 * carrier(s) attempted → texts Y/N → emails Y/N → only carriers / next attempts.
 * Omits "Carrier(s) attempted" when exactly one carrier was selected (per script).
 */
export function buildNeedsBpoCouldntSignatureCompleteNote(
  path: DispositionPathStep[],
  clientName: string,
): string {
  const name = (clientName || "").trim() || "[Client Name]";
  const carrierSteps = path.filter(
    (s): s is Extract<DispositionPathStep, { kind: "carrier_multi" }> => s.kind === "carrier_multi",
  );
  const attempted = carrierSteps[0]?.carriers ?? [];
  const onlyAvail = carrierSteps[1]?.carriers ?? [];
  if (attempted.length === 0) return "";

  const forPart = attempted.length === 1 ? attempted[0] : String(attempted.length);
  const line1 =
    attempted.length === 1
      ? `${name} couldn't complete the signature for ${forPart} carrier.`
      : `${name} couldn't complete the signature for ${forPart} carriers.`;

  const attemptedLine =
    attempted.length > 1 ? `Carrier(s) attempted: ${attempted.join(", ")}` : "";

  const textsStep = path.find(
    (s): s is Extract<DispositionPathStep, { kind: "choice" }> =>
      s.kind === "choice" && s.node_key === "nbpo_sig_couldnt_texts_yn",
  );
  const textsLine =
    textsStep?.option_key === "texts_yes"
      ? `${name} can receive texts`
      : textsStep?.option_key === "texts_no"
        ? `${name} cannot receive texts`
        : "";

  const emailsStep = path.find(
    (s): s is Extract<DispositionPathStep, { kind: "choice" }> =>
      s.kind === "choice" && s.node_key === "nbpo_sig_couldnt_emails_yn",
  );
  const emailsLine =
    emailsStep?.option_key === "emails_yes"
      ? `${name} can receive emails`
      : emailsStep?.option_key === "emails_no"
        ? `${name} cannot receive emails`
        : "";

  const onlyStr =
    onlyAvail.length > 0 ? onlyAvail.join(", ") : "the applicable carrier(s)";
  const lineLast = `${name} will need to be attempted on ${onlyStr}.`;

  return [line1, attemptedLine, textsLine, emailsLine, lineLast].filter(Boolean).join("\n\n");
}

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

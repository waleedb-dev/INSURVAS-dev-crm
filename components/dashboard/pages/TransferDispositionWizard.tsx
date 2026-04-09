"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { T } from "@/lib/theme";
import type { DispositionFlowDefinition, DispositionPathStep } from "@/lib/dispositionFlowTypes";
import { applyDispositionTemplate, resolveTemplateKeyFromNode } from "@/lib/dispositionFlowRuntime";
import {
  TransferStyledSelect,
  transferFieldStyle,
  transferReadonlyFieldStyle,
  transferSelectLabelStyle,
} from "./TransferStyledSelect";

const cardStyle = {
  border: `1px solid ${T.border}`,
  borderRadius: 12,
  padding: 14,
  backgroundColor: T.pageBg,
} as const;

const stackStyle = { display: "flex", flexDirection: "column" as const, gap: 10 };

export type DispositionWizardPayload = {
  path: DispositionPathStep[];
  generated_note: string;
  manual_note: string;
  final_note: string;
  quick_tag_label: string | null;
  complete: boolean;
};

type Props = {
  flow: DispositionFlowDefinition;
  clientName: string;
  carrierOptions: string[];
  onPayloadChange: (p: DispositionWizardPayload) => void;
};

function lastQuickTagFromPath(path: DispositionPathStep[]): string | null {
  for (let i = path.length - 1; i >= 0; i--) {
    const s = path[i];
    if (s.kind === "choice" && s.quick_tag_label) return s.quick_tag_label;
  }
  return null;
}

function buildGeneratedFromTemplate(
  flow: DispositionFlowDefinition,
  templateKey: string,
  path: DispositionPathStep[],
  clientName: string,
): string {
  const body = flow.templates[templateKey] || "";
  if (!body) return "";
  const carrierStep = path.find((x) => x.kind === "carrier_multi");
  const lastChoice = [...path].reverse().find((x): x is Extract<DispositionPathStep, { kind: "choice" }> => x.kind === "choice");
  return applyDispositionTemplate(body, {
    client_name: clientName,
    carriers: carrierStep?.carriers.join(", "),
    field_label: lastChoice?.option_label,
  });
}

export default function TransferDispositionWizard({ flow, clientName, carrierOptions, onPayloadChange }: Props) {
  const onPayloadChangeRef = useRef(onPayloadChange);
  onPayloadChangeRef.current = onPayloadChange;

  const [path, setPath] = useState<DispositionPathStep[]>([]);
  const [currentNodeKey, setCurrentNodeKey] = useState(flow.root_node_key);
  const [carrierPick, setCarrierPick] = useState<string[]>([]);
  const [terminalManual, setTerminalManual] = useState("");
  const [pendingTemplateKey, setPendingTemplateKey] = useState<string | null>(null);
  const [pendingPathForTemplate, setPendingPathForTemplate] = useState<DispositionPathStep[]>([]);
  const [done, setDone] = useState(false);
  const [choiceSelectValue, setChoiceSelectValue] = useState("");
  const [carrierAddValue, setCarrierAddValue] = useState("");

  const pushPayload = useCallback(
    (p: DispositionWizardPayload) => {
      onPayloadChangeRef.current(p);
    },
    [],
  );

  useEffect(() => {
    setPath([]);
    setCurrentNodeKey(flow.root_node_key);
    setCarrierPick([]);
    setTerminalManual("");
    setPendingTemplateKey(null);
    setPendingPathForTemplate([]);
    setDone(false);
    setChoiceSelectValue("");
    setCarrierAddValue("");
    pushPayload({
      path: [],
      generated_note: "",
      manual_note: "",
      final_note: "",
      quick_tag_label: null,
      complete: false,
    });
  }, [flow.flow_key, flow.root_node_key, pushPayload]);

  const finish = useCallback(
    (nextPath: DispositionPathStep[], templateKey: string | null, manual: string) => {
      const gen = templateKey ? buildGeneratedFromTemplate(flow, templateKey, nextPath, clientName) : "";
      const man = manual.trim();
      const final = [gen, man].filter(Boolean).join("\n\n").trim();
      const qt = lastQuickTagFromPath(nextPath) || (man ? "Manual Note" : null);
      setPath(nextPath);
      setDone(true);
      setCurrentNodeKey(flow.root_node_key);
      pushPayload({
        path: nextPath,
        generated_note: gen,
        manual_note: man,
        final_note: final,
        quick_tag_label: qt,
        complete: true,
      });
    },
    [clientName, flow, pushPayload],
  );

  const currentNode = flow.nodes[currentNodeKey];

  const handleChoiceOption = (opt: (typeof currentNode)["options"][number]) => {
    if (!currentNode) return;
    const step: DispositionPathStep = {
      kind: "choice",
      node_key: currentNode.node_key,
      option_key: opt.option_key,
      option_label: opt.option_label,
      quick_tag_label: opt.quick_tag_label,
    };
    const nextPath = [...path, step];

    if (opt.next_node_key) {
      const nextNode = flow.nodes[opt.next_node_key];
      if (!nextNode) return;
      setPath(nextPath);
      setCurrentNodeKey(opt.next_node_key);
      setCarrierPick([]);
      setTerminalManual("");
      setDone(false);
      pushPayload({
        path: nextPath,
        generated_note: "",
        manual_note: "",
        final_note: "",
        quick_tag_label: lastQuickTagFromPath(nextPath),
        complete: false,
      });
      return;
    }

    if (opt.template_key && opt.requires_manual_note) {
      setPath(nextPath);
      setPendingTemplateKey(opt.template_key);
      setPendingPathForTemplate(nextPath);
      setTerminalManual("");
      setCurrentNodeKey("__template_and_manual__");
      setDone(false);
      pushPayload({
        path: nextPath,
        generated_note: buildGeneratedFromTemplate(flow, opt.template_key!, nextPath, clientName),
        manual_note: "",
        final_note: "",
        quick_tag_label: lastQuickTagFromPath(nextPath),
        complete: false,
      });
      return;
    }

    if (opt.template_key) {
      finish(nextPath, opt.template_key, "");
      return;
    }

    if (opt.requires_manual_note) {
      setPath(nextPath);
      setTerminalManual("");
      setCurrentNodeKey("__manual_only__");
      setDone(false);
      pushPayload({
        path: nextPath,
        generated_note: "",
        manual_note: "",
        final_note: "",
        quick_tag_label: opt.quick_tag_label || lastQuickTagFromPath(nextPath),
        complete: false,
      });
      return;
    }
  };

  const handleCarrierConfirm = () => {
    if (!currentNode || currentNode.node_type !== "carrier_multi") return;
    if (carrierPick.length === 0) return;
    const step: DispositionPathStep = { kind: "carrier_multi", node_key: currentNode.node_key, carriers: carrierPick };
    const nextPath = [...path, step];
    const tmpl = resolveTemplateKeyFromNode(flow, currentNode.node_key);
    finish(nextPath, tmpl, "");
  };

  const handleTextNodeDone = () => {
    if (!currentNode || currentNode.node_type !== "text") return;
    const text = terminalManual.trim();
    if (!text) return;
    const step: DispositionPathStep = { kind: "text", node_key: currentNode.node_key, manual_text: text };
    const nextPath = [...path, step];
    finish(nextPath, null, text);
  };

  const handleManualOnlyDone = () => {
    const text = terminalManual.trim();
    if (!text) return;
    finish(path, null, text);
  };

  const handleTemplateAndManualDone = () => {
    const text = terminalManual.trim();
    if (!text || !pendingTemplateKey) return;
    finish(pendingPathForTemplate, pendingTemplateKey, text);
    setPendingTemplateKey(null);
    setPendingPathForTemplate([]);
  };

  const reset = () => {
    setPath([]);
    setCurrentNodeKey(flow.root_node_key);
    setCarrierPick([]);
    setTerminalManual("");
    setPendingTemplateKey(null);
    setPendingPathForTemplate([]);
    setDone(false);
    setChoiceSelectValue("");
    setCarrierAddValue("");
    pushPayload({
      path: [],
      generated_note: "",
      manual_note: "",
      final_note: "",
      quick_tag_label: null,
      complete: false,
    });
  };

  useEffect(() => {
    setChoiceSelectValue("");
    setCarrierAddValue("");
  }, [currentNodeKey]);

  const lockedPathSteps = useMemo(() => {
    return path.map((step, index) => {
      if (step.kind === "choice") {
        const nodeLabel = flow.nodes[step.node_key]?.node_label ?? "Choice";
        return (
          <div key={`${step.node_key}-${step.option_key}-${index}`}>
            <label style={transferSelectLabelStyle}>{nodeLabel}</label>
            <TransferStyledSelect
              disabled
              value={step.option_key}
              onValueChange={() => {}}
              options={[{ value: step.option_key, label: step.option_label }]}
              placeholder=""
            />
          </div>
        );
      }
      if (step.kind === "carrier_multi") {
        const nodeLabel = flow.nodes[step.node_key]?.node_label ?? "Carriers";
        const summary = step.carriers.length ? step.carriers.join(", ") : "—";
        return (
          <div key={`${step.node_key}-carriers-${index}`}>
            <label style={transferSelectLabelStyle}>{nodeLabel}</label>
            <TransferStyledSelect
              disabled
              value="__locked__"
              onValueChange={() => {}}
              options={[{ value: "__locked__", label: summary }]}
              placeholder=""
            />
          </div>
        );
      }
      if (step.kind === "text") {
        const nodeLabel = flow.nodes[step.node_key]?.node_label ?? "Details";
        return (
          <div key={`${step.node_key}-text-${index}`}>
            <label style={transferSelectLabelStyle}>{nodeLabel}</label>
            <div
              style={{
                ...transferReadonlyFieldStyle,
                whiteSpace: "pre-wrap",
                height: "auto",
                minHeight: 42,
                alignItems: "flex-start",
                paddingTop: 10,
                paddingBottom: 10,
              }}
            >
              {step.manual_text}
            </div>
          </div>
        );
      }
      return null;
    });
  }, [path, flow]);

  const header = useMemo(
    () => (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: T.textDark }}>Disposition detail</span>
        <button
          type="button"
          onClick={reset}
          style={{
            border: `1.5px solid ${T.border}`,
            background: "#fff",
            borderRadius: 8,
            padding: "6px 10px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            color: T.textMuted,
          }}
        >
          Clear
        </button>
      </div>
    ),
    [],
  );

  if (done) {
    return (
      <div style={cardStyle}>
        {header}
        <div style={stackStyle}>
          {lockedPathSteps}
          <div
            style={{
              border: `1px solid ${T.borderLight}`,
              borderRadius: 10,
              padding: 12,
              backgroundColor: "#f0fdf4",
            }}
          >
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#166534" }}>
              Disposition detail saved to notes below. Clear to choose a different path.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (currentNodeKey === "__template_and_manual__" && pendingTemplateKey) {
    const preview = buildGeneratedFromTemplate(flow, pendingTemplateKey, pendingPathForTemplate, clientName);
    return (
      <div style={cardStyle}>
        {header}
        <div style={stackStyle}>
          {lockedPathSteps}
          <div>
            <label style={transferSelectLabelStyle}>Generated note</label>
            <div
              style={{
                ...transferReadonlyFieldStyle,
                whiteSpace: "pre-wrap",
                height: "auto",
                minHeight: 42,
                alignItems: "flex-start",
                paddingTop: 10,
                paddingBottom: 10,
              }}
            >
              {preview || "(no template body)"}
            </div>
          </div>
          <div>
            <label style={transferSelectLabelStyle}>Required manual detail *</label>
            <textarea
              rows={4}
              value={terminalManual}
              onChange={(e) => setTerminalManual(e.target.value)}
              placeholder="Add required context (signature details, carriers, SMS/email, etc.)…"
              style={{ ...transferFieldStyle, minHeight: 88, resize: "vertical" as const, marginBottom: 0 }}
            />
          </div>
          <button
            type="button"
            disabled={!terminalManual.trim()}
            onClick={handleTemplateAndManualDone}
            style={{
              border: "none",
              alignSelf: "flex-start",
              backgroundColor: terminalManual.trim() ? T.blue : T.border,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: terminalManual.trim() ? "pointer" : "not-allowed",
            }}
          >
            Apply to notes
          </button>
        </div>
      </div>
    );
  }

  if (currentNodeKey === "__manual_only__") {
    return (
      <div style={cardStyle}>
        {header}
        <div style={stackStyle}>
          {lockedPathSteps}
          <div>
            <label style={transferSelectLabelStyle}>Manual note required</label>
            <textarea
              rows={4}
              value={terminalManual}
              onChange={(e) => setTerminalManual(e.target.value)}
              placeholder="Describe what happened…"
              style={{ ...transferFieldStyle, minHeight: 88, resize: "vertical" as const, marginBottom: 0 }}
            />
          </div>
          <button
            type="button"
            disabled={!terminalManual.trim()}
            onClick={handleManualOnlyDone}
            style={{
              border: "none",
              alignSelf: "flex-start",
              backgroundColor: terminalManual.trim() ? T.blue : T.border,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: terminalManual.trim() ? "pointer" : "not-allowed",
            }}
          >
            Apply to notes
          </button>
        </div>
      </div>
    );
  }

  if (!currentNode) return null;

  if (currentNode.node_type === "choice") {
    return (
      <div style={cardStyle}>
        {header}
        <div style={stackStyle}>
          {lockedPathSteps}
          <div>
            <label style={transferSelectLabelStyle}>{currentNode.node_label}</label>
            <TransferStyledSelect
              key={currentNode.node_key}
              value={choiceSelectValue}
              onValueChange={(key) => {
                if (!key) return;
                const opt = currentNode.options.find((o) => o.option_key === key);
                if (opt) handleChoiceOption(opt);
                setChoiceSelectValue("");
              }}
              options={currentNode.options.map((opt) => ({
                value: opt.option_key,
                label: opt.option_label,
              }))}
              placeholder="Select an option…"
            />
          </div>
        </div>
      </div>
    );
  }

  if (currentNode.node_type === "carrier_multi") {
    const availableCarriers = carrierOptions.filter((c) => !carrierPick.includes(c));
    return (
      <div style={cardStyle}>
        {header}
        <div style={stackStyle}>
          {lockedPathSteps}
          <div>
            <label style={transferSelectLabelStyle}>{currentNode.node_label}</label>
            {carrierOptions.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
                No carriers in the list. Pick a carrier in the main form first, or contact admin.
              </p>
            ) : availableCarriers.length === 0 ? (
              <div style={{ ...transferReadonlyFieldStyle, color: T.textMuted, fontWeight: 600 }}>
                All carriers selected — press Continue
              </div>
            ) : (
              <TransferStyledSelect
                key={`${currentNode.node_key}-add`}
                value={carrierAddValue}
                onValueChange={(v) => {
                  if (!v) return;
                  setCarrierPick((prev) => (prev.includes(v) ? prev : [...prev, v]));
                  setCarrierAddValue("");
                }}
                options={availableCarriers.map((c) => ({ value: c, label: c }))}
                placeholder="Select carrier to add…"
              />
            )}
            {carrierPick.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {carrierPick.map((c) => (
                  <span
                    key={c}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 10px",
                      borderRadius: 8,
                      backgroundColor: "#EEF5EE",
                      border: `1px solid ${T.borderLight}`,
                      fontSize: 14,
                      fontWeight: 600,
                      color: T.textDark,
                      fontFamily: T.font,
                    }}
                  >
                    {c}
                    <button
                      type="button"
                      aria-label={`Remove ${c}`}
                      onClick={() => setCarrierPick((prev) => prev.filter((x) => x !== c))}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        fontSize: 16,
                        lineHeight: 1,
                        color: T.textMuted,
                        fontWeight: 800,
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={carrierPick.length === 0}
            onClick={handleCarrierConfirm}
            style={{
              border: "none",
              alignSelf: "flex-start",
              backgroundColor: carrierPick.length > 0 ? T.blue : T.border,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: carrierPick.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (currentNode.node_type === "text") {
    const disclaimer =
      typeof currentNode.metadata?.disclaimer === "string" ? currentNode.metadata.disclaimer.trim() : "";
    const placeholderRaw =
      typeof currentNode.metadata?.placeholder === "string" ? currentNode.metadata.placeholder.trim() : "";
    const textPlaceholder = placeholderRaw
      ? applyDispositionTemplate(placeholderRaw, { client_name: clientName })
      : "";

    return (
      <div style={cardStyle}>
        {header}
        <div style={stackStyle}>
          {lockedPathSteps}
          {disclaimer ? (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: T.textMuted,
                lineHeight: 1.45,
                fontStyle: "italic",
              }}
            >
              {disclaimer}
            </p>
          ) : null}
          <div>
            <label style={transferSelectLabelStyle}>{currentNode.node_label}</label>
            <textarea
              rows={4}
              value={terminalManual}
              onChange={(e) => setTerminalManual(e.target.value)}
              placeholder={textPlaceholder || undefined}
              style={{ ...transferFieldStyle, minHeight: 88, resize: "vertical" as const, marginBottom: 0 }}
            />
          </div>
          <button
            type="button"
            disabled={!terminalManual.trim()}
            onClick={handleTextNodeDone}
            style={{
              border: "none",
              alignSelf: "flex-start",
              backgroundColor: terminalManual.trim() ? T.blue : T.border,
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 700,
              cursor: terminalManual.trim() ? "pointer" : "not-allowed",
            }}
          >
            Apply to notes
          </button>
        </div>
      </div>
    );
  }

  return null;
}

"use client";

import { useState, useCallback } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { T } from "@/lib/theme";

const MONITORING_TOOLS = [
  {
    name: "Aircall",
    url: "https://dashboard.aircall.io/live_monitoring",
  },
  {
    name: "CloudTalk",
    url: "https://analytics.cloudtalk.io/",
  },
] as const;

type ToolName = (typeof MONITORING_TOOLS)[number]["name"];

const initialRefreshKeys: Record<ToolName, number> = {
  Aircall: 0,
  CloudTalk: 0,
};

export default function LiveMonitoringPage() {
  const [iframeReloadKey, setIframeReloadKey] = useState<Record<ToolName, number>>(initialRefreshKeys);

  const refreshEmbedding = useCallback((name: ToolName) => {
    setIframeReloadKey((prev) => ({ ...prev, [name]: (prev[name] ?? 0) + 1 }));
  }, []);

  return (
    <div
      style={{
        fontFamily: T.font,
        minHeight: "calc(100vh - 68px)",
        padding: 20,
        background: T.pageBg,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))",
          gap: 16,
          height: "calc(100vh - 108px)",
          minHeight: 748,
        }}
      >
        {MONITORING_TOOLS.map((tool) => (
          <section
            key={tool.name}
            style={{
              display: "flex",
              flexDirection: "column",
              minWidth: 0,
              minHeight: 0,
              overflow: "hidden",
              border: `1px solid ${T.borderLight}`,
              borderRadius: 8,
              background: T.cardBg,
              boxShadow: "0 12px 28px rgba(35, 50, 23, 0.08)",
            }}
          >
            <div
              style={{
                height: 48,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "0 14px 0 16px",
                borderBottom: `1px solid ${T.borderLight}`,
                background: "#f8fbf5",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 15,
                  fontWeight: 800,
                  color: T.textDark,
                  lineHeight: 1.2,
                }}
              >
                {tool.name}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => refreshEmbedding(tool.name)}
                  title={`Reload ${tool.name} embedding`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#233217",
                    background: "#eef5ee",
                    border: `1px solid ${T.borderLight}`,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <RefreshCw size={16} strokeWidth={2.2} />
                </button>
                <a
                  href={tool.url}
                  target="_blank"
                  rel="noreferrer"
                  title={`Open ${tool.name} in a new tab`}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 8,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#233217",
                    background: "#eef5ee",
                    border: `1px solid ${T.borderLight}`,
                    flexShrink: 0,
                  }}
                >
                  <ExternalLink size={16} strokeWidth={2.2} />
                </a>
              </div>
            </div>
            <iframe
              key={`${tool.name}-${iframeReloadKey[tool.name] ?? 0}`}
              title={`${tool.name} live monitoring`}
              src={tool.url}
              allow={tool.name === "CloudTalk" ? "microphone *" : undefined}
              referrerPolicy="strict-origin-when-cross-origin"
              style={{
                flex: 1,
                width: "100%",
                minHeight: tool.name === "CloudTalk" ? 700 : 0,
                border: 0,
                background: "#ffffff",
              }}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

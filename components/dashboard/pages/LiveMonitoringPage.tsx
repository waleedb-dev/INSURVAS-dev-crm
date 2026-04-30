"use client";

import { useState, useCallback } from "react";
import { ExternalLink, RefreshCw, ChevronDown } from "lucide-react";
import { T } from "@/lib/theme";
import QueueManagementPage from "@/components/dashboard/pages/QueueManagementPage";

const AIRCALL_TOOL = {
  name: "Aircall" as const,
  url: "https://dashboard.aircall.io/live_monitoring",
};

type AircallToolName = typeof AIRCALL_TOOL.name;

export default function LiveMonitoringPage() {
  const [aircallReloadKey, setAircallReloadKey] = useState(0);
  const [queuePanelOpen, setQueuePanelOpen] = useState(true);
  const [queueRemountKey, setQueueRemountKey] = useState(0);

  const refreshAircall = useCallback(() => {
    setAircallReloadKey((k) => k + 1);
  }, []);

  const refreshQueueManagement = useCallback(() => {
    setQueueRemountKey((k) => k + 1);
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
        <section
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
              {AIRCALL_TOOL.name}
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => refreshAircall()}
                title={`Reload ${AIRCALL_TOOL.name} embedding`}
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
                href={AIRCALL_TOOL.url}
                target="_blank"
                rel="noreferrer"
                title={`Open ${AIRCALL_TOOL.name} in a new tab`}
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
            key={`${AIRCALL_TOOL.name}-${aircallReloadKey}`}
            title={`${AIRCALL_TOOL.name} live monitoring`}
            src={AIRCALL_TOOL.url}
            referrerPolicy="strict-origin-when-cross-origin"
            style={{
              flex: 1,
              width: "100%",
              minHeight: 0,
              border: 0,
              background: "#ffffff",
            }}
          />
        </section>

        <section
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
              minHeight: 48,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 14px 8px 12px",
              borderBottom: queuePanelOpen ? `1px solid ${T.borderLight}` : "none",
              background: "#f8fbf5",
            }}
          >
            <button
              type="button"
              onClick={() => setQueuePanelOpen((v) => !v)}
              title={queuePanelOpen ? "Collapse Queue Management" : "Expand Queue Management"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "4px 4px 4px 0",
                textAlign: "left",
                flex: 1,
                minWidth: 0,
              }}
            >
              <ChevronDown
                size={20}
                strokeWidth={2.2}
                style={{
                  flexShrink: 0,
                  color: "#233217",
                  transform: queuePanelOpen ? "rotate(0deg)" : "rotate(-90deg)",
                  transition: "transform 0.2s ease",
                }}
              />
              <div style={{ minWidth: 0 }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: 15,
                    fontWeight: 800,
                    color: T.textDark,
                    lineHeight: 1.2,
                  }}
                >
                  Queue Management
                </h2>
                <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, color: T.textMuted }}>
                  Same queue controls as the main widget
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => refreshQueueManagement()}
              title="Reload Queue Management data"
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
                flexShrink: 0,
              }}
            >
              <RefreshCw size={16} strokeWidth={2.2} />
            </button>
          </div>
          {queuePanelOpen && (
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                padding: "8px 10px 12px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <QueueManagementPage key={queueRemountKey} variant="liveMonitoringEmbed" />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

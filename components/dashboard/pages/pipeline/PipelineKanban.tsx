"use client";

import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui";
import { T } from "@/lib/theme";

export type PipelineKanbanColumn = {
  id: string | number;
  title: string;
  count: number;
  value: string;
  color: string;
  bg: string;
  cards: ReactNode;
};

function formatCountLabel(count: number): string {
  return `${count} ${count === 1 ? "Opportunity" : "Opportunities"}`;
}

export function PipelineKanban({
  columns,
  emptyTitle = "No opportunities found",
  emptyDescription = "Try changing your search or filters.",
}: {
  columns: PipelineKanbanColumn[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const totalCards = columns.reduce((sum, column) => sum + column.count, 0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCollapse = (id: PipelineKanbanColumn["id"]) => {
    const key = String(id);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (totalCards === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <style>{`
        .pipeline-kanban-container {
          background-color: transparent;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }
        .pipeline-kanban-board {
          display: flex;
          gap: 16px;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 8px 4px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: ${T.border} transparent;
        }
        .pipeline-kanban-board::-webkit-scrollbar { height: 6px; }
        .pipeline-kanban-board::-webkit-scrollbar-track { background: transparent; }
        .pipeline-kanban-board::-webkit-scrollbar-thumb { background-color: #c8d4bb; border-radius: 10px; }
        .pipeline-kanban-column {
          min-width: 320px;
          width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background-color: #fff;
          border: 1px solid ${T.border};
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          height: 100%;
          transition: width 0.2s ease;
        }
        .pipeline-kanban-column-body {
          overflow-y: auto;
          max-height: calc(100vh - 280px);
          min-height: 400px;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background-color: #fafcf8;
        }
        .pipeline-kanban-empty-stage {
          flex: 1;
          min-height: 260px;
          border: 1px dashed ${T.border};
          border-radius: 10px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          text-align: center;
          color: ${T.textMuted};
          font-size: 12px;
          font-weight: 700;
        }
        .pipeline-kanban-column-body::-webkit-scrollbar { width: 6px; }
        .pipeline-kanban-column-body::-webkit-scrollbar-track { background: transparent; }
        .pipeline-kanban-column-body::-webkit-scrollbar-thumb { background-color: #b8c9a8; border-radius: 6px; }
        .pipeline-kanban-column-body::-webkit-scrollbar-thumb:hover { background-color: #233217; }
      `}</style>

      <div className="pipeline-kanban-container">
        <div className="pipeline-kanban-board">
          {columns.map((column) => {
            const isCollapsed = collapsed[String(column.id)];
            return (
              <section
                key={column.id}
                className="pipeline-kanban-column"
                style={{
                  minWidth: isCollapsed ? 50 : 320,
                  width: isCollapsed ? 50 : 320,
                }}
              >
                {isCollapsed ? (
                  <div
                    style={{
                      backgroundColor: "#fff",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      padding: "16px 0",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      cursor: "pointer",
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleCollapse(column.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleCollapse(column.id);
                    }}
                    aria-label={`Expand ${column.title}`}
                  >
                    <div
                      style={{
                        backgroundColor: column.color,
                        color: "#fff",
                        borderRadius: 10,
                        padding: "2px 7px",
                        fontSize: 11,
                        fontWeight: 800,
                        marginBottom: 16,
                      }}
                    >
                      {column.count}
                    </div>
                    <div
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        fontSize: 13,
                        fontWeight: 800,
                        color: column.color,
                        letterSpacing: 0.3,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {column.title}
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        background: `linear-gradient(180deg, ${column.bg} 0%, #ffffff 88%)`,
                        padding: "12px 16px",
                        borderTop: `4px solid ${column.color}`,
                        borderBottom: `1px solid ${T.borderLight}`,
                        borderRadius: "12px 12px 0 0",
                        flexShrink: 0,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: T.textDark, lineHeight: 1.25 }}>
                          {column.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCollapse(column.id)}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            color: T.textMuted,
                          }}
                          aria-label={`Collapse ${column.title}`}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M15 18l-6-6 6-6" />
                          </svg>
                        </button>
                      </div>
                      <div style={{ marginTop: 4, display: "flex", gap: 12, fontSize: 12 }}>
                        <span style={{ color: T.textMuted, fontWeight: 600 }}>{formatCountLabel(column.count)}</span>
                        <span style={{ color: T.textDark, fontWeight: 800 }}>{column.value}</span>
                      </div>
                    </div>
                    <div className="pipeline-kanban-column-body">
                      {column.count === 0 ? (
                        <div className="pipeline-kanban-empty-stage">No opportunities in this stage yet.</div>
                      ) : (
                        column.cards
                      )}
                    </div>
                  </>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

const STEPS = [
    { label: "Valid your phone" },
    { label: "Tell about yourself" },
    { label: "Tell about your company" },
    { label: "Invite Team Members" },
];

interface SignupSidebarProps {
    currentStep: number; // 1-indexed
}

export function SignupSidebar({ currentStep }: SignupSidebarProps) {
    return (
        /* Outer: #eef2f7 column with the rounded blue card inside */
        <div
            style={{
                width: 340,
                flexShrink: 0,
                backgroundColor: "#eef2f7",
                display: "flex",
                alignItems: "stretch",
                padding: "24px 20px 24px 24px",
            }}
        >
            {/* Blue card */}
            <div
                style={{
                    flex: 1,
                    backgroundColor: "#4285f4",
                    borderRadius: 20,
                    padding: "36px 28px",
                    display: "flex",
                    flexDirection: "column",
                }}
            >
                {/* Logo icon */}
                <div style={{ marginBottom: 40 }}>
                    <div
                        style={{
                            width: 52,
                            height: 52,
                            backgroundColor: "white",
                            borderRadius: 14,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                        }}
                    >
                        <svg width="28" height="28" viewBox="0 0 26 26" fill="none">
                            <path
                                d="M10.5 4C10.5 2.895 11.395 2 12.5 2H13.5C14.605 2 15.5 2.895 15.5 4V5H18.5C19.605 5 20.5 5.895 20.5 7V10H21.5C22.605 10 23.5 10.895 23.5 12V13C23.5 14.105 22.605 15 21.5 15H20.5V18C20.5 19.105 19.605 20 18.5 20H15.5V21C15.5 22.105 14.605 23 13.5 23H12.5C11.395 23 10.5 22.105 10.5 21V20H7.5C6.395 20 5.5 19.105 5.5 18V15H4.5C3.395 15 2.5 14.105 2.5 13V12C2.5 10.895 3.395 10 4.5 10H5.5V7C5.5 5.895 6.395 5 7.5 5H10.5V4Z"
                                fill="#4285f4"
                            />
                        </svg>
                    </div>
                </div>

                {/* "Get started" heading */}
                <div
                    style={{
                        color: "white",
                        fontSize: 28,
                        fontWeight: 800,
                        marginBottom: 32,
                        lineHeight: 1.2,
                    }}
                >
                    Get started
                </div>

                {/* Steps list */}
                <div style={{ display: "flex", flexDirection: "column" }}>
                    {STEPS.map((step, idx) => {
                        const stepNum = idx + 1;
                        const isCompleted = stepNum < currentStep;
                        const isCurrent = stepNum === currentStep;

                        return (
                            <div key={idx}>
                                {/* Row: circle + label */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                    {/* Circle */}
                                    <div
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: "50%",
                                            border: isCompleted
                                                ? "none"
                                                : `2px solid ${isCurrent ? "white" : "rgba(255,255,255,0.45)"}`,
                                            backgroundColor: isCompleted ? "white" : "transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                            transition: "all 0.25s",
                                        }}
                                    >
                                        {isCompleted && (
                                            <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                                                <path
                                                    d="M1.5 5.5L5 9L11.5 2"
                                                    stroke="#4285f4"
                                                    strokeWidth="2.2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </div>

                                    {/* Label */}
                                    <span
                                        style={{
                                            fontSize: 14,
                                            fontWeight: isCurrent || isCompleted ? 700 : 500,
                                            color:
                                                isCurrent || isCompleted
                                                    ? "white"
                                                    : "rgba(255,255,255,0.5)",
                                            transition: "all 0.25s",
                                        }}
                                    >
                                        {step.label}
                                    </span>
                                </div>

                                {/* Vertical connector line */}
                                {idx < STEPS.length - 1 && (
                                    <div
                                        style={{
                                            width: 2,
                                            height: 32,
                                            backgroundColor: "rgba(255,255,255,0.3)",
                                            marginLeft: 13,
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

"use client";

import { WoorkroomLogoIcon } from "./Logo";

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
        <div className="w-[300px] flex-shrink-0 bg-[#4285f4] p-10 flex flex-col h-screen">
            {/* Logo */}
            <div className="mb-10">
                <WoorkroomLogoIcon />
            </div>

            {/* Get started text */}
            <h2 className="text-white text-2xl font-extrabold mb-8 leading-tight">
                Get started
            </h2>

            {/* Steps */}
            <div className="flex flex-col gap-0">
                {STEPS.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isCompleted = stepNum < currentStep;
                    const isCurrent = stepNum === currentStep;
                    const isDisabled = stepNum > currentStep;

                    return (
                        <div key={idx} className="flex flex-col">
                            {/* Step row */}
                            <div className="flex items-center gap-3">
                                {/* Circle */}
                                <div
                                    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-300 ${isCompleted
                                        ? "bg-white border-white"
                                        : isCurrent
                                            ? "bg-transparent border-white"
                                            : "bg-transparent border-white/50"
                                        }`}
                                >
                                    {isCompleted ? (
                                        <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
                                            <path
                                                d="M1.5 5.5L5 9L11.5 2"
                                                stroke="#4285f4"
                                                strokeWidth="2.2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </svg>
                                    ) : null}
                                </div>

                                {/* Label */}
                                <span
                                    className={`text-sm font-semibold transition-all duration-300 ${isCurrent
                                        ? "text-white"
                                        : isCompleted
                                            ? "text-white"
                                            : "text-white/50"
                                        }`}
                                >
                                    {step.label}
                                </span>
                            </div>

                            {/* Vertical connector */}
                            {idx < STEPS.length - 1 && (
                                <div className="ml-[13px] w-0.5 h-8 bg-white/30 flex-shrink-0" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

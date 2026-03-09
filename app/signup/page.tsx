"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { SignupSidebar } from "@/components/SignupSidebar";

// ─── Shared styles ─────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#6b7280",
    marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 16px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 14,
    color: "#374151",
    fontFamily: "inherit",
    backgroundColor: "white",
    outline: "none",
    boxSizing: "border-box",
};

const inputFocusStyle: React.CSSProperties = {
    border: "2px solid #4285f4",
};

const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 40px 13px 16px",
    border: "1.5px solid #e5e7eb",
    borderRadius: 12,
    fontSize: 14,
    color: "#374151",
    fontFamily: "inherit",
    backgroundColor: "white",
    outline: "none",
    appearance: "none" as const,
    cursor: "pointer",
};

// ─── Step Header ────────────────────────────────────────────────────────────
function StepHeader({ step, title }: { step: number; title: string }) {
    return (
        <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#4285f4",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: 6,
                }}
            >
                STEP {step}/4
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>
                {title}
            </h2>
        </div>
    );
}

// ─── Dropdown wrapper ────────────────────────────────────────────────────────
function Select({ value, onChange, children }: {
    value: string;
    onChange: (v: string) => void;
    children: React.ReactNode;
}) {
    return (
        <div style={{ position: "relative" }}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={selectStyle}
            >
                {children}
            </select>
            <svg
                style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                width="14" height="14" viewBox="0 0 14 14" fill="none"
            >
                <path d="M2.5 5l4.5 4.5L11.5 5" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
}

// ─── Step 1: Validate your phone ────────────────────────────────────────────
function Step1({ onNext }: { onNext: () => void }) {
    const [phone, setPhone] = useState("345 567-23-56");
    const [countryCode, setCountryCode] = useState("+1");
    const [code, setCode] = useState(["1", "2", "3", "4"]);
    const [email, setEmail] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const inputRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
    ];

    const handleCodeChange = (idx: number, val: string) => {
        const digit = val.replace(/\D/g, "").slice(-1);
        const next = [...code];
        next[idx] = digit;
        setCode(next);
        if (digit && idx < 3) inputRefs[idx + 1].current?.focus();
    };

    const handleCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !code[idx] && idx > 0) {
            inputRefs[idx - 1].current?.focus();
        }
    };

    return (
        <>
            <StepHeader step={1} title="Valid your phone" />

            {/* Mobile Number */}
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Mobile Number</label>
                <div style={{ display: "flex", gap: 12 }}>
                    {/* Country code */}
                    <div style={{ position: "relative" }}>
                        <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            style={{
                                ...selectStyle,
                                width: "auto",
                                paddingRight: 36,
                                paddingLeft: 14,
                            }}
                        >
                            <option>+1</option>
                            <option>+44</option>
                            <option>+91</option>
                            <option>+61</option>
                        </select>
                        <svg
                            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                            width="12" height="12" viewBox="0 0 12 12" fill="none"
                        >
                            <path d="M2 4l4 4 4-4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    {/* Phone input — active/focused border */}
                    <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        style={{ ...inputStyle, flex: 1, border: "2px solid #4285f4" }}
                    />
                </div>
            </div>

            {/* Code from SMS */}
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Code from SMS</label>
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    {code.map((digit, idx) => (
                        <input
                            key={idx}
                            ref={inputRefs[idx]}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleCodeChange(idx, e.target.value)}
                            onKeyDown={(e) => handleCodeKeyDown(idx, e)}
                            style={{
                                width: 64,
                                height: 55,
                                textAlign: "center",
                                border: "1.5px solid #e5e7eb",
                                borderRadius: 12,
                                fontSize: 16,
                                fontWeight: 600,
                                color: "#374151",
                                fontFamily: "inherit",
                                outline: "none",
                            }}
                        />
                    ))}
                </div>

                {/* SMS info box */}
                <div
                    style={{
                        backgroundColor: "#eef2ff",
                        borderRadius: 14,
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                    }}
                >
                    <div
                        style={{
                            width: 24,
                            height: 24,
                            borderRadius: "50%",
                            backgroundColor: "#4285f4",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            marginTop: 1,
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M6 5v4M6 3.5V3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                    </div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#4285f4", margin: 0, lineHeight: 1.6 }}>
                        SMS was sent to your number +1 345 673-56-67<br />
                        It will be valid for 01:25
                    </p>
                </div>
            </div>

            {/* Email Address */}
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Email Address</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="youremail@gmail.com"
                    style={inputStyle}
                />
            </div>

            {/* Create Password */}
            <div>
                <label style={labelStyle}>Create Password</label>
                <div style={{ position: "relative" }}>
                    <input
                        type={showPassword ? "text" : "password"}
                        defaultValue="password123"
                        style={{ ...inputStyle, paddingRight: 48 }}
                    />
                    <button
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                            position: "absolute",
                            right: 14,
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#9ca3af",
                            padding: 0,
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                        </svg>
                    </button>
                </div>
            </div>
        </>
    );
}

// ─── Step 2: Tell about yourself ────────────────────────────────────────────
function Step2({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
    const [service, setService] = useState("Work");
    const [describes, setDescribes] = useState("Business Owner");
    const [newsletter, setNewsletter] = useState<"yes" | "no">("yes");

    return (
        <>
            <StepHeader step={2} title="Tell about yourself" />

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Why will you use the service?</label>
                <Select value={service} onChange={setService}>
                    <option>Work</option>
                    <option>Personal</option>
                    <option>Education</option>
                    <option>Other</option>
                </Select>
            </div>

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>What describes you best?</label>
                <Select value={describes} onChange={setDescribes}>
                    <option>Business Owner</option>
                    <option>Freelancer</option>
                    <option>Employee</option>
                    <option>Student</option>
                </Select>
            </div>

            {/* Radio row — label on left, Yes/No on right */}
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <label style={{ ...labelStyle, marginBottom: 0, flex: 1 }}>
                    What describes you best?
                </label>
                <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                    {(["yes", "no"] as const).map((val) => (
                        <label
                            key={val}
                            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                            onClick={() => setNewsletter(val)}
                        >
                            <div
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    border: newsletter === val ? "6px solid #4285f4" : "2px solid #d1d5db",
                                    transition: "all 0.15s",
                                }}
                            />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                                {val === "yes" ? "Yes" : "No"}
                            </span>
                        </label>
                    ))}
                </div>
            </div>
        </>
    );
}

// ─── Step 3: Tell about your company ────────────────────────────────────────
const TEAM_SIZES = ["Only me", "2 - 5", "6 - 10", "11-20", "21 - 40", "41 - 50", "51 - 100", "101 - 500"];

function Step3({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
    const [company, setCompany] = useState("");
    const [direction, setDirection] = useState("IT and programming");
    const [teamSize, setTeamSize] = useState("41 - 50");

    return (
        <>
            <StepHeader step={3} title="Tell about your company" />

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Your Company&apos;s Name</label>
                <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company's Name"
                    style={inputStyle}
                />
            </div>

            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Business Direction</label>
                <Select value={direction} onChange={setDirection}>
                    <option>IT and programming</option>
                    <option>Marketing</option>
                    <option>Design</option>
                    <option>Finance</option>
                    <option>Healthcare</option>
                    <option>Education</option>
                </Select>
            </div>

            <div>
                <label style={labelStyle}>How many people in your team?</label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {TEAM_SIZES.map((size) => (
                        <button
                            key={size}
                            onClick={() => setTeamSize(size)}
                            style={{
                                padding: "11px 8px",
                                borderRadius: 12,
                                border: teamSize === size ? "none" : "1.5px solid #e5e7eb",
                                backgroundColor: teamSize === size ? "#4285f4" : "white",
                                color: teamSize === size ? "white" : "#6b7280",
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "all 0.15s",
                                boxShadow: teamSize === size ? "0 4px 14px rgba(66,133,244,0.3)" : "none",
                            }}
                        >
                            {size}
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}

// ─── Step 4: Invite Team Members ─────────────────────────────────────────────
function Step4({ onNext, onPrev }: { onNext: () => void; onPrev: () => void }) {
    const [members, setMembers] = useState([""]);

    const addMember = () => setMembers([...members, ""]);
    const updateMember = (idx: number, val: string) => {
        const next = [...members];
        next[idx] = val;
        setMembers(next);
    };

    return (
        <>
            <StepHeader step={4} title="Invite Team Members" />

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {members.map((m, idx) => (
                    <div key={idx}>
                        <label style={labelStyle}>Member&apos;s Email</label>
                        <input
                            type="email"
                            value={m}
                            onChange={(e) => updateMember(idx, e.target.value)}
                            placeholder="memberemail@gmail.com"
                            style={inputStyle}
                        />
                    </div>
                ))}
            </div>

            <button
                onClick={addMember}
                style={{
                    marginTop: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#4285f4",
                    fontSize: 14,
                    fontWeight: 700,
                    padding: 0,
                    fontFamily: "inherit",
                }}
            >
                <div
                    style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: "2px solid #4285f4",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M5 2v6M2 5h6" stroke="#4285f4" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                </div>
                Add another Member
            </button>
        </>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SignupPage() {
    const [step, setStep] = useState(1);
    const router = useRouter();

    const goNext = () => {
        if (step < 4) setStep(step + 1);
        else router.push("/signup/success");
    };
    const goPrev = () => { if (step > 1) setStep(step - 1); };

    return (
        <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#eef2f7", overflow: "hidden" }}>

            {/* ── Main row: sidebar + content ─── */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* Sidebar */}
                <SignupSidebar currentStep={step} />

                {/* Content area */}
                <div
                    style={{
                        flex: 1,
                        backgroundColor: "#eef2f7",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "center",
                        overflowY: "auto",
                        padding: "32px 40px 0",
                    }}
                >
                    {/* White card */}
                    <div
                        style={{
                            backgroundColor: "white",
                            borderRadius: 20,
                            padding: "48px 56px",
                            width: "100%",
                            maxWidth: 680,
                            minHeight: "calc(100vh - 100px)",
                            boxSizing: "border-box",
                        }}
                    >
                        {step === 1 && <Step1 onNext={goNext} />}
                        {step === 2 && <Step2 onNext={goNext} onPrev={goPrev} />}
                        {step === 3 && <Step3 onNext={goNext} onPrev={goPrev} />}
                        {step === 4 && <Step4 onNext={goNext} onPrev={goPrev} />}
                    </div>
                </div>
            </div>

            {/* ── Bottom nav bar (outside the card) ─── */}
            <div
                style={{
                    backgroundColor: "#eef2f7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: step > 1 ? "space-between" : "flex-end",
                    padding: "16px 56px",
                    flexShrink: 0,
                }}
            >
                {step > 1 && (
                    <button
                        onClick={goPrev}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "#4285f4",
                            fontSize: 14,
                            fontWeight: 700,
                            fontFamily: "inherit",
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                        Previous
                    </button>
                )}

                <button
                    onClick={goNext}
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        backgroundColor: "#4285f4",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        padding: "13px 24px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 4px 14px rgba(66,133,244,0.35)",
                    }}
                >
                    Next Step
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

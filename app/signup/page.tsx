"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignupSidebar } from "@/components/SignupSidebar";

// ─── Step 1: Valid your phone ────────────────────────────────────────────────
function Step1({
    onNext,
}: {
    onNext: () => void;
}) {
    const [phone, setPhone] = useState("345 567-23-56");
    const [countryCode, setCountryCode] = useState("+1");
    const [code, setCode] = useState(["1", "2", "3", "4"]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("••••••••");
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
        <div className="flex-1 flex flex-col">
            {/* Step header */}
            <div className="text-center mb-8">
                <p className="text-[#4285f4] text-xs font-bold uppercase tracking-widest mb-1.5">
                    STEP 1/4
                </p>
                <h2 className="text-[#1a1a2e] text-2xl font-bold">Valid your phone</h2>
            </div>

            <div className="space-y-6">
                {/* Mobile Number */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Mobile Number
                    </label>
                    <div className="flex gap-3">
                        {/* Country code dropdown */}
                        <div className="relative">
                            <select
                                value={countryCode}
                                onChange={(e) => setCountryCode(e.target.value)}
                                className="appearance-none bg-white border border-[#e5e7eb] rounded-xl px-3.5 pr-8 py-3 text-[#374151] text-sm font-semibold focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all cursor-pointer h-[48px]"
                            >
                                <option value="+1">+1</option>
                                <option value="+44">+44</option>
                                <option value="+91">+91</option>
                                <option value="+61">+61</option>
                            </select>
                            <svg
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6b7280]"
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="none"
                            >
                                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        {/* Phone input */}
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="flex-1 px-4 py-3 border-2 border-[#4285f4] rounded-xl text-[#374151] text-sm font-normal focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200 h-[48px]"
                        />
                    </div>
                </div>

                {/* Code from SMS */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Code from SMS
                    </label>
                    <div className="flex gap-3">
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
                                className="w-14 h-14 text-center border border-[#e5e7eb] rounded-xl text-[#374151] text-base font-semibold focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200"
                            />
                        ))}
                    </div>

                    {/* SMS notice */}
                    <div className="mt-4 bg-[#eef2ff] rounded-xl p-4 flex items-start gap-3">
                        <div className="w-6 h-6 bg-[#4285f4] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M6 5v4M6 3.5V3" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        <p className="text-[#4285f4] text-xs font-semibold leading-relaxed">
                            SMS was sent to your number +1 345 673-56-67<br />
                            It will be valid for 01:25
                        </p>
                    </div>
                </div>

                {/* Email Address */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Email Address
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="youremail@gmail.com"
                        className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#374151] placeholder-[#9ca3af] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200 h-[48px]"
                    />
                </div>

                {/* Create Password */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Create Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#374151] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200 pr-12 h-[48px]"
                        />
                        <button
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Next Step button */}
            <div className="mt-auto pt-8 flex justify-end">
                <button
                    onClick={onNext}
                    className="bg-[#4285f4] text-white px-7 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#3574e2] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(66,133,244,0.35)]"
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

// ─── Step 2: Tell about yourself ────────────────────────────────────────────
function Step2({
    onNext,
    onPrev,
}: {
    onNext: () => void;
    onPrev: () => void;
}) {
    const [service, setService] = useState("Work");
    const [describes, setDescribes] = useState("Business Owner");
    const [newsletter, setNewsletter] = useState<"yes" | "no">("yes");

    return (
        <div className="flex-1 flex flex-col">
            {/* Step header */}
            <div className="text-center mb-8">
                <p className="text-[#4285f4] text-xs font-bold uppercase tracking-widest mb-1.5">
                    STEP 2/4
                </p>
                <h2 className="text-[#1a1a2e] text-2xl font-bold">Tell about yourself</h2>
            </div>

            <div className="space-y-6">
                {/* Why will you use the service */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Why will you use the service?
                    </label>
                    <div className="relative">
                        <select
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#e5e7eb] rounded-xl px-4 py-3 pr-10 text-[#374151] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all cursor-pointer h-[48px]"
                        >
                            <option>Work</option>
                            <option>Personal</option>
                            <option>Education</option>
                            <option>Other</option>
                        </select>
                        <svg
                            className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6b7280]"
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                        >
                            <path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                {/* What describes you best */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        What describes you best?
                    </label>
                    <div className="relative">
                        <select
                            value={describes}
                            onChange={(e) => setDescribes(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#e5e7eb] rounded-xl px-4 py-3 pr-10 text-[#374151] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all cursor-pointer h-[48px]"
                        >
                            <option>Business Owner</option>
                            <option>Freelancer</option>
                            <option>Employee</option>
                            <option>Student</option>
                        </select>
                        <svg
                            className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6b7280]"
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                        >
                            <path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                {/* Radio yes/no */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-3">
                        What describes you best?
                    </label>
                    <div className="flex items-center gap-8">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <div
                                onClick={() => setNewsletter("yes")}
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${newsletter === "yes"
                                    ? "border-[#4285f4]"
                                    : "border-[#d1d5db]"
                                    }`}
                            >
                                {newsletter === "yes" && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#4285f4]" />
                                )}
                            </div>
                            <span className="text-[#374151] text-sm font-semibold">Yes</span>
                        </label>
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <div
                                onClick={() => setNewsletter("no")}
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${newsletter === "no"
                                    ? "border-[#4285f4]"
                                    : "border-[#d1d5db]"
                                    }`}
                            >
                                {newsletter === "no" && (
                                    <div className="w-2.5 h-2.5 rounded-full bg-[#4285f4]" />
                                )}
                            </div>
                            <span className="text-[#374151] text-sm font-semibold">No</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="mt-auto pt-8 flex items-center justify-between">
                <button
                    onClick={onPrev}
                    className="text-[#4285f4] font-bold text-sm flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Previous
                </button>
                <button
                    onClick={onNext}
                    className="bg-[#4285f4] text-white px-7 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#3574e2] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(66,133,244,0.35)]"
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

// ─── Step 3: Tell about your company ────────────────────────────────────────
const TEAM_SIZES = [
    "Only me",
    "2 - 5",
    "6 - 10",
    "11-20",
    "21 - 40",
    "41 - 50",
    "51 - 100",
    "101 - 500",
];

function Step3({
    onNext,
    onPrev,
}: {
    onNext: () => void;
    onPrev: () => void;
}) {
    const [companyName, setCompanyName] = useState("");
    const [direction, setDirection] = useState("IT and programming");
    const [teamSize, setTeamSize] = useState("41 - 50");

    return (
        <div className="flex-1 flex flex-col">
            {/* Step header */}
            <div className="text-center mb-8">
                <p className="text-[#4285f4] text-xs font-bold uppercase tracking-widest mb-1.5">
                    STEP 3/4
                </p>
                <h2 className="text-[#1a1a2e] text-2xl font-bold">Tell about your company</h2>
            </div>

            <div className="space-y-6">
                {/* Company name */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Your Company&apos;s Name
                    </label>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Company's Name"
                        className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#374151] placeholder-[#9ca3af] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200 h-[48px]"
                    />
                </div>

                {/* Business Direction */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                        Business Direction
                    </label>
                    <div className="relative">
                        <select
                            value={direction}
                            onChange={(e) => setDirection(e.target.value)}
                            className="w-full appearance-none bg-white border border-[#e5e7eb] rounded-xl px-4 py-3 pr-10 text-[#374151] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all cursor-pointer h-[48px]"
                        >
                            <option>IT and programming</option>
                            <option>Marketing</option>
                            <option>Design</option>
                            <option>Finance</option>
                            <option>Healthcare</option>
                            <option>Education</option>
                        </select>
                        <svg
                            className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#6b7280]"
                            width="14"
                            height="14"
                            viewBox="0 0 14 14"
                            fill="none"
                        >
                            <path d="M2.5 5l4.5 4.5L11.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                </div>

                {/* Team size */}
                <div>
                    <label className="block text-[#6b7280] text-sm font-semibold mb-3">
                        How many people in your team?
                    </label>
                    <div className="grid grid-cols-4 gap-2.5">
                        {TEAM_SIZES.map((size) => (
                            <button
                                key={size}
                                onClick={() => setTeamSize(size)}
                                className={`py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200 ${teamSize === size
                                    ? "bg-[#4285f4] border-[#4285f4] text-white shadow-[0_4px_14px_rgba(66,133,244,0.35)]"
                                    : "bg-white border-[#e5e7eb] text-[#6b7280] hover:border-[#4285f4] hover:text-[#4285f4]"
                                    }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <div className="mt-auto pt-8 flex items-center justify-between">
                <button
                    onClick={onPrev}
                    className="text-[#4285f4] font-bold text-sm flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Previous
                </button>
                <button
                    onClick={onNext}
                    className="bg-[#4285f4] text-white px-7 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#3574e2] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(66,133,244,0.35)]"
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

// ─── Step 4: Invite Team Members ─────────────────────────────────────────────
function Step4({
    onNext,
    onPrev,
}: {
    onNext: () => void;
    onPrev: () => void;
}) {
    const [members, setMembers] = useState([""]);

    const addMember = () => setMembers([...members, ""]);
    const updateMember = (idx: number, val: string) => {
        const next = [...members];
        next[idx] = val;
        setMembers(next);
    };

    return (
        <div className="flex-1 flex flex-col">
            {/* Step header */}
            <div className="text-center mb-8">
                <p className="text-[#4285f4] text-xs font-bold uppercase tracking-widest mb-1.5">
                    STEP 4/4
                </p>
                <h2 className="text-[#1a1a2e] text-2xl font-bold">Invite Team Members</h2>
            </div>

            <div className="space-y-4">
                {members.map((member, idx) => (
                    <div key={idx}>
                        <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                            {idx === 0 ? "Member's Email" : `Member ${idx + 1}'s Email`}
                        </label>
                        <input
                            type="email"
                            value={member}
                            onChange={(e) => updateMember(idx, e.target.value)}
                            placeholder="memberemail@gmail.com"
                            className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#374151] placeholder-[#9ca3af] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200 h-[48px]"
                        />
                    </div>
                ))}

                <button
                    onClick={addMember}
                    className="flex items-center gap-2 text-[#4285f4] text-sm font-bold hover:opacity-80 transition-opacity mt-2"
                >
                    <div className="w-5 h-5 rounded-full border-2 border-[#4285f4] flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M5 2v6M2 5h6" stroke="#4285f4" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                    </div>
                    Add another Member
                </button>
            </div>

            {/* Navigation */}
            <div className="mt-auto pt-8 flex items-center justify-between">
                <button
                    onClick={onPrev}
                    className="text-[#4285f4] font-bold text-sm flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    Previous
                </button>
                <button
                    onClick={onNext}
                    className="bg-[#4285f4] text-white px-7 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-[#3574e2] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(66,133,244,0.35)]"
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

// ─── Main signup page ─────────────────────────────────────────────────────────
export default function SignupPage() {
    const [step, setStep] = useState(1);
    const router = useRouter();

    const goNext = () => {
        if (step < 4) setStep(step + 1);
        else router.push("/signup/success");
    };
    const goPrev = () => {
        if (step > 1) setStep(step - 1);
    };

    return (
        <div className="h-screen bg-white flex overflow-hidden">
            {/* Left sidebar */}
            <SignupSidebar currentStep={step} />

            {/* Right content area */}
            <div className="flex-1 flex flex-col p-16 bg-white overflow-y-auto">
                <div className="max-w-[540px] mx-auto w-full flex flex-col min-h-full">
                    {step === 1 && <Step1 onNext={goNext} />}
                    {step === 2 && <Step2 onNext={goNext} onPrev={goPrev} />}
                    {step === 3 && <Step3 onNext={goNext} onPrev={goPrev} />}
                    {step === 4 && <Step4 onNext={goNext} onPrev={goPrev} />}
                </div>
            </div>
        </div>
    );
}

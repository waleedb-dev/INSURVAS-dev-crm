"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#eef2f7" }}>
      {/* ── Left Panel ─────────────────────────────────────────── */}
      <div
        className="flex flex-col relative overflow-hidden"
        style={{
          width: "50%",
          backgroundColor: "#4285f4",
          padding: "48px 56px",
        }}
      >
        {/* Logo row */}
        <div className="flex items-center gap-3 mb-16">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 48,
              height: 48,
              backgroundColor: "white",
              borderRadius: 12,
            }}
          >
            {/* Puzzle icon */}
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path
                d="M10.5 4C10.5 2.895 11.395 2 12.5 2H13.5C14.605 2 15.5 2.895 15.5 4V5H18.5C19.605 5 20.5 5.895 20.5 7V10H21.5C22.605 10 23.5 10.895 23.5 12V13C23.5 14.105 22.605 15 21.5 15H20.5V18C20.5 19.105 19.605 20 18.5 20H15.5V21C15.5 22.105 14.605 23 13.5 23H12.5C11.395 23 10.5 22.105 10.5 21V20H7.5C6.395 20 5.5 19.105 5.5 18V15H4.5C3.395 15 2.5 14.105 2.5 13V12C2.5 10.895 3.395 10 4.5 10H5.5V7C5.5 5.895 6.395 5 7.5 5H10.5V4Z"
                fill="#4285f4"
              />
            </svg>
          </div>
          <span
            className="font-extrabold text-white"
            style={{ fontSize: 22, letterSpacing: "-0.3px" }}
          >
            Woorkroom
          </span>
        </div>

        {/* Tagline */}
        <div className="mb-8">
          <h1
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: 40 }}
          >
            Your place to work
          </h1>
          <h1
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: 40 }}
          >
            Plan. Create. Control.
          </h1>
        </div>

        {/* Illustration */}
        <div className="flex-1 flex items-end justify-center">
          <Image
            src="/Illustration.png"
            alt="Woorkroom workspace"
            width={420}
            height={360}
            className="object-contain w-full max-w-[420px]"
            priority
          />
        </div>
      </div>

      {/* ── Right Panel ────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ backgroundColor: "#eef2f7" }}
      >
        <div
          className="bg-white flex flex-col"
          style={{
            width: "100%",
            maxWidth: 460,
            padding: "48px 40px",
            borderRadius: 20,
            boxShadow: "0 4px 40px rgba(0,0,0,0.07)",
          }}
        >
          <h2
            className="font-bold text-center"
            style={{ fontSize: 22, color: "#1a1a2e", marginBottom: 32 }}
          >
            Sign In to Woorkroom
          </h2>

          {/* Email */}
          <div style={{ marginBottom: 20 }}>
            <label
              className="block font-semibold"
              style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}
            >
              Email Address
            </label>
            <input
              type="email"
              placeholder="youremail@gmail.com"
              style={{
                width: "100%",
                padding: "13px 16px",
                border: "1.5px solid #e5e7eb",
                borderRadius: 12,
                fontSize: 14,
                color: "#374151",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <label
              className="block font-semibold"
              style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}
            >
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                defaultValue="password123"
                style={{
                  width: "100%",
                  padding: "13px 48px 13px 16px",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 12,
                  fontSize: 14,
                  color: "#374151",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: "#9ca3af" }}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 24 }}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <div
                onClick={() => setRememberMe(!rememberMe)}
                className="flex items-center justify-center cursor-pointer"
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  border: rememberMe ? "none" : "2px solid #d1d5db",
                  backgroundColor: rememberMe ? "#4285f4" : "white",
                  transition: "all 0.15s",
                  flexShrink: 0,
                }}
              >
                {rememberMe && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                Remember me
              </span>
            </label>
            <button
              style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}
            >
              Forgot Password?
            </button>
          </div>

          {/* Sign In button */}
          <button
            className="flex items-center justify-center gap-2 font-bold"
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: "#4285f4",
              color: "white",
              borderRadius: 12,
              fontSize: 15,
              border: "none",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(66,133,244,0.35)",
              marginBottom: 16,
            }}
          >
            Sign In
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>

          {/* Sign up link */}
          <div className="text-center">
            <Link
              href="/signup"
              style={{ fontSize: 13, color: "#4285f4", fontWeight: 600 }}
            >
              Don&apos;t have an account?
            </Link>
          </div>
        </div>
      </div>
    </div >
  );
}

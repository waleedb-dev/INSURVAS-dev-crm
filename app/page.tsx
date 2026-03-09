"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

export default function SignInPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  return (
    <div className="min-h-screen bg-[#eef2f7] flex items-center justify-center p-4">
      <div className="w-full max-w-[900px] bg-white rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.08)] overflow-hidden flex">
        {/* Left panel */}
        <div className="w-[340px] flex-shrink-0 bg-[#4285f4] rounded-tl-2xl rounded-bl-2xl p-8 flex flex-col relative overflow-hidden">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M11 2C6.03 2 2 6.03 2 11s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16.2c-3.97 0-7.2-3.23-7.2-7.2S7.03 3.8 11 3.8s7.2 3.23 7.2 7.2-3.23 7.2-7.2 7.2zm0-12.6c-2.98 0-5.4 2.42-5.4 5.4s2.42 5.4 5.4 5.4 5.4-2.42 5.4-5.4S13.98 5.6 11 5.6zm0 8.4c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z"
                  fill="#4285f4"
                />
              </svg>
            </div>
            <span className="text-white text-xl font-bold">Woorkroom</span>
          </div>

          {/* Tagline */}
          <div className="mt-10">
            <h1 className="text-white text-3xl font-extrabold leading-tight mb-2">
              Your place to work
            </h1>
            <p className="text-white text-3xl font-extrabold leading-tight">
              Plan. Create. Control.
            </p>
          </div>

          {/* Illustration */}
          <div className="mt-6 flex justify-center">
            <div className="relative w-full max-w-[270px]">
              <Image
                src="/Illustration.png"
                alt="Woorkroom workspace illustration"
                width={270}
                height={240}
                className="object-contain drop-shadow-lg"
              />
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 p-12 flex flex-col justify-center">
          <h2 className="text-[#1a1a2e] text-2xl font-bold text-center mb-8">
            Sign In to Woorkroom
          </h2>

          <div className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                Email Address
              </label>
              <input
                type="email"
                placeholder="youremail@gmail.com"
                className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#374151] placeholder-[#9ca3af] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[#6b7280] text-sm font-semibold mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  defaultValue="password"
                  className="w-full px-4 py-3 border border-[#e5e7eb] rounded-xl text-[#374151] placeholder-[#9ca3af] text-sm font-normal focus:border-[#4285f4] focus:ring-2 focus:ring-[#4285f4]/20 transition-all duration-200 pr-12"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9ca3af] hover:text-[#6b7280] transition-colors"
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

            {/* Remember me + Forgot */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <div
                  onClick={() => setRememberMe(!rememberMe)}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all duration-200 cursor-pointer ${rememberMe
                      ? "bg-[#4285f4] border-[#4285f4]"
                      : "bg-white border-[#d1d5db]"
                    }`}
                >
                  {rememberMe && (
                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                      <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <span className="text-[#6b7280] text-sm font-semibold">Remember me</span>
              </label>
              <button className="text-[#9ca3af] text-sm font-semibold hover:text-[#4285f4] transition-colors">
                Forgot Password?
              </button>
            </div>

            {/* Sign In button */}
            <button className="w-full bg-[#4285f4] text-white py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 hover:bg-[#3574e2] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(66,133,244,0.35)] mt-2">
              Sign In
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>

            {/* Sign up link */}
            <div className="text-center pt-1">
              <Link
                href="/signup"
                className="text-[#4285f4] text-sm font-semibold hover:underline"
              >
                Don&apos;t have an account?
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

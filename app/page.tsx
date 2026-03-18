"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";

export default function SignInPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setErrorMessage(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });

    if (error || !data.user) {
      const message = error?.message ?? "Unable to sign in.";
      if (message.toLowerCase().includes("invalid login credentials")) {
        setErrorMessage("Invalid credentials. For newly created users, use lowercase first name + 123! (example: ahmed123!).");
      } else {
        setErrorMessage(message);
      }
      setIsSubmitting(false);
      return;
    }

    const role = await getCurrentUserPrimaryRole(supabase, data.user.id);

    setIsSubmitting(false);

    if (!role) {
      setErrorMessage("No role is assigned to this account. Contact admin.");
      return;
    }

    router.push(`/dashboard/${role}`);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f4f9fd" }}>
      <div
        className="hidden md:flex flex-col relative overflow-hidden items-center justify-center text-center"
        style={{
          width: "50%",
          backgroundColor: "#4285f4",
          padding: "48px 56px",
        }}
      >
        <div className="flex items-center justify-center gap-3 mb-12 w-full">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 56,
              height: 56,
              backgroundColor: "white",
              borderRadius: 14,
            }}
          >
            <svg width="30" height="30" viewBox="0 0 26 26" fill="none">
              <path
                d="M10.5 4C10.5 2.895 11.395 2 12.5 2H13.5C14.605 2 15.5 2.895 15.5 4V5H18.5C19.605 5 20.5 5.895 20.5 7V10H21.5C22.605 10 23.5 10.895 23.5 12V13C23.5 14.105 22.605 15 21.5 15H20.5V18C20.5 19.105 19.605 20 18.5 20H15.5V21C15.5 22.105 14.605 23 13.5 23H12.5C11.395 23 10.5 22.105 10.5 21V20H7.5C6.395 20 5.5 19.105 5.5 18V15H4.5C3.395 15 2.5 14.105 2.5 13V12C2.5 10.895 3.395 10 4.5 10H5.5V7C5.5 5.895 6.395 5 7.5 5H10.5V4Z"
                fill="#4285f4"
              />
            </svg>
          </div>
          <span
            className="font-extrabold text-white"
            style={{ fontSize: 26, letterSpacing: "-0.3px" }}
          >
            Orbito
          </span>
        </div>

        <div className="mb-12 w-full">
          <h1
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: 46 }}
          >
            Your place to work
          </h1>
          <h1
            className="font-extrabold text-white leading-tight"
            style={{ fontSize: 48 }}
          >
            Plan. Create. Control.
          </h1>
        </div>

        <div className="flex items-center justify-center w-full">
          <Image
            src="/Illustration.png"
            alt="Orbito workspace"
            width={420}
            height={360}
            className="object-contain w-full max-w-[420px]"
            priority
          />
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center px-4"
        style={{ backgroundColor: "#f4f9fd" }}
      >
        <form
          onSubmit={handleSignIn}
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
            Sign In to CRM Portal
          </h2>

          <div style={{ marginBottom: 20 }}>
            <label
              className="block font-semibold"
              style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}
            >
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
                type="button"
                onClick={() => setShowPassword((state) => !state)}
                className="absolute right-4 top-1/2 -translate-y-1/2"
                style={{ color: "#9ca3af" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 24 }}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe((state) => !state)}
              />
              <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>
                Remember me
              </span>
            </label>

          </div>

          {errorMessage ? (
            <div
              style={{
                marginBottom: 16,
                padding: "10px 12px",
                borderRadius: 10,
                backgroundColor: "#fff1f2",
                color: "#be123c",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center justify-center gap-2 font-bold"
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: isSubmitting ? "#9ca3af" : "#4285f4",
              color: "white",
              borderRadius: 12,
              fontSize: 15,
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(66,133,244,0.35)",
              marginBottom: 16,
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

        </form>
      </div>
    </div>
  );
}

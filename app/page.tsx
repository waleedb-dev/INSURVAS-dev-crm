"use client";

import { FormEvent, useMemo, useState } from "react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getCurrentUserPrimaryRole } from "@/lib/auth/user-role";
import { T } from "@/lib/theme";

export default function SignInPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitHovered, setIsSubmitHovered] = useState(false);
  const [activeField, setActiveField] = useState<"email" | "password" | null>(null);
  const [hoveredField, setHoveredField] = useState<"email" | "password" | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getFieldStyles = ({
    isActive,
    isHovered,
    isFilled,
    hasError,
  }: {
    isActive: boolean;
    isHovered: boolean;
    isFilled: boolean;
    hasError: boolean;
  }) => {
    if (hasError) {
      return {
        border: "1.5px solid #e11d48",
        backgroundColor: "#fff7f8",
        boxShadow: isActive ? "0 0 0 4px rgba(225, 29, 72, 0.12)" : "none",
        color: "#2e3429",
      };
    }

    if (isActive) {
      return {
        border: "1.5px solid #6f7f62",
        backgroundColor: "#fcfdf9",
        boxShadow: "0 0 0 4px rgba(111, 127, 98, 0.16)",
        color: "#1f251c",
      };
    }

    if (isHovered) {
      return {
        border: "1.5px solid #a9b999",
        backgroundColor: "#fdfefb",
        boxShadow: "none",
        color: "#253022",
      };
    }

    if (isFilled) {
      return {
        border: "1.5px solid #b8c8a9",
        backgroundColor: "#ffffff",
        boxShadow: "none",
        color: "#253022",
      };
    }

    return {
      border: "1.5px solid #c8d4bb",
      backgroundColor: "#ffffff",
      boxShadow: "none",
      color: "#2e3429",
    };
  };

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
    <div className="min-h-screen flex" style={{ backgroundColor: T.pageBg }}>
      <div
        className="hidden md:flex flex-col relative overflow-hidden items-center justify-center text-center"
        style={{
          width: "50%",
          backgroundColor: T.asideChrome,
          borderRight: "1px solid rgba(255,255,255,0.1)",
          padding: "48px 56px",
        }}
      >
        <div className="flex items-center justify-center mb-12 w-full">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              height: 150,
              backgroundColor: "transparent",
            }}
          >
            <Image
              src="/logo.png"
              alt="Logo"
              width={300}
              height={150}
              className="object-contain w-full h-full max-w-[300px]"
              style={{
                filter: "brightness(0) invert(1) drop-shadow(0 4px 10px rgba(0,0,0,0.18))",
              }}
              priority
            />
          </div>
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
        style={{ backgroundColor: T.pageBg }}
      >
        <form
          onSubmit={handleSignIn}
          className="bg-white flex flex-col"
          autoComplete="on"
          style={{
            width: "100%",
            maxWidth: 460,
            padding: "40px 36px",
            borderRadius: 20,
            boxShadow: "0 4px 40px rgba(0,0,0,0.07)",
          }}
        >
          <h2
            className="font-bold text-center"
            style={{ fontSize: 22, color: "#1a1a2e", marginBottom: 24 }}
          >
            Sign In to Insurvas
          </h2>

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="email"
              className="block font-semibold"
              style={{
                fontSize: 13,
                color: activeField === "email" ? "#536149" : "#6b7a5f",
                marginBottom: 6,
                transition: "color 0.2s ease",
              }}
            >
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username email"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              onFocus={() => setActiveField("email")}
              onBlur={() => setActiveField((current) => (current === "email" ? null : current))}
              onMouseEnter={() => setHoveredField("email")}
              onMouseLeave={() => setHoveredField((current) => (current === "email" ? null : current))}
              placeholder="youremail@gmail.com"
              style={{
                width: "100%",
                padding: "13px 16px",
                borderRadius: 12,
                fontSize: 14,
                fontFamily: "inherit",
                transition: "all 0.2s ease",
                outline: "none",
                ...getFieldStyles({
                  isActive: activeField === "email",
                  isHovered: hoveredField === "email",
                  isFilled: email.trim().length > 0,
                  hasError: Boolean(errorMessage),
                }),
              }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="password"
              className="block font-semibold"
              style={{
                fontSize: 13,
                color: activeField === "password" ? "#536149" : "#6b7a5f",
                marginBottom: 6,
                transition: "color 0.2s ease",
              }}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onFocus={() => setActiveField("password")}
                onBlur={() => setActiveField((current) => (current === "password" ? null : current))}
                onMouseEnter={() => setHoveredField("password")}
                onMouseLeave={() => setHoveredField((current) => (current === "password" ? null : current))}
                style={{
                  width: "100%",
                  padding: "13px 48px 13px 16px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: "inherit",
                  transition: "all 0.2s ease",
                  outline: "none",
                  ...getFieldStyles({
                    isActive: activeField === "password",
                    isHovered: hoveredField === "password",
                    isFilled: password.trim().length > 0,
                    hasError: Boolean(errorMessage),
                  }),
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((state) => !state)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center transition-colors hover:text-[#48533f]"
                style={{
                  color: activeField === "password" ? "#536149" : "#6b7a5f",
                }}
              >
                {showPassword ? <IconEyeOff size={22} stroke={2} /> : <IconEye size={22} stroke={2} />}
              </button>
            </div>
          </div>

          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 20 }}
          >
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe((state) => !state)}
                style={{
                  width: 18,
                  height: 18,
                  cursor: "pointer",
                  accentColor: T.asideChrome,
                }}
              />
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
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
            onMouseEnter={() => setIsSubmitHovered(true)}
            onMouseLeave={() => setIsSubmitHovered(false)}
            className="flex items-center justify-center gap-2 font-bold transition-colors"
            style={{
              width: "100%",
              padding: "14px",
              backgroundColor: isSubmitting
                ? T.textMuted
                : isSubmitHovered
                  ? "#2b3126"
                  : T.asideChrome,
              color: "white",
              borderRadius: 12,
              fontSize: 15,
              border: "none",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: "0 4px 14px rgba(28, 32, 26, 0.35)",
            }}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

        </form>
      </div>
    </div>
  );
}

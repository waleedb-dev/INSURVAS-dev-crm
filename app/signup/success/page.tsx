"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SignupSuccessPage() {
    const router = useRouter();

    return (
        <div
            style={{
                minHeight: "100vh",
                backgroundColor: "#eef2f7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
            }}
        >
            {/* White card */}
            <div
                style={{
                    backgroundColor: "white",
                    borderRadius: 20,
                    padding: "72px 48px",
                    width: "100%",
                    maxWidth: 720,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                }}
            >
                {/* Illustration */}
                <div style={{ marginBottom: 36 }}>
                    <Image
                        src="/Illustration.png"
                        alt="Successfully registered"
                        width={340}
                        height={280}
                        style={{ objectFit: "contain" }}
                    />
                </div>

                {/* Message */}
                <h2
                    style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "#1a1a2e",
                        margin: "0 0 28px",
                    }}
                >
                    You are successfully registered!
                </h2>

                {/* CTA button */}
                <button
                    onClick={() => router.push("/")}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        backgroundColor: "#4285f4",
                        color: "white",
                        border: "none",
                        borderRadius: 12,
                        padding: "14px 32px",
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 4px 14px rgba(66,133,244,0.35)",
                    }}
                >
                    Let&apos;s Start
                    <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

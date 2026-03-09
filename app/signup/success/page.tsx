"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function SignupSuccessPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#eef2f7] flex items-center justify-center p-4">
            <div className="w-full max-w-[860px] bg-white rounded-2xl shadow-[0_4px_40px_rgba(0,0,0,0.08)] overflow-hidden">
                <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                    {/* Illustration */}
                    <div className="mb-8">
                        <Image
                            src="/Illustration.png"
                            alt="Successfully registered illustration"
                            width={340}
                            height={280}
                            className="object-contain"
                        />
                    </div>

                    {/* Success text */}
                    <h2 className="text-[#1a1a2e] text-2xl font-extrabold mb-6">
                        You are successfully registered!
                    </h2>

                    {/* Let's Start button */}
                    <button
                        onClick={() => router.push("/")}
                        className="bg-[#4285f4] text-white px-8 py-3.5 rounded-xl font-bold text-base flex items-center gap-2.5 hover:bg-[#3574e2] active:scale-[0.98] transition-all duration-200 shadow-[0_4px_14px_rgba(66,133,244,0.35)]"
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
        </div>
    );
}

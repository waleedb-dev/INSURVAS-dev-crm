"use client";

import { useParams } from "next/navigation";
import { BpoCentreLeadIntakeForm } from "@/components/onboarding/BpoCentreLeadIntakeForm";

export default function PublicBpoOnboardingInvitePage() {
  const params = useParams<{ token?: string }>();
  const token =
    typeof params?.token === "string" ? params.token : Array.isArray(params?.token) ? params.token[0] : "";

  return <BpoCentreLeadIntakeForm mode="invite" inviteToken={token} />;
}

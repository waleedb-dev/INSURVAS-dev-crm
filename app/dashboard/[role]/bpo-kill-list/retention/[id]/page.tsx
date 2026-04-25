"use client";

import { useParams } from "next/navigation";
import BpoRetentionClientPage from "@/components/dashboard/pages/BpoRetentionClientPage";

export default function BpoRetentionKillListLeadRoutePage() {
  const params = useParams<{ id?: string }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;

  if (!idParam) {
    return <p style={{ margin: 0 }}>Lead not found.</p>;
  }

  return <BpoRetentionClientPage leadRowId={idParam} />;
}

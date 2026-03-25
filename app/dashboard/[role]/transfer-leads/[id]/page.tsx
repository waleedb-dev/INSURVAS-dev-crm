"use client";

import { useParams } from "next/navigation";
import TransferLeadWorkspacePage from "@/components/dashboard/pages/TransferLeadWorkspacePage";

export default function TransferLeadDetailRoutePage() {
  const params = useParams<{ id?: string }>();
  const idParam = Array.isArray(params?.id) ? params.id[0] : params?.id;

  if (!idParam) {
    return <p style={{ margin: 0 }}>Lead not found.</p>;
  }

  return <TransferLeadWorkspacePage leadRowId={idParam} />;
}

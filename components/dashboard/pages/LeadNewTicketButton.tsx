"use client";

import { useEffect, useMemo, useState } from "react";
import { T } from "@/lib/theme";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useOptionalDashboardContext } from "@/components/dashboard/DashboardContext";
import CreateLeadTicketModal from "./CreateLeadTicketModal";

type Props = {
  leadId: string | null;
  /** `leads.call_center_id` — center admins must match this to create tickets */
  leadCallCenterId?: string | null;
  sessionUserId: string | null;
  isCreation?: boolean;
  previewMode?: boolean;
  /** Called after a ticket is successfully created (e.g. refresh lead ticket tab). */
  onTicketCreated?: () => void;
};

export default function LeadNewTicketButton({
  leadId,
  leadCallCenterId = null,
  sessionUserId,
  isCreation = false,
  previewMode = false,
  onTicketCreated,
}: Props) {
  const dash = useOptionalDashboardContext();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [userCallCenterId, setUserCallCenterId] = useState<string | null>(null);
  const [centerChecked, setCenterChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionUserId) {
        setUserCallCenterId(null);
        setCenterChecked(true);
        return;
      }
      const { data, error: rErr } = await supabase
        .from("users")
        .select("call_center_id")
        .eq("id", sessionUserId)
        .maybeSingle();
      if (cancelled) return;
      if (rErr || !data) {
        setUserCallCenterId(null);
      } else {
        setUserCallCenterId(data.call_center_id != null ? String(data.call_center_id) : null);
      }
      setCenterChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionUserId, supabase]);

  const isCallCenterAdminSession = dash?.currentRole === "call_center_admin";
  const isSameCenter =
    !!leadCallCenterId &&
    !!userCallCenterId &&
    leadCallCenterId === userCallCenterId;

  const canCreateTicket =
    !!sessionUserId &&
    !previewMode &&
    !isCreation &&
    !!leadId &&
    isCallCenterAdminSession &&
    isSameCenter;

  if (!centerChecked || !canCreateTicket) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        title="Publish a support ticket for this lead. It is assigned to your department’s Publisher Manager."
        style={{
          border: `1px solid #233217`,
          borderRadius: T.radiusMd,
          background: "#233217",
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          padding: "10px 20px",
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#1a260f";
          e.currentTarget.style.borderColor = "#1a260f";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#233217";
          e.currentTarget.style.borderColor = "#233217";
        }}
      >
        New ticket
      </button>
      <CreateLeadTicketModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        leadId={leadId}
        sessionUserId={sessionUserId}
        onCreated={() => {
          setModalOpen(false);
          onTicketCreated?.();
        }}
      />
    </>
  );
}

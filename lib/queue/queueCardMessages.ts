import {
  parsePersistedTransferScreening,
  transferScreeningBadgeMeta,
  type TransferScreeningBadgeTone,
} from "@/lib/transferScreening";
import type { LeadQueueItem } from "@/lib/queue/queueClient";

export function transferCheckToneColor(tone: TransferScreeningBadgeTone): string {
  switch (tone) {
    case "success":
      return "#166534";
    case "warning":
      return "#b45309";
    case "critical":
    case "error":
      return "#b91c1c";
    default:
      return "#64748b";
  }
}

export function queueCardDisplayMessages(row: LeadQueueItem): {
  transferCheck: ReturnType<typeof transferScreeningBadgeMeta> | null;
  callResult: string | null;
} {
  const persisted = parsePersistedTransferScreening(row.transfer_screening_json);
  const transferCheck = persisted ? transferScreeningBadgeMeta(persisted) : null;
  const callResult = row.call_result_message?.trim() || null;
  return { transferCheck, callResult };
}

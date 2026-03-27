export const DDF_RESTRICTED_USER_IDS = [
  "adda1255-2a0b-41da-9df0-3100d01b8649",
  "eceb7ac0-0e4a-44ad-bb70-ba66010d0baa",
];

export function canPerformDdfWriteOperations(userId: string | undefined): boolean {
  if (!userId) {
    return false;
  }

  return !DDF_RESTRICTED_USER_IDS.includes(userId);
}

import { money } from "@/lib/utils";
import type { CommissionType } from "@/lib/types";

/** How a partner's terms read in a list or a badge. */
export function commissionLabel(
  type: CommissionType,
  amount: number | null,
  rate: number | null,
) {
  return type === "percent" ? `${rate ?? 0}%` : money(amount ?? 0);
}

/** What one closed deal is worth to the partner. */
export function commissionFor(
  type: CommissionType,
  amount: number | null,
  rate: number | null,
  dealValue: number,
) {
  return type === "percent" ? (dealValue * (rate ?? 0)) / 100 : (amount ?? 0);
}

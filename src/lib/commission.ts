import { money } from "@/lib/utils";
import type { CommissionType, ProjectPlan } from "@/lib/types";

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

/** What a partner takes home on one sale of this plan. */
export function planPayout(plan: ProjectPlan) {
  return commissionFor(
    plan.commission_type,
    plan.commission_amount,
    plan.commission_rate,
    plan.price,
  );
}

/** The earning range across a project's plans, for a badge. Null when
 *  the project has no plans priced yet — better to show nothing. */
export function plansPayoutRange(plans: ProjectPlan[]) {
  const payouts = plans.map(planPayout).filter((n) => n > 0);
  if (payouts.length === 0) return null;
  const low = Math.min(...payouts);
  const high = Math.max(...payouts);
  return low === high ? money(high) : `${money(low)} – ${money(high)}`;
}

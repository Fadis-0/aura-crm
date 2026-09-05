import { Coins } from "lucide-react";
import { getPortalContext } from "@/lib/portal";
import { supabaseServer } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { LOCALE, money } from "@/lib/utils";
import { commissionLabel } from "@/lib/commission";
import type { Commission, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Earnings" };

const STATUS_ACCENT = {
  pending: "amber",
  approved: "indigo",
  paid: "sage",
  cancelled: "rose",
} as const;

export default async function EarningsPage() {
  const { affiliate } = await getPortalContext();
  const sb = await supabaseServer();

  const [commissionsRes, leadsRes] = await Promise.all([
    affiliate
      ? sb
          .from("commissions")
          .select("*")
          .eq("affiliate_id", affiliate.id)
          .order("earned_on", { ascending: false })
      : Promise.resolve({ data: [] }),
    affiliate
      ? sb.from("leads").select("*").eq("affiliate_id", affiliate.id)
      : Promise.resolve({ data: [] }),
  ]);

  const commissions = (commissionsRes.data ?? []) as Commission[];
  const leads = (leadsRes.data ?? []) as Lead[];

  const paid = commissions
    .filter((c) => c.status === "paid")
    .reduce((s, c) => s + c.amount, 0);
  const owed = commissions
    .filter((c) => c.status !== "paid" && c.status !== "cancelled")
    .reduce((s, c) => s + c.amount, 0);

  const won = leads.filter((l) => l.stage === "won");
  const terms = affiliate
    ? commissionLabel(
        affiliate.commission_type,
        affiliate.commission_amount,
        affiliate.commission_rate,
      )
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Earnings"
        description={
          terms
            ? `You earn ${terms} on every deal you close, unless a project says otherwise.`
            : "What you have earned and what is still owed to you."
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Paid to you", value: money(paid), color: "var(--sage)" },
          { label: "Owed to you", value: money(owed), color: "var(--amber)" },
          { label: "Deals closed", value: String(won.length), color: "var(--indigo)" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {s.label}
            </p>
            <p
              className="mt-2 font-display text-[24px] leading-none tabular-nums"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          title="Commission history"
          subtitle="Every commission booked against your name"
        />

        {commissions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Coins size={19} />}
              title="Nothing booked yet"
              description="Once a lead you brought in closes, the commission shows up here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead>
                <tr className="border-b border-line bg-surface-2/60 text-[11px] uppercase tracking-[0.12em] text-ink-4">
                  <th className="px-4 py-2.5 font-semibold">Earned</th>
                  <th className="px-4 py-2.5 font-semibold">For</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Basis</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-line last:border-0 transition-colors hover:bg-surface-2"
                  >
                    <td className="px-4 py-2.5 text-[12.5px] text-ink-3">
                      {new Date(c.earned_on).toLocaleDateString(LOCALE, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2.5 text-[13px] text-ink">
                      {c.note ?? "Commission"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[12.5px] tabular-nums text-ink-3">
                      {c.commission_type === "percent" && c.rate ? `${c.rate}%` : "Fixed"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[13px] font-medium tabular-nums text-ink">
                      {money(c.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge accent={STATUS_ACCENT[c.status]} dot>
                        {c.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-4 text-[12px] leading-relaxed text-ink-4">
        Commissions are booked when a lead you brought in is converted to a
        client. Payouts are marked here as soon as the money leaves.
      </p>
    </>
  );
}

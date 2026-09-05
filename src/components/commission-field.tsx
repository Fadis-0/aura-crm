"use client";

import { Input, Select } from "@/components/ui";
import { money } from "@/lib/utils";
import type { CommissionType } from "@/lib/types";

/**
 * How a partner gets paid for a closed deal.
 *
 * A flat amount per deal is the default arrangement and the first option.
 * Percentage of the deal value is there for the arrangements that work that
 * way, and only then does the rate box appear.
 */
export function CommissionField({
  type,
  amount,
  rate,
  onTypeChange,
  onAmountChange,
  onRateChange,
  label = "Commission",
  sampleValue,
  className,
}: {
  type: CommissionType;
  amount: number | null;
  rate: number | null;
  onTypeChange: (t: CommissionType) => void;
  onAmountChange: (v: number) => void;
  onRateChange: (v: number) => void;
  label?: string;
  /** A deal size to preview the percentage against. */
  sampleValue?: number | null;
  className?: string;
}) {
  const fixed = type !== "percent";

  return (
    <div className={className}>
      <span className="mb-1.5 flex items-baseline gap-1.5 text-[12px] font-medium text-ink-2">
        {label}
        <span className="font-normal text-ink-4">per closed deal</span>
      </span>

      <div className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-2">
        <Select
          value={fixed ? "fixed" : "percent"}
          onChange={(e) => onTypeChange(e.target.value as CommissionType)}
          aria-label="Commission basis"
        >
          <option value="fixed">Fixed amount</option>
          <option value="percent">Percentage</option>
        </Select>

        {fixed ? (
          <div className="relative">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={amount ?? 0}
              onChange={(e) => onAmountChange(Number(e.target.value))}
              placeholder="15000"
              className="pr-11 text-right font-medium tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-ink-4">
              DA
            </span>
          </div>
        ) : (
          <div className="relative">
            <Input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              value={rate ?? 0}
              onChange={(e) => onRateChange(Number(e.target.value))}
              placeholder="10"
              className="pr-9 text-right font-medium tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-ink-4">
              %
            </span>
          </div>
        )}
      </div>

      {fixed ? (
        (amount ?? 0) > 0 ? (
          <p className="mt-1.5 text-[11.5px] text-ink-4">
            {money(amount ?? 0)} every time a deal closes.
          </p>
        ) : null
      ) : sampleValue ? (
        <p className="mt-1.5 text-[11.5px] text-ink-4">
          On a {money(sampleValue)} deal that is {money((sampleValue * (rate ?? 0)) / 100)}.
        </p>
      ) : null}
    </div>
  );
}

"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactMoney, money } from "@/lib/utils";

export type RevenuePoint = { month: string; paid: number; pipeline: number };

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div className="h-[240px] w-full px-1 pb-1 pt-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 12, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--clay)" stopOpacity={0.32} />
              <stop offset="100%" stopColor="var(--clay)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gPipe" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--indigo)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--indigo)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--line)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-4)", fontSize: 11 }}
            dy={6}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--ink-4)", fontSize: 11 }}
            tickFormatter={(v) => compactMoney(Number(v))}
            width={54}
          />
          <Tooltip
            cursor={{ stroke: "var(--line-2)", strokeWidth: 1 }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-md)",
              boxShadow: "var(--shadow-md)",
              fontSize: 12,
              color: "var(--ink)",
            }}
            labelStyle={{ color: "var(--ink-3)", marginBottom: 4 }}
            formatter={(value, name) => [
              money(Number(value)),
              name === "paid" ? "Collected" : "Invoiced",
            ]}
          />
          <Area
            type="monotone"
            dataKey="pipeline"
            stroke="var(--indigo)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            fill="url(#gPipe)"
          />
          <Area
            type="monotone"
            dataKey="paid"
            stroke="var(--clay)"
            strokeWidth={2.2}
            fill="url(#gPaid)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

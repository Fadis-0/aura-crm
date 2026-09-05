import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/config";

export const metadata = { title: "Sign in" };

const MARKS = [
  { label: "Pipeline", value: "Leads, stages, forecast" },
  { label: "Delivery", value: "Projects, boards, notes" },
  { label: "Together", value: "Shared calendar and chat" },
];

export default function LoginPage() {
  if (!isConfigured()) return <SetupNotice />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Left: the pitch */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-paper-2 p-12 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "var(--clay)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full opacity-[0.14] blur-3xl"
          style={{ background: "var(--amber)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--clay)] font-display text-[16px] font-semibold text-white shadow-soft">
            A
          </span>
          <span className="font-display text-[17px]">Aura</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[40px] leading-[1.08] tracking-tight">
            Every client, project and plan in one calm place.
          </h1>
          <dl className="mt-9 space-y-3.5 border-t border-line pt-6">
            {MARKS.map((m) => (
              <div key={m.label} className="flex items-baseline gap-4">
                <dt className="w-24 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
                  {m.label}
                </dt>
                <dd className="text-[13.5px] text-ink-2">{m.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="relative text-[12px] text-ink-4">
          Every account is reviewed before it is let in.
        </p>
      </div>

      {/* Right: the form */}
      <div className="flex items-center justify-center px-6 py-14">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}

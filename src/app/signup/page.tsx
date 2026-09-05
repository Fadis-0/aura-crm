import Link from "next/link";
import { Suspense } from "react";
import { BadgeCheck, FolderOpen, Target } from "lucide-react";
import { SignupForm } from "./signup-form";
import { SetupNotice } from "@/components/setup-notice";
import { isConfigured } from "@/lib/config";

export const metadata = { title: "Join as a marketer" };

const POINTS = [
  {
    icon: FolderOpen,
    title: "Pick up live campaigns",
    body: "Browse the projects open to affiliates, read the brief, and take the ones that suit you.",
  },
  {
    icon: Target,
    title: "Submit and track leads",
    body: "Add the people you bring in and move them along the pipeline as they warm up.",
  },
  {
    icon: BadgeCheck,
    title: "See what you have earned",
    body: "Every commission you have banked and everything still owed, in one place.",
  },
];

export default function SignupPage() {
  if (!isConfigured()) return <SetupNotice />;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Left: the form */}
      <div className="order-2 flex items-center justify-center px-6 py-14 lg:order-1">
        <Suspense fallback={null}>
          <SignupForm />
        </Suspense>
      </div>

      {/* Right: the pitch */}
      <div className="relative order-1 hidden flex-col justify-between overflow-hidden bg-paper-2 p-12 lg:order-2 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full opacity-[0.18] blur-3xl"
          style={{ background: "var(--indigo)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -right-20 h-96 w-96 rounded-full opacity-[0.14] blur-3xl"
          style={{ background: "var(--clay)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--clay)] font-display text-[16px] font-semibold text-white shadow-soft">
            A
          </span>
          <span className="font-display text-[17px]">Aura</span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[38px] leading-[1.1] tracking-tight">
            Bring us business. Get paid for it.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-3">
            Create an account and one of us will approve it. You will get the
            brief, the files and the links you need to sell.
          </p>

          <ul className="mt-9 space-y-5 border-t border-line pt-7">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-[var(--clay)] shadow-soft">
                  <p.icon size={16} />
                </span>
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{p.title}</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">
                    {p.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-[12px] text-ink-4">
          Already have an account?{" "}
          <Link href="/login" className="text-ink-2 underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

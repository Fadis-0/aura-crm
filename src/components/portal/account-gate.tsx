"use client";

import { useRouter } from "next/navigation";
import { Clock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/**
 * What a marketer sees before an admin lets them in, or after being suspended.
 * The database refuses them everything anyway; this explains why.
 */
export function AccountGate({ profile }: { profile: Profile }) {
  const router = useRouter();
  const suspended = profile.status === "suspended";

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <span
          className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl shadow-soft"
          style={{
            background: suspended ? "var(--rose-soft)" : "var(--amber-soft)",
            color: suspended ? "var(--rose)" : "var(--amber)",
          }}
        >
          {suspended ? <ShieldAlert size={24} /> : <Clock size={24} />}
        </span>

        <h1 className="text-[26px] leading-tight">
          {suspended ? "Your account is paused" : "Waiting for approval"}
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-ink-3">
          {suspended
            ? "Your access is on hold. Get in touch with us if you think this is a mistake."
            : "Thanks for applying. As soon as you are approved, your projects and leads appear here."}
        </p>

        <div className="mt-7 rounded-lg border border-line bg-surface p-4 text-left shadow-soft">
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-4">Name</dt>
              <dd className="truncate text-ink">{profile.full_name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-4">Email</dt>
              <dd className="truncate text-ink">{profile.email}</dd>
            </div>
            {profile.phone ? (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-4">Phone</dt>
                <dd className="truncate text-ink">{profile.phone}</dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Button onClick={() => router.refresh()}>Check again</Button>
          <Button variant="ghost" onClick={signOut} className="text-[var(--rose)]">
            Sign out
          </Button>
        </div>

        <div className="mt-8 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

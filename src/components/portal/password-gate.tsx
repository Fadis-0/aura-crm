"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

/**
 * Shown once, to someone whose password was chosen for them by an admin.
 * Until they pick their own, the admin knows a working credential for this
 * account, so nothing else in the portal renders.
 */
export function PasswordGate({ profile }: { profile: Profile }) {
  const router = useRouter();
  const sb = supabaseBrowser();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      return toast.error("Use at least 8 characters.");
    }
    if (password !== confirm) {
      return toast.error("The two passwords do not match.");
    }

    setSaving(true);
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    const { error: flagError } = await sb
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);
    setSaving(false);

    if (flagError) return toast.error(flagError.message);

    toast.success("Password updated");
    router.refresh();
  };

  const signOut = async () => {
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="grid min-h-screen place-items-center px-6 py-16">
      <div className="w-full max-w-md">
        <div className="text-center">
          <span
            className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl shadow-soft"
            style={{ background: "var(--clay-soft)", color: "var(--clay)" }}
          >
            <KeyRound size={24} />
          </span>

          <h1 className="text-[26px] leading-tight">Choose your password</h1>
          <p className="mx-auto mt-3 max-w-sm text-[13.5px] leading-relaxed text-ink-3">
            Your account was set up for you, so the password you were given is
            known to someone else. Pick your own to carry on.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="mt-7 rounded-lg border border-line bg-surface p-5 shadow-soft"
        >
          <div className="space-y-3">
            <Field label="New password" required>
              <div className="relative">
                <Input
                  autoFocus
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-4 transition-colors hover:text-ink-2"
                >
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>

            <Field label="Confirm password" required>
              <Input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </Field>
          </div>

          <Button
            type="submit"
            variant="primary"
            loading={saving}
            className="mt-4 w-full justify-center"
          >
            Save and continue
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-3">
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

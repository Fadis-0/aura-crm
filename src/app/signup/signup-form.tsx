"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, MailCheck, UserPlus } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui";
import { WILAYAS } from "@/lib/algeria";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    social: "",
    wilaya: "",
    commune: "",
    addressLine: "",
    postalCode: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (!form.wilaya) {
      setError("Pick your wilaya.");
      return;
    }

    setLoading(true);
    const { error } = await supabaseBrowser().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: {
          full_name: form.fullName.trim(),
          phone: form.phone.trim() || null,
          social_url: form.social.trim() || null,
          wilaya: form.wilaya || null,
          commune: form.commune.trim() || null,
          address_line: form.addressLine.trim() || null,
          postal_code: form.postalCode.trim() || null,
          role: "marketer",
        },
      },
    });
    setLoading(false);

    if (error) {
      setError(
        error.message.includes("already registered")
          ? "There is already an account with that email."
          : error.message,
      );
      return;
    }

    setDone(true);
  };

  if (done) {
    return (
      <div className="w-full max-w-sm text-center">
        <span className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl bg-[var(--sage-soft)] text-[var(--sage)]">
          <MailCheck size={22} />
        </span>
        <h2 className="text-[24px] leading-tight">You are on the list</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-3">
          Your details are in. We will review them shortly and you will be able
          to sign in as soon as you are approved.
        </p>
        <Button
          variant="primary"
          size="lg"
          className="mt-6 w-full"
          onClick={() => router.push("/login")}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--clay)] font-display text-[16px] font-semibold text-white">
            A
          </span>
          <span className="font-display text-[17px]">Aura</span>
        </div>
        <ThemeToggle className="ml-auto" />
      </div>

      <h2 className="text-[26px] leading-tight">Join as a marketer</h2>
      <p className="mt-1.5 text-[13.5px] text-ink-3">
        Tell us who you are. Approval usually takes a day.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Full name" required>
          <Input
            required
            autoComplete="name"
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
            placeholder="Yacine Belkacem"
          />
        </Field>

        <Field label="Email" required>
          <Input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Phone" required>
          <Input
            type="tel"
            required
            autoComplete="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="+213 ..."
          />
        </Field>

        <Field label="Social link" hint="optional">
          <Input
            type="url"
            value={form.social}
            onChange={(e) => set("social", e.target.value)}
            placeholder="https://instagram.com/you"
          />
        </Field>

        <div className="border-t border-line pt-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
            Where you are
          </p>

          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wilaya" required>
                <Select
                  required
                  value={form.wilaya}
                  onChange={(e) => set("wilaya", e.target.value)}
                >
                  <option value="">Choose…</option>
                  {WILAYAS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Commune" required>
                <Input
                  required
                  value={form.commune}
                  onChange={(e) => set("commune", e.target.value)}
                  placeholder="Bab Ezzouar"
                />
              </Field>
            </div>

            <Field label="Address">
              <Input
                value={form.addressLine}
                onChange={(e) => set("addressLine", e.target.value)}
                placeholder="Street and building"
              />
            </Field>

            <Field label="Postal code">
              <Input
                inputMode="numeric"
                value={form.postalCode}
                onChange={(e) => set("postalCode", e.target.value)}
                placeholder="16000"
                className="max-w-[160px]"
              />
            </Field>
          </div>
        </div>

        <Field label="Password" hint="8 characters or more" required>
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="••••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded text-ink-4 transition-colors hover:text-ink-2"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-md border border-[var(--rose)]/30 bg-[var(--rose-soft)] px-3 py-2 text-[12.5px] text-[var(--rose)]"
          >
            {error}
          </p>
        ) : null}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          {loading ? null : <UserPlus size={15} />}
          Create account
        </Button>
      </form>

      <p className="mt-6 text-[12.5px] text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--clay)] hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

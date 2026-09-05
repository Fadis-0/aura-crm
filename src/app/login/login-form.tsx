"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match an account."
          : error.message,
      );
      return;
    }

    router.replace(next);
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex items-center justify-between lg:hidden">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--clay)] font-display text-[16px] font-semibold text-white">
            A
          </span>
          <span className="font-display text-[17px]">Aura</span>
        </div>
        <ThemeToggle />
      </div>

      <h2 className="text-[26px] leading-tight">Welcome back</h2>
      <p className="mt-1.5 text-[13.5px] text-ink-3">
        Sign in to your workspace.
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4">
        <Field label="Email">
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.com"
          />
        </Field>

        <Field label="Password">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
          {loading ? null : <LogIn size={15} />}
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-[12.5px] text-ink-3">
        Marketing for us?{" "}
        <Link
          href="/signup"
          className="font-medium text-[var(--clay)] hover:underline"
        >
          Create an affiliate account
        </Link>
      </p>

      <div className="mt-8 hidden justify-end lg:flex">
        <ThemeToggle />
      </div>
    </div>
  );
}

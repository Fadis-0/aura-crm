"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Keyboard, LogOut, ShieldCheck, Users } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Textarea,
} from "@/components/ui";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, type Accent } from "@/lib/utils";
import type { Profile, WorkspaceSettings } from "@/lib/types";

const ACCENTS: Accent[] = ["clay", "amber", "sage", "indigo", "plum", "rose"];

const SHORTCUTS = [
  { keys: "Ctrl K", what: "Open the command palette" },
  { keys: "Ctrl J", what: "Create something new" },
  { keys: "Esc", what: "Close any dialog" },
  { keys: "Enter", what: "Send a message or add a task" },
];

export function SettingsView({
  profiles,
  settings,
  currentUserId,
  email,
}: {
  profiles: Profile[];
  settings: WorkspaceSettings | null;
  currentUserId: string;
  email: string;
}) {
  const sb = supabaseBrowser();
  const router = useRouter();

  const me = profiles.find((p) => p.id === currentUserId);
  const [fullName, setFullName] = useState(me?.full_name ?? "");
  const [title, setTitle] = useState(me?.title ?? "");
  const [accent, setAccent] = useState<Accent>((me?.accent as Accent) ?? "clay");
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  // What gets printed at the top of every facture.
  const [billing, setBilling] = useState<Partial<WorkspaceSettings>>(settings ?? {});
  const [savingBilling, setSavingBilling] = useState(false);

  const setBill = <K extends keyof WorkspaceSettings>(k: K, v: string) =>
    setBilling((b) => ({ ...b, [k]: v }));

  const saveBilling = async () => {
    setSavingBilling(true);
    const { error } = await sb
      .from("workspace_settings")
      .update({
        legal_name: billing.legal_name?.trim() || "",
        tagline: billing.tagline || null,
        address: billing.address || null,
        phone: billing.phone || null,
        email: billing.email || null,
        website: billing.website || null,
        rc: billing.rc || null,
        nif: billing.nif || null,
        nis: billing.nis || null,
        art: billing.art || null,
        bank_details: billing.bank_details || null,
        invoice_note: billing.invoice_note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSavingBilling(false);
    if (error) return toast.error(error.message);
    toast.success("Invoice details saved");
    router.refresh();
  };

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await sb
      .from("profiles")
      .update({ full_name: fullName.trim() || "Member", title: title || null, accent })
      .eq("id", currentUserId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    router.refresh();
  };

  const changePassword = async () => {
    if (newPassword.length < 8) {
      return toast.error("Use at least 8 characters.");
    }
    setChanging(true);
    const { error } = await sb.auth.updateUser({ password: newPassword });
    setChanging(false);
    if (error) return toast.error(error.message);
    setNewPassword("");
    toast.success("Password changed");
  };

  const signOut = async () => {
    await sb.auth.signOut();
    router.replace("/login");
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-4">
          Workspace
        </p>
        <h1 className="text-[26px] leading-tight">Settings</h1>
      </header>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Your profile" subtitle={email} />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-4">
              <Avatar name={fullName} accent={accent} size="lg" />
              <div className="flex-1">
                <p className="mb-2 text-[12px] font-medium text-ink-2">Accent colour</p>
                <div className="flex gap-1.5">
                  {ACCENTS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAccent(a)}
                      aria-label={a}
                      className={cn(
                        "h-8 w-8 rounded-full border-2 transition-transform",
                        accent === a ? "scale-110 border-ink" : "border-transparent hover:scale-105",
                      )}
                      style={{ background: `var(--${a})` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Role" hint="shown in the sidebar">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Founder"
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={saveProfile} loading={saving}>
                Save profile
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Invoice details"
            subtitle="Printed at the top of every facture and receipt"
          />
          <div className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Legal name" hint="as registered">
                <Input
                  value={billing.legal_name ?? ""}
                  onChange={(e) => setBill("legal_name", e.target.value)}
                  placeholder="Aura Studio SARL"
                />
              </Field>
              <Field label="Tagline" hint="optional">
                <Input
                  value={billing.tagline ?? ""}
                  onChange={(e) => setBill("tagline", e.target.value)}
                  placeholder="Design and development"
                />
              </Field>
            </div>

            <Field label="Address">
              <Textarea
                rows={2}
                value={billing.address ?? ""}
                onChange={(e) => setBill("address", e.target.value)}
                placeholder="12 rue Didouche Mourad, Alger"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Phone">
                <Input
                  value={billing.phone ?? ""}
                  onChange={(e) => setBill("phone", e.target.value)}
                  placeholder="+213 ..."
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={billing.email ?? ""}
                  onChange={(e) => setBill("email", e.target.value)}
                />
              </Field>
              <Field label="Website">
                <Input
                  value={billing.website ?? ""}
                  onChange={(e) => setBill("website", e.target.value)}
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="RC">
                <Input value={billing.rc ?? ""} onChange={(e) => setBill("rc", e.target.value)} />
              </Field>
              <Field label="NIF">
                <Input value={billing.nif ?? ""} onChange={(e) => setBill("nif", e.target.value)} />
              </Field>
              <Field label="NIS">
                <Input value={billing.nis ?? ""} onChange={(e) => setBill("nis", e.target.value)} />
              </Field>
              <Field label="ART">
                <Input value={billing.art ?? ""} onChange={(e) => setBill("art", e.target.value)} />
              </Field>
            </div>

            <Field label="Payment details" hint="RIB, CCP, however they pay you">
              <Textarea
                rows={2}
                value={billing.bank_details ?? ""}
                onChange={(e) => setBill("bank_details", e.target.value)}
              />
            </Field>

            <Field label="Footer note" hint="optional, small print">
              <Textarea
                rows={2}
                value={billing.invoice_note ?? ""}
                onChange={(e) => setBill("invoice_note", e.target.value)}
              />
            </Field>

            <div className="flex justify-end">
              <Button variant="primary" onClick={saveBilling} loading={savingBilling}>
                Save invoice details
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Appearance"
            subtitle="Follows your system by default"
            action={<ThemeToggle />}
          />
        </Card>

        <Card>
          <CardHeader title="Workspace members" subtitle="Invite only" />
          <ul className="divide-y divide-line">
            {profiles.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar
                  name={p.full_name}
                  src={p.avatar_url}
                  accent={p.accent}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium text-ink">
                    {p.full_name}
                    {p.id === currentUserId ? (
                      <span className="ml-1.5 text-[11.5px] text-ink-4">you</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[12px] text-ink-4">{p.email ?? "—"}</p>
                </div>
                <Badge accent={p.role === "owner" ? "clay" : "indigo"}>{p.role}</Badge>
              </li>
            ))}
          </ul>
          <p className="flex items-start gap-2 border-t border-line px-5 py-3 text-[12px] leading-relaxed text-ink-3">
            <Users size={14} className="mt-0.5 shrink-0 text-ink-4" />
            Owners are added by invitation only. Marketers apply through the
            public form and appear under Affiliates for approval.
          </p>
        </Card>

        <Card>
          <CardHeader title="Password" subtitle="Change the one you sign in with" />
          <div className="flex items-end gap-3 p-5">
            <Field label="New password" hint="8 characters or more" className="flex-1">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="new-password"
              />
            </Field>
            <Button onClick={changePassword} loading={changing}>
              <ShieldCheck size={14} />
              Update
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Keyboard shortcuts" />
          <ul className="divide-y divide-line">
            {SHORTCUTS.map((s) => (
              <li key={s.keys} className="flex items-center gap-3 px-5 py-2.5">
                <Keyboard size={14} className="shrink-0 text-ink-4" />
                <span className="flex-1 text-[13px] text-ink-2">{s.what}</span>
                <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                  {s.keys}
                </kbd>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex justify-end pb-4">
          <Button variant="ghost" onClick={signOut} className="text-[var(--rose)]">
            <LogOut size={14} />
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

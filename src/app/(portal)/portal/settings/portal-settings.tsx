"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Landmark, LogOut, ShieldCheck } from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { WILAYAS, formatRip, isValidRip, normaliseRip } from "@/lib/algeria";
import { ThemeToggle } from "@/components/theme";
import { supabaseBrowser } from "@/lib/supabase/client";
import { cn, LOCALE, type Accent } from "@/lib/utils";
import type { Affiliate, Profile } from "@/lib/types";

const ACCENTS: Accent[] = ["clay", "amber", "sage", "indigo", "plum", "rose"];

export function PortalSettings({
  profile,
  email,
  affiliate,
}: {
  profile: Profile;
  email: string;
  affiliate: Affiliate | null;
}) {
  const sb = supabaseBrowser();
  const router = useRouter();

  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [social, setSocial] = useState(profile.social_url ?? "");
  const [accent, setAccent] = useState<Accent>(profile.accent);
  const [wilaya, setWilaya] = useState(profile.wilaya ?? "");
  const [commune, setCommune] = useState(profile.commune ?? "");
  const [addressLine, setAddressLine] = useState(profile.address_line ?? "");
  const [postalCode, setPostalCode] = useState(profile.postal_code ?? "");
  const [saving, setSaving] = useState(false);

  const [rip, setRip] = useState(formatRip(affiliate?.ccp_rip));
  const [holder, setHolder] = useState(affiliate?.ccp_holder ?? "");
  const [savingPayout, setSavingPayout] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await sb
      .from("profiles")
      .update({
        full_name: fullName.trim() || "Marketer",
        phone: phone.trim() || null,
        social_url: social.trim() || null,
        wilaya: wilaya || null,
        commune: commune.trim() || null,
        address_line: addressLine.trim() || null,
        postal_code: postalCode.trim() || null,
        accent,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    router.refresh();
  };

  const savePayout = async () => {
    if (!affiliate) return;
    if (rip.trim() && !isValidRip(rip)) {
      return toast.error("That does not look like a CCP RIP.");
    }

    setSavingPayout(true);
    // Goes through a function rather than a table write: a marketer has no
    // update rights on their affiliate row, and should not get them just to
    // save a bank number.
    const { error } = await sb.rpc("set_my_payout", {
      rip: rip.trim() ? normaliseRip(rip) : null,
      holder: holder.trim() || null,
    });
    setSavingPayout(false);
    if (error) return toast.error(error.message);
    toast.success("Payout details saved");
    router.refresh();
  };

  const changePassword = async () => {
    if (newPassword.length < 8) return toast.error("Use at least 8 characters.");
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
    <div className="mx-auto max-w-2xl">
      <PageHeader eyebrow="Account" title="Settings" />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Your details" subtitle={email} />
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
                        accent === a
                          ? "scale-110 border-ink"
                          : "border-transparent hover:scale-105",
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
              <Field label="Phone">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Social link" hint="where you promote">
              <Input
                type="url"
                value={social}
                onChange={(e) => setSocial(e.target.value)}
                placeholder="https://instagram.com/you"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wilaya">
                <Select value={wilaya} onChange={(e) => setWilaya(e.target.value)}>
                  <option value="">Not set</option>
                  {WILAYAS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Commune">
                <Input value={commune} onChange={(e) => setCommune(e.target.value)} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <Field label="Address">
                <Input
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </Field>
              <Field label="Postal code">
                <Input
                  inputMode="numeric"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <Button variant="primary" onClick={save} loading={saving}>
                Save profile
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Payout details"
            subtitle="Where your commissions are sent"
          />
          <div className="space-y-4 p-5">
            <Field label="CCP RIP" hint="the 20 digits on your CCP account">
              <Input
                inputMode="numeric"
                value={rip}
                onChange={(e) => setRip(e.target.value)}
                placeholder="0012 3456 7890 1234 5678"
                className="font-mono tracking-wide"
              />
            </Field>
            <Field label="Account holder" hint="as printed on the account">
              <Input
                value={holder}
                onChange={(e) => setHolder(e.target.value)}
                placeholder={profile.full_name}
              />
            </Field>

            <div className="flex items-center gap-3">
              <p className="flex flex-1 items-start gap-2 text-[11.5px] leading-relaxed text-ink-4">
                <Landmark size={13} className="mt-0.5 shrink-0" />
                CCP is the only payout route. Keep these digits correct or your
                money will bounce back.
              </p>
              <Button
                variant="primary"
                onClick={savePayout}
                loading={savingPayout}
                disabled={!affiliate}
              >
                Save
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Your affiliate account"
            subtitle="Set by the workspace owners"
          />
          <dl className="divide-y divide-line">
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-[13px] text-ink-3">Status</dt>
              <dd>
                <Badge accent={profile.status === "active" ? "sage" : "amber"} dot>
                  {profile.status}
                </Badge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-[13px] text-ink-3">You earn per deal</dt>
              <dd className="text-right text-[13px] text-ink-3">
                Set per project plan
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-[13px] text-ink-3">CCP on file</dt>
              <dd className="font-mono text-[12.5px] text-ink">
                {affiliate?.ccp_rip ? formatRip(affiliate.ccp_rip) : "Not set"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-3">
              <dt className="text-[13px] text-ink-3">Member since</dt>
              <dd className="text-[13px] text-ink">
                {new Date(profile.created_at).toLocaleDateString(LOCALE, {
                  month: "long",
                  year: "numeric",
                })}
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Appearance" action={<ThemeToggle />} />
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

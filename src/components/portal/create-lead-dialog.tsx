"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Modal } from "@/components/overlays";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Lead } from "@/lib/types";

/**
 * The marketer's own lead form. Deliberately smaller than the admin one: no
 * source, no owner, no probability. The affiliate is fixed to whoever is
 * signed in, which is also what row-level security enforces.
 */
export function CreateLeadDialog({
  open,
  onClose,
  affiliateId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  affiliateId: string | null;
  onCreated?: (lead: Lead) => void;
}) {
  const router = useRouter();
  const sb = supabaseBrowser();

  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const close = () => {
    setForm({});
    onClose();
  };

  const save = async () => {
    const name = (form.name ?? "").trim();
    if (!name) return toast.error("Give the lead a name first.");
    if (!affiliateId) {
      return toast.error("Something is off with your account. Please get in touch.");
    }

    setSaving(true);
    const { data, error } = await sb
      .from("leads")
      .insert({
        name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        stage: form.stage || "new",
        temperature: form.temperature || "warm",
        source: "affiliate",
        affiliate_id: affiliateId,
        estimated_value: form.value ? Number(form.value) : 0,
        notes: form.notes || null,
      })
      .select("*")
      .single();

    setSaving(false);
    if (error) return toast.error(error.message);

    toast.success(`${name} added to your pipeline`);
    onCreated?.(data as Lead);
    close();
    router.refresh();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New lead"
      description="Someone you have brought in. You can move them along the board afterwards."
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Add lead
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Name" required>
          <Input
            autoFocus
            value={form.name ?? ""}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Karim Belhaj"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company">
            <Input
              value={form.company ?? ""}
              onChange={(e) => set("company", e.target.value)}
            />
          </Field>
          <Field label="Phone">
            <Input
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email">
          <Input
            type="email"
            value={form.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Stage">
            <Select
              value={form.stage ?? "new"}
              onChange={(e) => set("stage", e.target.value)}
            >
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="qualified">Qualified</option>
              <option value="proposal">Proposal</option>
              <option value="negotiation">Negotiation</option>
            </Select>
          </Field>
          <Field label="Heat">
            <Select
              value={form.temperature ?? "warm"}
              onChange={(e) => set("temperature", e.target.value)}
            >
              <option value="cold">Cold</option>
              <option value="warm">Warm</option>
              <option value="hot">Hot</option>
            </Select>
          </Field>
          <Field label="Value" hint="DA">
            <Input
              type="number"
              value={form.value ?? ""}
              onChange={(e) => set("value", e.target.value)}
              placeholder="650000"
            />
          </Field>
        </div>

        <Field label="Notes" hint="what they want, when to follow up">
          <Textarea
            rows={3}
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

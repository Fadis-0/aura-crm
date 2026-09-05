"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import { normaliseRip } from "@/lib/algeria";

export type NewPartner = {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  social?: string;
  wilaya?: string;
  commune?: string;
  addressLine?: string;
  postalCode?: string;
  ccpRip?: string;
  ccpHolder?: string;
  company?: string;
  notes?: string;
};

export type PartnerResult =
  | { ok: true; affiliateId: string }
  | { ok: false; error: string };

/**
 * Creates an affiliate partner with a working login.
 *
 * Runs on the server because making an auth user needs the service key. The
 * database trigger then builds the profile and the affiliate record, and the
 * account is active straight away: an admin adding someone is the approval.
 */
export async function createPartnerAccount(
  input: NewPartner,
): Promise<PartnerResult> {
  const session = await getSession();
  if (!session?.isAdmin) {
    return { ok: false, error: "Only workspace owners can add partners." };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  if (!fullName) return { ok: false, error: "Give the partner a name." };
  if (!email) return { ok: false, error: "An email is required to sign in." };
  if (input.password.length < 8) {
    return { ok: false, error: "The password needs at least 8 characters." };
  }

  const admin = supabaseAdmin();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: {
      role: "marketer",
      created_by_admin: true,
      full_name: fullName,
      phone: input.phone?.trim() || null,
      social_url: input.social?.trim() || null,
      wilaya: input.wilaya || null,
      commune: input.commune?.trim() || null,
      address_line: input.addressLine?.trim() || null,
      postal_code: input.postalCode?.trim() || null,
      ccp_rip: input.ccpRip ? normaliseRip(input.ccpRip) : null,
      ccp_holder: input.ccpHolder?.trim() || null,
    },
  });

  if (error) {
    return {
      ok: false,
      error: error.message.includes("already been registered")
        ? "There is already an account with that email."
        : error.message,
    };
  }

  // The trigger has made the affiliate row; fill in what it does not carry.
  const { data: affiliate } = await admin
    .from("affiliates")
    .update({
      company: input.company?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq("profile_id", data.user.id)
    .select("id")
    .single();

  revalidatePath("/affiliates");

  return { ok: true, affiliateId: affiliate?.id ?? "" };
}

/**
 * Removes a partner for good.
 *
 * When they have a sign-in account the auth user goes first, and the cascade
 * takes the profile and the affiliate row with it. Deleting only the affiliate
 * row would leave a login that can sign in but do nothing, which is exactly
 * what a database trigger now refuses.
 */
export async function removePartner(
  affiliateId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session?.isAdmin) {
    return { ok: false, error: "Only workspace owners can remove partners." };
  }

  const admin = supabaseAdmin();

  const { data: affiliate, error: readError } = await admin
    .from("affiliates")
    .select("id, profile_id")
    .eq("id", affiliateId)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };
  if (!affiliate) return { ok: false, error: "That partner no longer exists." };

  if (affiliate.profile_id) {
    const { error } = await admin.auth.admin.deleteUser(affiliate.profile_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("affiliates").delete().eq("id", affiliateId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/affiliates");
  return { ok: true };
}

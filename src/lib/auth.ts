import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdminRole, type Profile } from "@/lib/types";

export type Session = {
  userId: string;
  email: string;
  profile: Profile;
  isAdmin: boolean;
  isMarketer: boolean;
};

/**
 * The signed-in person and what they are allowed to be.
 *
 * Pages call this to shape what they render. The database enforces the same
 * rules independently, so a marketer who guesses an admin URL gets an empty
 * page rather than someone else's data.
 */
export async function getSession(): Promise<Session | null> {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) return null;

  const { data } = await sb
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return null;
  const profile = data as Profile;

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    isAdmin: isAdminRole(profile.role) && profile.status === "active",
    isMarketer: profile.role === "marketer",
  };
}

/** For the admin app. Sends marketers to their own side of the house. */
export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.isAdmin) redirect("/portal");
  return session;
}

/** For the portal. Admins are allowed in so they can see what marketers see. */
export async function requireMarketer(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

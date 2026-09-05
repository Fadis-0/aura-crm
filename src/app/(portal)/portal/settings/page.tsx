import { getPortalContext } from "@/lib/portal";
import { PortalSettings } from "./portal-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function PortalSettingsPage() {
  const { profile, email, affiliate } = await getPortalContext();
  return <PortalSettings profile={profile} email={email} affiliate={affiliate} />;
}

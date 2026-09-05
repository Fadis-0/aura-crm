import {
  CalendarDays,
  FolderKanban,
  HardDrive,
  Gauge,
  Handshake,
  LayoutList,
  MessageCircle,
  Receipt,
  Settings,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: typeof Gauge;
  /** Shown as a small count chip when the layout can resolve one. */
  badgeKey?: "leads" | "tasks" | "unread" | "today";
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: Gauge },
      { href: "/calendar", label: "Calendar", icon: CalendarDays, badgeKey: "today" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: Target, badgeKey: "leads" },
      { href: "/clients", label: "Clients", icon: Users },
      { href: "/affiliates", label: "Affiliates", icon: Handshake },
      { href: "/invoices", label: "Invoices", icon: Receipt },
    ],
  },
  {
    label: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/planning", label: "Planning", icon: LayoutList, badgeKey: "tasks" },
      { href: "/notes", label: "Notes", icon: Sparkles },
      { href: "/docs", label: "Documents", icon: HardDrive },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/chat", label: "Messages", icon: MessageCircle, badgeKey: "unread" },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV.flatMap((g) => g.items);

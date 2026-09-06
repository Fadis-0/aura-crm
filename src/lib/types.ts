import type { Accent } from "@/lib/utils";

export type ID = string;

/** Owners run the workspace. Marketers get the restricted portal. */
export type Role = "owner" | "partner" | "marketer";

export type AccountStatus = "pending" | "active" | "suspended";

export type Profile = {
  id: ID;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: Role;
  status: AccountStatus;
  accent: Accent;
  title: string | null;
  phone: string | null;
  social_url: string | null;
  wilaya: string | null;
  commune: string | null;
  address_line: string | null;
  postal_code: string | null;
  timezone: string | null;
  approved_at: string | null;
  approved_by: ID | null;
  last_seen_at: string | null;
  /** Set when an admin chose the password, cleared once they replace it. */
  must_change_password: boolean;
  created_at: string;
};

export const isAdminRole = (role: Role | undefined | null) =>
  role === "owner" || role === "partner";

export type AffiliateStatus = "active" | "paused" | "ended";

/** A flat fee per deal, or a share of the deal value. Flat is the default. */
export type CommissionType = "fixed" | "percent";

export type Affiliate = {
  id: ID;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: AffiliateStatus;
  commission_type: CommissionType;
  commission_amount: number;
  commission_rate: number;
  /** Set when this affiliate is a marketer account rather than a contact. */
  profile_id: ID | null;
  /** The only payout route: an Algérie Poste CCP account. */
  ccp_rip: string | null;
  ccp_holder: string | null;
  notes: string | null;
  accent: Accent;
  joined_at: string;
  created_at: string;
  updated_at: string;
};

export const PLAN_KINDS = ["one_time", "subscription"] as const;
export type PlanKind = (typeof PLAN_KINDS)[number];

/** One way to buy into a project: a one-time sell or an annual subscription.
 *  Carries its own commission, since that is what actually pays a partner. */
export type ProjectPlan = {
  id: ID;
  project_id: ID;
  name: string;
  kind: PlanKind;
  price: number;
  commission_type: CommissionType;
  commission_amount: number;
  commission_rate: number;
  position: number;
  created_at: string;
};

export const LEAD_STAGES = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_SOURCES = [
  "direct",
  "affiliate",
  "referral",
  "inbound",
  "outbound",
  "social",
  "other",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export type Lead = {
  id: ID;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  stage: LeadStage;
  temperature: "cold" | "warm" | "hot";
  source: LeadSource;
  affiliate_id: ID | null;
  project_id: ID | null;
  plan_id: ID | null;
  estimated_value: number | null;
  probability: number | null;
  expected_close: string | null;
  owner_id: ID | null;
  tags: string[];
  notes: string | null;
  lost_reason: string | null;
  position: number;
  last_contact_at: string | null;
  converted_client_id: ID | null;
  created_at: string;
  updated_at: string;
};

export type ClientStatus = "active" | "paused" | "churned";

export type Client = {
  id: ID;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  country: string | null;
  status: ClientStatus;
  health: "good" | "watch" | "at_risk";
  tier: "standard" | "key" | "strategic";
  source: string;
  lead_id: ID | null;
  owner_id: ID | null;
  lifetime_value: number;
  retainer_amount: number | null;
  /** The plan they signed up on, one of their project's payment plans. */
  plan_id: ID | null;
  accent: Accent;
  tags: string[];
  notes: string | null;
  since: string;
  last_contact_at: string | null;
  created_at: string;
  updated_at: string;
};

export const PROJECT_STATUSES = [
  "planning",
  "active",
  "on_hold",
  "review",
  "done",
  "cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export type Priority = "low" | "medium" | "high" | "urgent";

export type Project = {
  id: ID;
  name: string;
  code: string | null;
  description: string | null;
  client_id: ID | null;
  status: ProjectStatus;
  priority: Priority;
  budget: number | null;
  spent: number | null;
  currency: string;
  progress: number;
  accent: Accent;
  start_date: string | null;
  due_date: string | null;
  owner_id: ID | null;
  tags: string[];
  archived: boolean;
  /** Opened to marketers, who then see the brief and the asset library. */
  open_for_affiliates: boolean;
  affiliate_brief: string | null;
  affiliate_commission_type: CommissionType;
  affiliate_commission_amount: number | null;
  affiliate_commission_rate: number | null;
  affiliate_payout_note: string | null;
  created_at: string;
  updated_at: string;
};

/** What the portal sees of a project. Backed by the projects_public view,
 *  which withholds budget, spend, ownership and internal tags. */
export type PortalProject = Pick<
  Project,
  | "id"
  | "name"
  | "code"
  | "description"
  | "accent"
  | "status"
  | "due_date"
  | "open_for_affiliates"
  | "affiliate_brief"
  | "affiliate_payout_note"
  | "created_at"
  | "updated_at"
>;

export const ASSET_KINDS = ["file", "doc", "image", "video", "link"] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export type ProjectAsset = {
  id: ID;
  /** Null for a document that belongs to the workspace, not to one project. */
  project_id: ID | null;
  kind: AssetKind;
  title: string;
  description: string | null;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  tags: string[];
  position: number;
  created_by: ID | null;
  created_at: string;
};

export type ProjectMarketer = {
  project_id: ID;
  affiliate_id: ID;
  status: "active" | "paused" | "left";
  note: string | null;
  joined_at: string;
};

export type Notification = {
  id: ID;
  audience: "admins" | "user";
  recipient_id: ID | null;
  actor_id: ID | null;
  kind: string;
  title: string;
  body: string | null;
  href: string | null;
  entity_type: string | null;
  entity_id: ID | null;
  read_at: string | null;
  created_at: string;
};

export type Board = {
  id: ID;
  name: string;
  emoji: string | null;
  description: string | null;
  project_id: ID | null;
  position: number;
  created_by: ID | null;
  created_at: string;
};

export type BoardColumn = {
  id: ID;
  board_id: ID;
  name: string;
  accent: Accent;
  position: number;
  wip_limit: number | null;
};

export type Task = {
  id: ID;
  title: string;
  notes: string | null;
  board_id: ID | null;
  column_id: ID | null;
  project_id: ID | null;
  client_id: ID | null;
  assignee_id: ID | null;
  priority: Priority;
  status: "todo" | "doing" | "blocked" | "done";
  due_date: string | null;
  estimate_minutes: number | null;
  labels: string[];
  position: number;
  completed_at: string | null;
  created_by: ID | null;
  created_at: string;
  updated_at: string;
};

export type Subtask = {
  id: ID;
  task_id: ID;
  title: string;
  done: boolean;
  position: number;
};

export type Note = {
  id: ID;
  title: string;
  content: string;
  cover: string | null;
  pinned: boolean;
  tags: string[];
  client_id: ID | null;
  project_id: ID | null;
  created_by: ID | null;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: ID;
  title: string;
  description: string | null;
  metric: string;
  target_value: number;
  current_value: number;
  period: "week" | "month" | "quarter" | "year";
  starts_on: string;
  ends_on: string | null;
  accent: Accent;
  status: "on_track" | "at_risk" | "behind" | "done";
  owner_id: ID | null;
  created_at: string;
  updated_at: string;
};

export const EVENT_KINDS = [
  "meeting",
  "call",
  "deadline",
  "reminder",
  "focus",
  "personal",
] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export type CalendarEvent = {
  id: ID;
  title: string;
  description: string | null;
  kind: EventKind;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  location: string | null;
  accent: Accent;
  client_id: ID | null;
  lead_id: ID | null;
  project_id: ID | null;
  created_by: ID | null;
  created_at: string;
};

export type Interaction = {
  id: ID;
  kind: "note" | "call" | "email" | "meeting" | "proposal" | "payment";
  summary: string;
  detail: string | null;
  client_id: ID | null;
  lead_id: ID | null;
  affiliate_id: ID | null;
  occurred_at: string;
  created_by: ID | null;
  created_at: string;
};

export type InvoiceKind = "invoice" | "receipt";

export type Invoice = {
  id: ID;
  number: string;
  client_id: ID | null;
  project_id: ID | null;
  /** The total, tax included. Kept in step with the lines on every save. */
  amount: number;
  currency: string;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
  kind: InvoiceKind;
  tax_rate: number;
  issued_on: string;
  due_on: string | null;
  paid_on: string | null;
  notes: string | null;
  created_at: string;
};

export type InvoiceItem = {
  id: ID;
  invoice_id: ID;
  description: string;
  quantity: number;
  unit_price: number;
  position: number;
  created_at: string;
};

/** The studio's own details, as they appear on a printed facture. */
export type WorkspaceSettings = {
  id: boolean;
  legal_name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  rc: string | null;
  nif: string | null;
  nis: string | null;
  art: string | null;
  bank_details: string | null;
  invoice_note: string | null;
  updated_at: string;
};

export type Commission = {
  id: ID;
  affiliate_id: ID;
  plan_id: ID | null;
  lead_id: ID | null;
  client_id: ID | null;
  invoice_id: ID | null;
  amount: number;
  commission_type: CommissionType;
  rate: number | null;
  status: "pending" | "approved" | "paid" | "cancelled";
  earned_on: string;
  paid_on: string | null;
  note: string | null;
  created_at: string;
};

export type Conversation = {
  id: ID;
  title: string | null;
  is_direct: boolean;
  topic: string | null;
  created_by: ID | null;
  last_message_at: string;
  created_at: string;
};

export type Message = {
  id: ID;
  conversation_id: ID;
  sender_id: ID;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  reply_to: ID | null;
  edited_at: string | null;
  created_at: string;
};

export type Activity = {
  id: ID;
  actor_id: ID | null;
  action: string;
  entity_type: string;
  entity_id: ID | null;
  entity_label: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

/* ------------------------------------------------------------ labels --- */

export const STAGE_LABEL: Record<LeadStage, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

export const STAGE_ACCENT: Record<LeadStage, Accent> = {
  new: "indigo",
  contacted: "plum",
  qualified: "amber",
  proposal: "clay",
  negotiation: "clay",
  won: "sage",
  lost: "rose",
};

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  active: "Active",
  on_hold: "On hold",
  review: "In review",
  done: "Delivered",
  cancelled: "Cancelled",
};

export const PROJECT_STATUS_ACCENT: Record<ProjectStatus, Accent> = {
  planning: "indigo",
  active: "sage",
  on_hold: "amber",
  review: "plum",
  done: "sage",
  cancelled: "rose",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PRIORITY_ACCENT: Record<Priority, Accent> = {
  low: "indigo",
  medium: "sage",
  high: "amber",
  urgent: "rose",
};

export const CLIENT_STATUS_ACCENT: Record<ClientStatus, Accent> = {
  active: "sage",
  paused: "amber",
  churned: "rose",
};

export const HEALTH_LABEL: Record<Client["health"], string> = {
  good: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
};

export const HEALTH_ACCENT: Record<Client["health"], Accent> = {
  good: "sage",
  watch: "amber",
  at_risk: "rose",
};

export const EVENT_KIND_ACCENT: Record<EventKind, Accent> = {
  meeting: "clay",
  call: "indigo",
  deadline: "rose",
  reminder: "amber",
  focus: "plum",
  personal: "sage",
};

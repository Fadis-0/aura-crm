"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  FileText,
  Film,
  ImageIcon,
  Link2,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { AssetKind, ProjectAsset } from "@/lib/types";

export const ASSET_BUCKET = "project-assets";

export const ASSET_META: Record<
  AssetKind,
  { label: string; icon: typeof FileText; accent: string }
> = {
  file: { label: "File", icon: Paperclip, accent: "indigo" },
  doc: { label: "Document", icon: FileText, accent: "clay" },
  image: { label: "Image", icon: ImageIcon, accent: "plum" },
  video: { label: "Video", icon: Film, accent: "rose" },
  link: { label: "Link", icon: Link2, accent: "sage" },
};

export function formatBytes(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Opens an asset: a link goes straight out, a stored file gets a short-lived
 * signed URL. The bucket is private, so there is no public URL to leak.
 */
export function useAssetOpener() {
  const [pending, setPending] = useState<string | null>(null);

  const open = async (asset: ProjectAsset) => {
    if (asset.url) {
      window.open(asset.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (!asset.storage_path) return;

    setPending(asset.id);
    const { data, error } = await supabaseBrowser()
      .storage.from(ASSET_BUCKET)
      .createSignedUrl(asset.storage_path, 60 * 5);
    setPending(null);

    if (error || !data) {
      toast.error(error?.message ?? "Could not open that file.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  return { open, pending };
}

export function AssetRow({
  asset,
  onDelete,
}: {
  asset: ProjectAsset;
  onDelete?: (asset: ProjectAsset) => void;
}) {
  const { open, pending } = useAssetOpener();
  const meta = ASSET_META[asset.kind] ?? ASSET_META.file;
  const Icon = meta.icon;
  const size = formatBytes(asset.size_bytes);
  const isLink = Boolean(asset.url);

  return (
    <li className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg"
        style={{
          background: `var(--${meta.accent}-soft)`,
          color: `var(--${meta.accent})`,
        }}
      >
        <Icon size={16} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{asset.title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-ink-4">
          {[meta.label, size, asset.description].filter(Boolean).join(" · ")}
        </p>
      </div>

      <button
        onClick={() => open(asset)}
        disabled={pending === asset.id}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5",
          "text-[12.5px] font-medium transition-colors hover:bg-surface-2 disabled:opacity-60",
        )}
      >
        {pending === asset.id ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isLink ? (
          <ExternalLink size={13} />
        ) : (
          <Download size={13} />
        )}
        {isLink ? "Open" : "Download"}
      </button>

      {onDelete ? (
        <button
          onClick={() => onDelete(asset)}
          aria-label="Delete asset"
          className="shrink-0 text-ink-4 opacity-0 transition-opacity hover:text-[var(--rose)] group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      ) : null}
    </li>
  );
}

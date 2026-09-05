"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  FolderOpen,
  HardDrive,
  Link2,
  Paperclip,
  Search,
  Tag,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/overlays";
import { Combobox } from "@/components/combobox";
import {
  ASSET_BUCKET,
  ASSET_META,
  AssetRow,
  formatBytes,
} from "@/components/assets/asset-kit";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useServerState } from "@/lib/use-server-state";
import { cn } from "@/lib/utils";
import { ASSET_KINDS, type AssetKind, type Project, type ProjectAsset } from "@/lib/types";

const MAX_BYTES = 50 * 1024 * 1024;

function guessKind(file: File): AssetKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || file.type.includes("word")) return "doc";
  return "file";
}

const safeName = (name: string) => name.replace(/[^\w.\-]+/g, "-").slice(-80);

const parseTags = (value: string) =>
  value
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

/**
 * Everything the workspace has on file, in one place. A document either
 * belongs to a project, which puts it in front of the marketers working that
 * project, or carries its own tags and stays internal.
 */
export function DocsHub({
  initialAssets,
  projects,
}: {
  initialAssets: ProjectAsset[];
  projects: Project[];
}) {
  const sb = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useServerState(initialAssets);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // What you can filter by: every project that has files, plus every tag used.
  const allTags = useMemo(
    () => [...new Set(assets.flatMap((a) => a.tags ?? []))].sort(),
    [assets],
  );

  const projectOf = (id: string | null) => projects.find((p) => p.id === id);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets
      .filter((a) => {
        if (scope === "all") return true;
        if (scope === "internal") return !a.project_id;
        if (scope.startsWith("tag:")) return (a.tags ?? []).includes(scope.slice(4));
        return a.project_id === scope;
      })
      .filter((a) =>
        q
          ? [a.title, a.description, projectOf(a.project_id)?.name, ...(a.tags ?? [])]
              .some((v) => String(v ?? "").toLowerCase().includes(q))
          : true,
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, query, scope, projects]);

  const totals = useMemo(() => {
    const stored = assets.filter((a) => a.storage_path);
    return {
      all: assets.length,
      files: stored.length,
      links: assets.length - stored.length,
      size: stored.reduce((s, a) => s + (a.size_bytes ?? 0), 0),
    };
  }, [assets]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;

    const projectId = draft.project || null;
    const tags = parseTags(draft.tags ?? "");
    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 50 MB.`);
        continue;
      }

      // The first folder decides who may read the file, so keep it the
      // project id, or "general" for internal documents.
      const folder = projectId ?? "general";
      const path = `${folder}/${Date.now()}-${safeName(file.name)}`;

      const { error: uploadError } = await sb.storage
        .from(ASSET_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (uploadError) {
        toast.error(`${file.name}: ${uploadError.message}`);
        continue;
      }

      const { data, error } = await sb
        .from("project_assets")
        .insert({
          project_id: projectId,
          kind: guessKind(file),
          title: file.name,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          tags,
        })
        .select("*")
        .single();

      if (error) {
        await sb.storage.from(ASSET_BUCKET).remove([path]);
        toast.error(error.message);
        continue;
      }

      setAssets((rows) => [data as ProjectAsset, ...rows]);
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Uploaded");
  };

  const addLink = async () => {
    const title = (draft.title ?? "").trim();
    const url = (draft.url ?? "").trim();
    if (!title || !url) return toast.error("A title and a URL, please.");

    setSaving(true);
    const { data, error } = await sb
      .from("project_assets")
      .insert({
        project_id: draft.project || null,
        kind: (draft.kind as AssetKind) || "link",
        title,
        url,
        description: draft.description || null,
        tags: parseTags(draft.tags ?? ""),
      })
      .select("*")
      .single();

    setSaving(false);
    if (error) return toast.error(error.message);

    setAssets((rows) => [data as ProjectAsset, ...rows]);
    setDraft({});
    setLinking(false);
    toast.success("Link added");
  };

  const remove = async (asset: ProjectAsset) => {
    setAssets((rows) => rows.filter((a) => a.id !== asset.id));
    if (asset.storage_path) {
      await sb.storage.from(ASSET_BUCKET).remove([asset.storage_path]);
    }
    const { error } = await sb.from("project_assets").delete().eq("id", asset.id);
    if (error) toast.error(error.message);
  };

  const chips = [
    { value: "all", label: "Everything", count: assets.length },
    {
      value: "internal",
      label: "Internal only",
      count: assets.filter((a) => !a.project_id).length,
    },
    ...projects
      .map((p) => ({
        value: p.id,
        label: p.name,
        count: assets.filter((a) => a.project_id === p.id).length,
        accent: p.accent,
      }))
      .filter((c) => c.count > 0),
    ...allTags.map((t) => ({
      value: `tag:${t}`,
      label: `#${t}`,
      count: assets.filter((a) => (a.tags ?? []).includes(t)).length,
    })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Documents"
        description="Every file and link you hold, tagged to a project or kept internal."
        actions={
          <>
            <Button size="sm" onClick={() => setLinking(true)}>
              <Link2 size={14} />
              Link
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? null : <Upload size={14} />}
              New
            </Button>
          </>
        }
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Documents", value: String(totals.all), color: "var(--clay)" },
          { label: "Stored files", value: String(totals.files), color: "var(--indigo)" },
          { label: "Links", value: String(totals.links), color: "var(--sage)" },
          {
            label: "On disk",
            value: formatBytes(totals.size) ?? "0 B",
            color: "var(--amber)",
          },
        ].map((s) => (
          <Card key={s.label} className="p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-4">
              {s.label}
            </p>
            <p
              className="mt-1.5 font-display text-[21px] leading-none tabular-nums"
              style={{ color: s.color }}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <button
              key={c.value}
              onClick={() => setScope(c.value)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-all",
                scope === c.value
                  ? "border-[var(--clay)] bg-[var(--clay-soft)] text-[var(--clay)]"
                  : "border-line bg-surface text-ink-3 hover:border-line-2 hover:text-ink",
              )}
            >
              {"accent" in c && c.accent ? (
                <span
                  className="h-2 w-2 rounded-sm"
                  style={{ background: `var(--${c.accent})` }}
                />
              ) : null}
              <span className="max-w-[160px] truncate">{c.label}</span>
              <span className="text-[10.5px] tabular-nums opacity-70">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full max-w-xs">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-4"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search documents…"
            className="pl-8"
          />
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<HardDrive size={19} />}
          title={assets.length === 0 ? "Nothing on file yet" : "Nothing matches that"}
          description={
            assets.length === 0
              ? "Upload contracts, brochures, creatives. Tag them to a project and the marketers on it get them automatically."
              : "Try another filter or search."
          }
          action={
            assets.length === 0 ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={14} />
                Upload a file
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((a) => {
              const project = projectOf(a.project_id);
              return (
                <div key={a.id}>
                  <AssetRow asset={a} onDelete={remove} />
                  {project || (a.tags ?? []).length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-[64px]">
                      {project ? (
                        <Badge accent={project.accent} dot>
                          {project.name}
                        </Badge>
                      ) : (
                        <Badge>Internal</Badge>
                      )}
                      {(a.tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[10.5px] text-ink-3"
                        >
                          <Tag size={9} />
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </ul>
        </Card>
      )}

      <p className="mt-4 flex items-start gap-2 text-[12px] leading-relaxed text-ink-4">
        <Paperclip size={13} className="mt-0.5 shrink-0" />
        A document tagged to a project is visible to every marketer working that
        project. Anything without a project stays between the two of you.
      </p>

      {/* --------------------------------------------------- upload options */}
      <Modal
        open={linking}
        onClose={() => setLinking(false)}
        title="Add a document"
        description="A link to a demo, a video, or a shared folder."
        footer={
          <>
            <Button onClick={() => setLinking(false)}>Cancel</Button>
            <Button variant="primary" onClick={addLink} loading={saving}>
              Add
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <Input
              autoFocus
              value={draft.title ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Brand guidelines"
            />
          </Field>
          <Field label="URL" required>
            <Input
              type="url"
              value={draft.url ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
              placeholder="https://…"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Kind">
              <Select
                value={draft.kind ?? "link"}
                onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
              >
                {ASSET_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ASSET_META[k].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Project" hint="leave empty to keep it internal">
              <Combobox
                value={draft.project ?? null}
                onChange={(v) => setDraft((d) => ({ ...d, project: v ?? "" }))}
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  accent: p.accent,
                }))}
                placeholder="Internal"
                clearLabel="Internal"
              />
            </Field>
          </div>

          <Field label="Tags" hint="comma separated">
            <Input
              value={draft.tags ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              placeholder="contract, pricing"
            />
          </Field>

          <Field label="Note" hint="optional">
            <Textarea
              rows={2}
              value={draft.description ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>

      {/* Where uploads land, set before picking files. */}
      <Card className="mt-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Field label="Uploads go to" hint="applies to the next upload">
              <Combobox
                value={draft.project ?? null}
                onChange={(v) => setDraft((d) => ({ ...d, project: v ?? "" }))}
                options={projects.map((p) => ({
                  value: p.id,
                  label: p.name,
                  accent: p.accent,
                }))}
                placeholder="Internal, no project"
                clearLabel="Internal, no project"
              />
            </Field>
          </div>
          <div className="min-w-[200px] flex-1">
            <Field label="With tags" hint="comma separated">
              <Input
                value={draft.tags ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                placeholder="contract, pricing"
              />
            </Field>
          </div>
          <Button
            variant="primary"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? null : <FolderOpen size={14} />}
            Choose files
          </Button>
        </div>
      </Card>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Link2, Paperclip, Upload } from "lucide-react";
import { Modal } from "@/components/overlays";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { ASSET_BUCKET, AssetRow } from "./asset-kit";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useServerState } from "@/lib/use-server-state";
import { ASSET_KINDS, type AssetKind, type ProjectAsset } from "@/lib/types";

const MAX_BYTES = 50 * 1024 * 1024;

function guessKind(file: File): AssetKind {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type === "application/pdf" || file.type.includes("word")) return "doc";
  return "file";
}

/** Strip anything that would upset a storage path. */
function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "-").slice(-80);
}

/**
 * The admin side of a project's asset library: upload files into the private
 * bucket, or add links to demos and videos. Marketers on the project see the
 * result read-only.
 */
export function AssetManager({
  projectId,
  initialAssets,
}: {
  projectId: string;
  initialAssets: ProjectAsset[];
}) {
  const sb = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useServerState(initialAssets);
  const [uploading, setUploading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [link, setLink] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} is over 50 MB.`);
        continue;
      }

      const path = `${projectId}/${Date.now()}-${safeName(file.name)}`;
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
          position: assets.length,
        })
        .select("*")
        .single();

      if (error) {
        // Do not leave an orphan behind in the bucket.
        await sb.storage.from(ASSET_BUCKET).remove([path]);
        toast.error(error.message);
        continue;
      }

      setAssets((rows) => [...rows, data as ProjectAsset]);
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    toast.success("Uploaded");
  };

  const addLink = async () => {
    const title = (link.title ?? "").trim();
    const url = (link.url ?? "").trim();
    if (!title || !url) return toast.error("A title and a URL, please.");

    setSaving(true);
    const { data, error } = await sb
      .from("project_assets")
      .insert({
        project_id: projectId,
        kind: (link.kind as AssetKind) || "link",
        title,
        url,
        description: link.description || null,
        position: assets.length,
      })
      .select("*")
      .single();

    setSaving(false);
    if (error) return toast.error(error.message);

    setAssets((rows) => [...rows, data as ProjectAsset]);
    setLink({});
    setLinking(false);
    toast.success("Link added");
  };

  const remove = async (asset: ProjectAsset) => {
    setAssets((rows) => rows.filter((a) => a.id !== asset.id));

    if (asset.storage_path) {
      await sb.storage.from(ASSET_BUCKET).remove([asset.storage_path]);
    }
    const { error } = await sb.from("project_assets").delete().eq("id", asset.id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
  };

  return (
    <Card>
      <CardHeader
        title="Marketer assets"
        subtitle={
          assets.length
            ? `${assets.length} ${assets.length === 1 ? "item" : "items"} marketers can use`
            : "Files and links for the people selling this"
        }
        action={
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => setLinking(true)}>
              <Link2 size={13} />
              Link
            </Button>
            <Button
              size="sm"
              variant="primary"
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? null : <Upload size={13} />}
              Upload
            </Button>
          </div>
        }
      />

      <input
        ref={fileRef}
        type="file"
        multiple
        hidden
        onChange={(e) => addFiles(e.target.files)}
      />

      {assets.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<Paperclip size={19} />}
            title="Nothing here yet"
            description="Upload the brochure, the price list, the creatives. Or add a link to a demo."
            className="py-8"
            action={
              <Button size="sm" variant="primary" onClick={() => fileRef.current?.click()}>
                <Upload size={13} />
                Upload a file
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {assets.map((a) => (
            <AssetRow key={a.id} asset={a} onDelete={remove} />
          ))}
        </ul>
      )}

      <Modal
        open={linking}
        onClose={() => setLinking(false)}
        title="Add a link"
        description="A demo, a video, a shared folder. Anything with a URL."
        width="sm"
        footer={
          <>
            <Button onClick={() => setLinking(false)}>Cancel</Button>
            <Button variant="primary" onClick={addLink} loading={saving}>
              Add link
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Title" required>
            <Input
              autoFocus
              value={link.title ?? ""}
              onChange={(e) => setLink((l) => ({ ...l, title: e.target.value }))}
              placeholder="Product demo video"
            />
          </Field>
          <Field label="URL" required>
            <Input
              type="url"
              value={link.url ?? ""}
              onChange={(e) => setLink((l) => ({ ...l, url: e.target.value }))}
              placeholder="https://…"
            />
          </Field>
          <Field label="Kind">
            <Select
              value={link.kind ?? "link"}
              onChange={(e) => setLink((l) => ({ ...l, kind: e.target.value }))}
            >
              {ASSET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k[0].toUpperCase() + k.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Note" hint="optional">
            <Textarea
              rows={2}
              value={link.description ?? ""}
              onChange={(e) => setLink((l) => ({ ...l, description: e.target.value }))}
            />
          </Field>
        </div>
      </Modal>
    </Card>
  );
}

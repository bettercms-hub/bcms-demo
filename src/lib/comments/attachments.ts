import { supabase } from "@/integrations/supabase/client";
import type { Attachment } from "@/lib/comments/types";

const BUCKET = "comment-attachments";
const ONE_YEAR = 60 * 60 * 24 * 365;

function extFor(file: File) {
  const fromName = file.name.includes(".") ? file.name.split(".").pop()! : "";
  const fromMime = file.type.split("/").pop() ?? "";
  return (fromName || fromMime || "bin").toLowerCase().slice(0, 8);
}

/** Upload a single image/file to the comments bucket. Returns an Attachment
 *  shaped object (url is a long-lived signed URL since the bucket is private). */
export async function uploadCommentAttachment(
  workspaceId: string,
  file: File,
): Promise<Attachment> {
  const id = crypto.randomUUID();
  const path = `${workspaceId}/${id}.${extFor(file)}`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error: sErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ONE_YEAR);
  if (sErr || !data) throw new Error(sErr?.message ?? "Failed to sign url");

  return { url: data.signedUrl, name: file.name, mime: file.type };
}

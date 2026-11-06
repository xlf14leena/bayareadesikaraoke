"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { hintClass, inputClass, labelClass, secondaryButton } from "@/components/ui";
import { shrinkImage, trimLightEdges } from "@/lib/shrink-image";

const MAX_BYTES = 4 * 1024 * 1024;
const isUploaded = (url: string | null) => !!url?.startsWith("/api/banners/");

/**
 * Banner picker for the group, event and date forms: upload an image, or paste
 * a link as before. Sends bannerFile, bannerUrl and bannerKeep, read by
 * bannerFromForm in src/lib/banner-upload.ts. With field="thumbnail" it picks a
 * group's square thumbnail instead (thumbnailFile, thumbnailUrl, thumbnailKeep),
 * previewed cropped the way the lists show it; `fallback` shows what is used
 * while there is none.
 */
export default function BannerField({
  current,
  hint,
  field = "banner",
  fallback,
}: {
  current: string | null;
  hint: string;
  field?: "banner" | "thumbnail";
  fallback?: ReactNode;
}) {
  const square = field === "thumbnail";
  const noun = square ? "thumbnail" : "banner";
  const fileInput = useRef<HTMLInputElement>(null);
  const [keep, setKeep] = useState(isUploaded(current));
  const [link, setLink] = useState(isUploaded(current) ? "" : (current ?? ""));
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => () => void (filePreview && URL.revokeObjectURL(filePreview)), [filePreview]);

  const preview = filePreview ?? (link.startsWith("http") ? link : keep ? current : null);

  const clearFile = () => {
    if (fileInput.current) fileInput.current.value = "";
    setFilePreview(null);
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    setError(undefined);
    if (!file) return setFilePreview(null);
    setPreparing(true);
    const ready = await shrinkImage(await trimLightEdges(file));
    setPreparing(false);
    if (ready.size > MAX_BYTES) {
      clearFile();
      return setError("That image is too large. Try one under 4 MB.");
    }
    if (ready !== file) {
      // Send the smaller copy with the form.
      try {
        const files = new DataTransfer();
        files.items.add(ready);
        input.files = files.files;
      } catch {
        // Older browsers keep the original; the server still checks its size.
      }
    }
    setLink("");
    setFilePreview(URL.createObjectURL(ready));
  };

  const remove = () => {
    clearFile();
    setLink("");
    setKeep(false);
    setError(undefined);
  };

  return (
    <div className="space-y-3">
      <span className={labelClass}>{square ? "Thumbnail image" : "Banner image"} (optional)</span>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt={square ? "Thumbnail preview" : "Banner preview"}
          className={
            square
              ? "h-28 w-28 rounded-xl border border-line bg-mist object-cover"
              : "h-auto max-h-64 w-full max-w-md rounded-lg border border-line bg-mist object-contain"
          }
        />
      ) : fallback ? (
        <div className="flex items-center gap-3">
          {fallback}
          <p className="text-sm text-ink-muted">No {noun} of its own. Lists show this for now.</p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">No {noun} of its own.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          name={`${field}File`}
          aria-label={`Upload a ${noun} image`}
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
          onChange={onFile}
          className={`${inputClass} max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-mist file:px-3 file:py-1 file:text-sm`}
        />
        {preview && (
          <button type="button" onClick={remove} className={secondaryButton}>
            Remove {noun}
          </button>
        )}
      </div>
      {preparing && <p className="text-sm text-ink-muted">Preparing image…</p>}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <label className="block">
        <span className="text-sm text-ink-muted">Or paste an image link</span>
        <input
          name={`${field}Url`}
          aria-label={`${square ? "Thumbnail" : "Banner"} image link`}
          type="url"
          value={link}
          onChange={(e) => {
            setLink(e.target.value);
            if (e.target.value) clearFile();
          }}
          placeholder="https://…"
          className={`${inputClass} mt-1`}
        />
      </label>
      {keep && !filePreview && !link && <input type="hidden" name={`${field}Keep`} value={current ?? ""} />}
      <span className={`block ${hintClass}`}>
        {square
          ? "A square image works best. The middle is shown, cropped to a square."
          : "A wide image works best. It is shown whole, nothing is cut off."}{" "}
        {hint}
      </span>
    </div>
  );
}

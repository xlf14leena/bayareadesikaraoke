"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { hintClass, inputClass, labelClass, secondaryButton } from "@/components/ui";
import { shrinkImage, trimLightEdges } from "@/lib/shrink-image";

const MAX_BYTES = 4 * 1024 * 1024;
const isUploaded = (url: string | null) => !!url?.startsWith("/api/banners/");

/**
 * Banner picker for the group, event and date forms: upload an image, or paste
 * a link as before. Sends bannerFile, bannerUrl and bannerKeep, read by
 * bannerFromForm in src/lib/banner-upload.ts.
 */
export default function BannerField({ current, hint }: { current: string | null; hint: string }) {
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
      <span className={labelClass}>Banner image (optional)</span>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Banner preview" className="h-auto max-h-64 w-full max-w-md rounded-lg border border-line bg-mist object-contain" />
      ) : (
        <p className="text-sm text-ink-muted">No banner of its own.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          name="bannerFile"
          aria-label="Upload a banner image"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
          onChange={onFile}
          className={`${inputClass} max-w-md file:mr-3 file:rounded-full file:border-0 file:bg-mist file:px-3 file:py-1 file:text-sm`}
        />
        {preview && (
          <button type="button" onClick={remove} className={secondaryButton}>
            Remove banner
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
          name="bannerUrl"
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
      {keep && !filePreview && !link && <input type="hidden" name="bannerKeep" value={current ?? ""} />}
      <span className={`block ${hintClass}`}>
        A wide image works best. It is shown whole, nothing is cut off. {hint}
      </span>
    </div>
  );
}

// Browser-only: used by upload forms before sending a photo to the server.

/**
 * Shrinks a photo to a JPEG of at most `maxSide` pixels on its longest side,
 * so it uploads quickly from a phone. Returns the original when the browser can't read the
 * format (for example HEIC outside Safari).
 */
export async function shrinkImage(file: File, maxSide = 2000): Promise<File> {
  if (file.size < 600 * 1024 && file.type !== "image/heic" && file.type !== "image/heif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

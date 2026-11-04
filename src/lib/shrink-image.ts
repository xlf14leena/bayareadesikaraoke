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

/**
 * Cuts off thin light strips along the edges of an image, such as a white
 * sliver left by a screenshot or a rough crop, so a banner's rounded corners
 * show. Trims at most 3% from each side; returns the original when there is
 * nothing to trim or the browser can't read the format.
 */
export async function trimLightEdges(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width: w, height: h } = bitmap;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    const light = (x: number, y: number) => {
      const i = (y * w + x) * 4;
      return data[i] > 225 && data[i + 1] > 225 && data[i + 2] > 225;
    };
    // A row or column counts as an edge strip when nearly all of it is light.
    const lightCol = (x: number) => {
      let n = 0;
      for (let y = 0; y < h; y++) if (light(x, y)) n++;
      return n >= h * 0.95;
    };
    const lightRow = (y: number) => {
      let n = 0;
      for (let x = 0; x < w; x++) if (light(x, y)) n++;
      return n >= w * 0.95;
    };
    const maxX = Math.floor(w * 0.03);
    const maxY = Math.floor(h * 0.03);
    let left = 0;
    while (left < maxX && lightCol(left)) left++;
    let right = 0;
    while (right < maxX && lightCol(w - 1 - right)) right++;
    let top = 0;
    while (top < maxY && lightRow(top)) top++;
    let bottom = 0;
    while (bottom < maxY && lightRow(h - 1 - bottom)) bottom++;
    if (left + right + top + bottom === 0) return file;

    const out = document.createElement("canvas");
    out.width = w - left - right;
    out.height = h - top - bottom;
    out.getContext("2d")!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

// Shrinks photos on the phone before upload, so they stay around 100 KB
// (Supabase free plan has 1 GB storage, and shop internet can be slow).

const MAX_BYTES = 100 * 1024;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Resize to at most `maxSize` px on the longest side and compress (WebP, JPEG fallback). */
export async function compressImage(file: File, maxSize = 800): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This phone can't process photos.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let best: Blob | null = null;
  for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4]) {
    let blob = await canvasToBlob(canvas, "image/webp", quality);
    // Older browsers return PNG when WebP isn't supported: use JPEG instead.
    if (!blob || blob.type !== "image/webp") blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (!blob) continue;
    best = blob;
    if (blob.size <= MAX_BYTES) break;
  }
  if (!best) throw new Error("Could not compress the photo.");
  return best;
}

export function extensionFor(blob: Blob) {
  return blob.type === "image/webp" ? "webp" : "jpg";
}

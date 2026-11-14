/**
 * Shrinks a phone photo before upload: longest side ≤ `max` px, JPEG. Phone
 * cameras produce 3–8 MB files; this makes them ~100–250 KB (fast on mobile
 * data, well under the server limit). Keeps the photo upright (EXIF).
 */
export async function resizePhoto(file: File, max = 1280): Promise<{ blob: Blob; width: number; height: number }> {
  const source = await loadImage(file);
  const scale = Math.min(1, max / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This phone cannot process photos.');
  context.drawImage(source.image, 0, 0, width, height);
  if ('close' in source.image) source.image.close();

  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= 1_400_000) return { blob, width, height };
  }
  throw new Error('That photo is too large even after resizing.');
}

async function loadImage(file: File): Promise<{ image: ImageBitmap | HTMLImageElement; width: number; height: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { image: bitmap, width: bitmap.width, height: bitmap.height };
    } catch {
      // Fall back to <img> below (older Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { image: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

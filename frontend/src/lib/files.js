const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Check a picked resume the same way everywhere: PDF only, 5 MB max. Returns an error string or ''. */
export function pdfError(file) {
  if (!file) return '';
  if (file.type !== 'application/pdf') return 'Please upload a PDF file';
  if (file.size > MAX_PDF_BYTES) return 'The PDF should be under 5 MB';
  return '';
}

/** Largest photo the browser is asked to open, so a huge file cannot freeze the page. */
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function openImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable')); };
    img.src = url;
  });
}

/**
 * Crop a photo to a centred square and shrink it to `size` pixels, as a JPEG.
 * Drawing it again also leaves out the photo's hidden details (EXIF), such as where it was taken.
 * Example: a 4000 x 3000 phone photo of 4 MB becomes a 320 x 320 JPEG of about 25 KB.
 */
export async function squarePhoto(file, size = 320) {
  if (!file?.type?.startsWith('image/')) throw new Error('Pick an image file, such as a JPG or PNG.');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('That photo is larger than 15 MB. Pick a smaller one.');
  let img;
  try {
    img = await openImage(file);
  } catch (err) {
    throw new Error('This browser cannot open that photo. Try a JPG or PNG.');
  }
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';  // transparent PNGs get a white background instead of black
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare that photo. Try another one.'))), 'image/jpeg', 0.88);
  });
}

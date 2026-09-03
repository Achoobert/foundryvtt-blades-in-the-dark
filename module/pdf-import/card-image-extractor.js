const UPLOAD_DIR = "blades68";

function getFilePickerClass() {
  return foundry.applications.apps?.FilePicker?.implementation ?? foundry.applications.apps.FilePicker;
}

export async function ensureUploadDirectory(subdir = "") {
  const FilePickerClass = getFilePickerClass();
  const target = subdir ? `${UPLOAD_DIR}/${subdir}` : UPLOAD_DIR;
  const segments = target.split("/");
  let built = "";
  for (const segment of segments) {
    built = built ? `${built}/${segment}` : segment;
    try {
      await FilePickerClass.createDirectory("data", built);
    } catch (err) {
      if (!String(err.message ?? err).includes("EEXIST")) throw err;
    }
  }
  return target;
}

export async function uploadImageBlob(blob, filename, subdir = "") {
  const FilePickerClass = getFilePickerClass();
  const targetDir = await ensureUploadDirectory(subdir);
  const file = new File([blob], filename, { type: blob.type || "image/png" });
  const response = await FilePickerClass.upload("data", targetDir, file, {});
  return response?.path ?? null;
}

/**
 * Renders one PDF page and returns { pageNumber, blob, url, width, height }.
 * The `url` is a local object URL suitable for an <img> preview.
 *
 * `maxPixels` caps the rendered longest side, lowering `scale` to fit rather
 * than asking the browser for a canvas it will refuse to allocate.
 */
export async function renderPdfPage(pdfDoc, pageNumber, { scale = 2, maxPixels = 0, type = "image/png", quality = 0.92 } = {}) {
  const page = await pdfDoc.getPage(pageNumber);
  let viewport = page.getViewport({ scale });
  if (maxPixels > 0) {
    const longest = Math.max(viewport.width, viewport.height);
    if (longest > maxPixels) viewport = page.getViewport({ scale: scale * (maxPixels / longest) });
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  return { pageNumber, blob, url: URL.createObjectURL(blob), width: canvas.width, height: canvas.height };
}

/**
 * Renders every page of a card-art PDF (one card per page, as in the
 * Blades '68 Faction Deck).
 */
export async function extractDeckCardImages(pdfDoc, options = {}) {
  const images = [];
  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    images.push(await renderPdfPage(pdfDoc, pageNumber, options));
  }
  return images;
}

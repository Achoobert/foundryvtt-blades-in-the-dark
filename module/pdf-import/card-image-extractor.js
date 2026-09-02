const UPLOAD_DIR = "import_rulebook";

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
 * Renders every page of a card-art PDF (one card per page, as in the
 * Blades '68 Faction Deck) to a PNG and returns { pageNumber, blob, url }.
 * The `url` is a local object URL suitable for an <img> preview.
 */
export async function extractDeckCardImages(pdfDoc, { scale = 2 } = {}) {
  const images = [];
  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    const page = await pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    await page.render({ canvasContext: context, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    images.push({ pageNumber, blob, url: URL.createObjectURL(blob) });
  }
  return images;
}

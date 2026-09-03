let pdfjsLibPromise = null;

export async function getPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("../vendor/pdfjs/pdf.mjs").then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = new URL(
        "systems/blades68/module/vendor/pdfjs/pdf.worker.mjs",
        window.location.origin
      ).href;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

export async function loadPdfDocument(file) {
  const pdfjsLib = await getPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  return loadingTask.promise;
}

// Import City Map from PDF
// This system does not ship the Blades '68 city map - the rulebook is not ours
// to redistribute. A GM who owns a copy points this macro at their own
// b68_citymap_print_v4.pdf; each page is rendered to a WebP locally, saved
// under blades68/maps, and turned into a gridless scene.
(async () => {
  const SYSTEM_ID = "blades68";
  const MAP_SUBDIR = "maps";
  const SCENE_NAME = "Doskvol City Map";
  // Pages wider than this are downscaled - the browser refuses very large
  // canvases, and Foundry has to load whatever we produce as a texture.
  const MAX_PIXELS = 6000;

  const { openFormDialog } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/lib/dialog-compat.js`)
  );
  const { loadPdfDocument } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/pdf-import/pdf-loader.js`)
  );
  const { renderPdfPage, uploadImageBlob } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/pdf-import/card-image-extractor.js`)
  );

  if (!game.user.isGM) {
    ui.notifications.warn("Only a GM can import the city map.");
    return;
  }

  const fileResult = await openFormDialog({
    title: "Import City Map",
    content: `
      <form>
        <p>Select your own copy of the Blades '68 city map PDF
        (<code>b68_citymap_print_v4.pdf</code>). This system does not include
        the rulebook or any art from it - nothing is bundled or downloaded, the
        PDF is rendered entirely in your browser.</p>
        <div class="form-group">
          <label>City Map PDF</label>
          <input type="file" name="mapFile" accept="application/pdf" required>
        </div>
      </form>
    `,
    okLabel: "Import Map",
    cancelLabel: "Cancel",
  });

  const file = fileResult?.mapFile;
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    ui.notifications.warn("No PDF was selected.");
    return;
  }

  ui.notifications.info("Rendering the city map - this can take a minute...");
  let pdfDoc;
  try {
    pdfDoc = await loadPdfDocument(file);
  } catch (err) {
    console.error(err);
    ui.notifications.error(`Could not read that PDF: ${err.message}`);
    return;
  }

  const SceneClass = foundry.documents?.Scene ?? Scene;
  const gridless = CONST?.GRID_TYPES?.GRIDLESS ?? 0;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
    const image = await renderPdfPage(pdfDoc, pageNumber, {
      scale: 4,
      maxPixels: MAX_PIXELS,
      type: "image/webp",
    });
    try {
      if (image.blob?.type !== "image/webp") {
        ui.notifications.error("This browser cannot encode WebP images.");
        return;
      }
      const suffix = pdfDoc.numPages > 1 ? `_p${pageNumber}` : "";
      const path = await uploadImageBlob(image.blob, `city_map${suffix}.webp`, MAP_SUBDIR);
      if (path) pages.push({ path, width: image.width, height: image.height, pageNumber });
    } finally {
      URL.revokeObjectURL(image.url);
    }
  }

  if (!pages.length) {
    ui.notifications.error("No map image could be saved.");
    return;
  }

  const sceneData = pages.map((page) => ({
    name: pages.length > 1 ? `${SCENE_NAME} (${page.pageNumber})` : SCENE_NAME,
    background: { src: page.path },
    width: page.width,
    height: page.height,
    padding: 0,
    backgroundColor: "#000000",
    grid: { type: gridless, size: 100 },
    tokenVision: false,
    fog: { exploration: false },
  })).filter((data) => !game.scenes.getName(data.name));

  const created = sceneData.length ? await SceneClass.createDocuments(sceneData) : [];
  const skipped = pages.length - created.length;
  ui.notifications.info(
    `Saved ${pages.length} map image${pages.length === 1 ? "" : "s"} to ${SYSTEM_ID}/${MAP_SUBDIR} and created ${created.length} scene${created.length === 1 ? "" : "s"}` +
    (skipped ? ` (${skipped} scene name already existed).` : ".")
  );
})();

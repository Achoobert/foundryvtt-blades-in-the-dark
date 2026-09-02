// Import Faction Images from PDF
// This system does not ship the Blades '68 Faction Deck or any art extracted
// from it - the rulebook is not ours to redistribute. Instead, a GM who owns
// a copy runs this macro, points it at their own PDF, and it renders each
// card to an image locally and assigns it to a faction in the "Blades '68
// Factions" compendium.
(async () => {
  const SYSTEM_ID = "blades68";
  const PACK_ID = `${SYSTEM_ID}.blades68_factions`;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  const { openFormDialog } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/lib/dialog-compat.js`)
  );
  const { loadPdfDocument } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/pdf-import/pdf-loader.js`)
  );
  const { extractDeckCardImages, uploadImageBlob } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/pdf-import/card-image-extractor.js`)
  );

  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications.error("The Blades '68 Factions compendium is not available.");
    return;
  }

  const fileResult = await openFormDialog({
    title: "Import Faction Images",
    content: `
      <form>
        <p>Select your own copy of the Blades '68 <strong>Faction Deck</strong> PDF
        (<code>b68_factiondeck_v1.pdf</code>). This system does not include the
        rulebook or any art from it - nothing is bundled or downloaded, the PDF
        is rendered entirely in your browser.</p>
        <div class="form-group">
          <label>Faction Deck PDF</label>
          <input type="file" name="deckFile" accept="application/pdf" required>
        </div>
      </form>
    `,
    okLabel: "Extract Images",
    cancelLabel: "Cancel",
  });

  const file = fileResult?.deckFile;
  if (!file || typeof file.arrayBuffer !== "function" || !file.size) {
    ui.notifications.warn("No PDF was selected.");
    return;
  }

  ui.notifications.info("Rendering PDF pages to images - this can take a minute for a large deck...");
  let images;
  try {
    const pdfDoc = await loadPdfDocument(file);
    images = await extractDeckCardImages(pdfDoc);
  } catch (err) {
    console.error(err);
    ui.notifications.error(`Could not read that PDF: ${err.message}`);
    return;
  }
  if (!images.length) {
    ui.notifications.warn("That PDF has no pages.");
    return;
  }

  const factionDocs = (await pack.getDocuments()).filter((item) => item.type === "faction");
  if (!factionDocs.length) {
    ui.notifications.error("No faction items were found in the compendium.");
    for (const image of images) URL.revokeObjectURL(image.url);
    return;
  }
  const sortedNames = factionDocs.map((doc) => doc.name).sort((a, b) => a.localeCompare(b));

  // Cards are matched to factions by page order as a starting guess only -
  // the deck's page order has no confirmed relationship to the compendium's
  // stored order, so every row must be reviewed and corrected by hand below.
  const rows = images
    .map((image, index) => {
      const guess = factionDocs[index]?.name ?? "";
      const options = ['<option value="">-- Skip --</option>']
        .concat(
          sortedNames.map(
            (name) =>
              `<option value="${escapeHtml(name)}" ${name === guess ? "selected" : ""}>${escapeHtml(name)}</option>`
          )
        )
        .join("");
      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid rgba(0,0,0,0.15);">
          <img src="${image.url}" style="width:70px;height:auto;border:1px solid rgba(0,0,0,0.2);flex:0 0 auto;">
          <span style="width:28px;flex:0 0 auto;opacity:0.6;">#${image.pageNumber}</span>
          <select name="assign_${index}" style="flex:1 1 auto;">${options}</select>
        </div>
      `;
    })
    .join("");

  const assignResult = await openFormDialog({
    title: "Assign Faction Art",
    content: `
      <form>
        <p>Each card was pre-matched to a faction by page order as a guess only -
        check every row against the artwork and fix any that are wrong before
        confirming. Rows left on "Skip" are not changed.</p>
        <div style="max-height:60vh;overflow-y:auto;">${rows}</div>
      </form>
    `,
    okLabel: "Assign Images",
    cancelLabel: "Cancel",
  });

  if (!assignResult) {
    for (const image of images) URL.revokeObjectURL(image.url);
    return;
  }

  const assignments = [];
  for (let index = 0; index < images.length; index++) {
    const name = assignResult[`assign_${index}`];
    if (!name) continue;
    const item = factionDocs.find((doc) => doc.name === name);
    if (item) assignments.push({ image: images[index], item });
  }

  if (!assignments.length) {
    ui.notifications.warn("No images were assigned.");
    for (const image of images) URL.revokeObjectURL(image.url);
    return;
  }

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  let updated = 0;
  try {
    for (const { image, item } of assignments) {
      const filename = `${item.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.png`;
      const path = await uploadImageBlob(image.blob, filename, "factions");
      if (!path) continue;
      await item.update({ img: path });
      updated++;
    }
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
    for (const image of images) URL.revokeObjectURL(image.url);
  }

  ui.notifications.info(`Updated ${updated} faction image${updated === 1 ? "" : "s"}.`);
})();

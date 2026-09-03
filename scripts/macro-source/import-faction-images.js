// Import Faction Images from PDF
// This system does not ship the Blades '68 decks or any art extracted from
// them - the rulebook is not ours to redistribute. Instead, a GM who owns a
// copy runs this macro, points it at their own PDFs, and it renders each card
// to an image locally and assigns it to a faction in the "Blades '68 Factions"
// compendium.
(async () => {
  const SYSTEM_ID = "blades68";
  const PACK_ID = `${SYSTEM_ID}.blades68_factions`;

  const { openFormDialog } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/lib/dialog-compat.js`)
  );
  const { loadPdfDocument } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/pdf-import/pdf-loader.js`)
  );
  const { extractDeckCardImages, uploadImageBlob } = await import(
    foundry.utils.getRoute(`systems/${SYSTEM_ID}/module/pdf-import/card-image-extractor.js`)
  );

  // The faction deck's page order, transcribed from the card faces and matched
  // to the compendium's faction names. Card on page N gets entry N of this
  // list; a page past the end of the list, or naming a faction the compendium
  // lacks, is skipped.
  const FACTION_DECK_ORDER_ARR = [
    "Anixis Field Unit",
    "The Ankhayat Consortium",
    "The Blackjacks",
    "USC Consulate",
    "Bluecoats",
    "The Burn Corps",
    "Burning Orange",
    "Carousel",
    "City Council",
    "D-13",
    "Deathsteaders",
    "The Dirt Barons",
    "The Fighting Goats",
    "The Gallo Family",
    "The Golden Hand",
    "The Keel Twins",
    "The Kethrys Lodge",
    "Leatherbacks",
    "The Limmerfield Gang",
    "Lord Scurlock",
    "The Lounge Rats",
    "Ministry of Discovery",
    "Ministry of Stability",
    "Mirror House",
    "New Dawn",
    "Old North Port Preservation Society",
    "Ink Lane Tabloids", // ? card reads "Inkrakes" - no exact compendium match
    "Red Torque",
    "SCORPION Syndicate",
    "Section 6",
    "Shattered Isles Congress of Unions (SICU)",
    "Silk",
    "Strangford-Michter Financial",
    "The Church",
    "The Palace",
    "The Strelai",
    "The Unseen",
    "The Tomorrow Program",
    "Xantara Pharm",
    "The Yammies", // ? card reads "Youth Action Movement" - Yammies is the likely match
  ];

  // The trouble deck: page 1 is the card back and pages 2-40 are trouble cards,
  // none of which belong to a faction. Pages 41 and up are the district
  // locations, which map onto the citizenry factions of the same name.
  const TROUBLE_DECK_ORDER_ARR = [
    "Barrowcleft",
    "Bowmore Fields",
    "Brightstone",
    "Charhollow",
    "Charterhall",
    "Coalridge",
    "Crowfoot",
    "The Docks",
    "Dunslough",
    "New Horizon",
    "Nightmarket",
    "Radiance",
    "Silkshore",
    "Six Towers",
    "Whitecrown",
  ];

  const DECKS = [
    {
      field: "factionFile",
      label: "Faction Deck",
      subdir: "factions",
      firstPage: 1,
      order: FACTION_DECK_ORDER_ARR,
    },
    {
      field: "troubleFile",
      label: "Trouble Deck",
      subdir: "locations",
      firstPage: 41,
      order: TROUBLE_DECK_ORDER_ARR,
    },
  ];

  const pack = game.packs.get(PACK_ID);
  if (!pack) {
    ui.notifications.error("The Blades '68 Factions compendium is not available.");
    return;
  }

  const fileResult = await openFormDialog({
    title: "Import Faction Images",
    content: `
      <form>
        <p>Select your own copies of the Blades '68 decks. This system does not
        include the rulebook or any art from it - nothing is bundled or
        downloaded, the PDFs are rendered entirely in your browser. Cards are
        matched to factions by page number, so use the unmodified official PDFs.
        Either deck may be left empty.</p>
        <div class="form-group">
          <label>Faction Deck PDF (<code>b68_factiondeck_v1.pdf</code>)</label>
          <input type="file" name="factionFile" accept="application/pdf">
        </div>
        <div class="form-group">
          <label>Trouble Deck PDF</label>
          <input type="file" name="troubleFile" accept="application/pdf">
        </div>
      </form>
    `,
    okLabel: "Extract Images",
    cancelLabel: "Cancel",
  });
  if (!fileResult) return;

  const isUsableFile = (file) => Boolean(file) && typeof file.arrayBuffer === "function" && file.size > 0;
  const selectedDecks = DECKS.filter((deck) => isUsableFile(fileResult[deck.field]));
  if (!selectedDecks.length) {
    ui.notifications.warn("No PDF was selected.");
    return;
  }

  const factionDocs = (await pack.getDocuments()).filter((item) => item.type === "faction");
  if (!factionDocs.length) {
    ui.notifications.error("No faction items were found in the compendium.");
    return;
  }
  const normalize = (name) => String(name).toLowerCase().replace(/[^a-z0-9]+/g, "");
  const docsByName = new Map(factionDocs.map((doc) => [normalize(doc.name), doc]));

  const wasLocked = pack.locked;
  if (wasLocked) await pack.configure({ locked: false });

  let updated = 0;
  try {
    for (const deck of selectedDecks) {
      ui.notifications.info(`Rendering the ${deck.label} - this can take a minute...`);
      let images;
      try {
        const pdfDoc = await loadPdfDocument(fileResult[deck.field]);
        images = await extractDeckCardImages(pdfDoc);
      } catch (err) {
        console.error(err);
        ui.notifications.error(`Could not read the ${deck.label}: ${err.message}`);
        continue;
      }

      const unmatched = [];
      try {
        for (const image of images) {
          const expected = deck.order[image.pageNumber - deck.firstPage];
          const item = expected ? docsByName.get(normalize(expected)) : null;
          if (!item) {
            if (expected) unmatched.push(`#${image.pageNumber} (${expected})`);
            continue;
          }
          const filename = `${item.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}.png`;
          const path = await uploadImageBlob(image.blob, filename, deck.subdir);
          if (!path) continue;
          await item.update({ img: path });
          updated++;
        }
      } finally {
        for (const image of images) URL.revokeObjectURL(image.url);
      }

      if (unmatched.length) {
        console.warn(`${SYSTEM_ID} | ${deck.label} cards left unassigned: ${unmatched.join(", ")}`);
      }
    }
  } finally {
    if (wasLocked) await pack.configure({ locked: true });
  }

  ui.notifications.info(`Updated ${updated} faction image${updated === 1 ? "" : "s"}.`);
})();

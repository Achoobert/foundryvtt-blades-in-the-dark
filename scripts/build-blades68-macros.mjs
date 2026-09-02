#!/usr/bin/env node
// Packs scripts/macro-source/*.js into packs/blades68_macros.db (NeDB, flat
// JSON-lines — same format as this system's other packs; no compilePack step).
// Re-running is idempotent (deterministic content-hash _ids).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(root, "scripts/macro-source");
const outPath = path.join(root, "packs/blades68_macros.db");

function stableId(name) {
  return crypto.createHash("sha256").update(`macro:${name.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

const MACROS = [
  {
    file: "assign-blades68-playbook.js",
    name: "Assign Blades '68 Playbook",
    img: "icons/svg/upgrade.svg",
  },
  {
    file: "import-faction-images.js",
    name: "Import Faction Images from PDF",
    img: "icons/svg/book.svg",
  },
];

const lines = MACROS.map(({ file, name, img }) => {
  const command = fs.readFileSync(path.join(sourceDir, file), "utf8");
  return JSON.stringify({
    _id: stableId(name),
    name,
    type: "script",
    author: "",
    img,
    scope: "global",
    command,
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
  });
});

fs.writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${outPath} (${MACROS.length} macro${MACROS.length === 1 ? "" : "s"})`);

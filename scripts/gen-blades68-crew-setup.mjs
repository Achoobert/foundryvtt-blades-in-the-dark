#!/usr/bin/env node
// Generates module/data/blades68-crew-setup.json from the Roll20 reference
// translation file. Output is consumed at runtime when a Blades '68 crew_type
// is added to a crew actor (contacts autofill).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const translation = JSON.parse(
  fs.readFileSync(path.join(root, "reference/blades68-translation.json"), "utf8")
);

// Maps Roll20 crew slug -> crew_type Item name (packs/blades68_crew_types.db).
const CREW_NAME_BY_SHEET_KEY = {
  dealers: "Dealers",
  hit_squad: "Hit Squad",
  militants: "Militants",
  racers: "Racers",
  shadows: "Shadows",
  utopians: "Utopians",
  vigilantes: "Vigilantes",
};

function stripHtml(str) {
  return String(str ?? "").replace(/<[^>]*>/g, "").trim();
}

const setup = {};

for (const [sheetKey, crewName] of Object.entries(CREW_NAME_BY_SHEET_KEY)) {
  const contacts = [];
  for (let i = 0; i < 8; i++) {
    const raw = translation[`crew_${sheetKey}_contact_${i}`];
    if (!raw) continue;
    const text = stripHtml(raw);
    const commaIdx = text.indexOf(",");
    const name = commaIdx === -1 ? text : text.slice(0, commaIdx).trim();
    const description_short = commaIdx === -1 ? "" : text.slice(commaIdx + 1).trim();
    if (!name) continue;
    contacts.push({ name, description_short });
  }

  setup[crewName] = {
    sheetKey,
    contactsTitle: "Contacts",
    contacts,
  };
}

const outPath = path.join(root, "module/data/blades68-crew-setup.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(setup, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
for (const [crewName, data] of Object.entries(setup)) {
  console.log(`  ${crewName}: contacts=${data.contacts.length}`);
}

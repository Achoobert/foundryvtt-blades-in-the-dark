#!/usr/bin/env node
// Generates module/data/blades68-playbook-setup.json from the Roll20 reference
// files (reference/blades68-sheetdata.json + blades68-translation.json).
// Output is consumed at runtime by the "Assign Blades '68 Playbook" macro.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sheetData = JSON.parse(fs.readFileSync(path.join(root, "reference/blades68-sheetdata.json"), "utf8"));
const translation = JSON.parse(fs.readFileSync(path.join(root, "reference/blades68-translation.json"), "utf8"));

// Maps the Roll20 sheet's playbook key to this system's class Item name
// (see packs/blades68_classes.db).
const CLASS_NAME_BY_SHEET_KEY = {
  ghost: "Ghost",
  hound: "Hound",
  hull: "Hull",
  intellectual: "Intellectual",
  operative: "Operative",
  paranormalist: "Paranormalist",
  radical: "Radical",
  swinger: "Swinger",
  time_traveler_future: "Time Traveler Future",
  time_traveler_past: "Time Traveler Past",
  vampire: "Vampire",
  veteran: "Veteran",
};

function stripHtml(str) {
  return String(str ?? "").replace(/<[^>]*>/g, "").trim();
}

const setup = {};

for (const [sheetKey, className] of Object.entries(CLASS_NAME_BY_SHEET_KEY)) {
  const pb = sheetData.playbook[sheetKey];
  if (!pb) throw new Error(`No playbook sheet data for key "${sheetKey}"`);

  // Contacts: playbook_<key>_friend_0..4 => "Name, a role"
  const contacts = [];
  for (let i = 0; i < 8; i++) {
    const raw = translation[`playbook_${sheetKey}_friend_${i}`];
    if (!raw) continue;
    const text = stripHtml(raw);
    const commaIdx = text.indexOf(",");
    const name = commaIdx === -1 ? text : text.slice(0, commaIdx).trim();
    const description_short = commaIdx === -1 ? "" : text.slice(commaIdx + 1).trim();
    contacts.push({ name, description_short });
  }

  // First playbook ability: first entry in pb.ability, resolved through translation.
  const firstAbilityKey = pb.ability?.[0];
  if (!firstAbilityKey) throw new Error(`No abilities listed for playbook "${sheetKey}"`);
  const firstAbilityName = stripHtml(translation[`playbook_ability_${firstAbilityKey}`]);
  if (!firstAbilityName) throw new Error(`No translation for playbook_ability_${firstAbilityKey}`);

  setup[className] = {
    sheetKey,
    contactsTitle: stripHtml(translation[`playbook_${sheetKey}_friends_title`] ?? "BITD.Contacts"),
    contacts,
    firstAbilityName,
  };
}

const outPath = path.join(root, "module/data/blades68-playbook-setup.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(setup, null, 2) + "\n");
console.log(`Wrote ${outPath}`);
for (const [className, data] of Object.entries(setup)) {
  console.log(`  ${className}: firstAbility="${data.firstAbilityName}" contacts=${data.contacts.length}`);
}

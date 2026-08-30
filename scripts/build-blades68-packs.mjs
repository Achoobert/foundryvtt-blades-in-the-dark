#!/usr/bin/env node
/**
 * Generates the Blades '68 compendium packs (packs/blades68_*.db) from the
 * official Roll20 Blades '68 sheet data checked into reference/.
 *
 * Sources (MIT-licensed, see NOTICE.md):
 *   reference/blades68-translation.json  - flat i18n key/value map (names, descriptions)
 *   reference/blades68-sheetdata.json    - playbook/crew-type/faction structure
 *                                           extracted from the sheet's embedded
 *                                           sheet-worker data block
 *
 * Run: node scripts/build-blades68-packs.mjs
 * Re-running is idempotent (deterministic content-hash _ids).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const translation = JSON.parse(fs.readFileSync(path.join(ROOT, "reference/blades68-translation.json"), "utf8"));
const sheetdata = JSON.parse(fs.readFileSync(path.join(ROOT, "reference/blades68-sheetdata.json"), "utf8"));

const ACTIONS = ["hunt", "study", "survey", "tinker", "finesse", "prowl", "skirmish", "wreck", "attune", "command", "consort", "sway"];

// Known translation.json keys that coincidentally have a "<key>_description"
// companion but are not gear (sheet-worker labels, not items).
const GEAR_EXCLUDE = new Set(["+heavy", "crew", "frame", "hack", "hunting_grounds", "playbook"]);

const FACTION_CATEGORY_BY_GROUP = {
  factions1: "Underworld",
  factions2: "Institutions",
  factions3: "Corporate & Community",
  factions4: "Fringe",
  factions5: "Citizenry"
};

const ROMAN_TIER = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

function tr(key) {
  return key ? String(translation[key] ?? "") : "";
}

function titleCase(slug) {
  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function titleFromKey(key, stripPrefix) {
  return titleCase(key.replace(new RegExp(`^${stripPrefix}`), ""));
}

function stableId(type, name) {
  return crypto.createHash("sha256").update(`${type}:${name.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

function makeDoc(type, name, system, img = "icons/svg/item-bag.svg") {
  const cleanName = name.replace(/\s+/g, " ").trim();
  return {
    _id: stableId(type, cleanName),
    name: cleanName,
    type,
    img,
    system,
    effects: [],
    folder: null,
    sort: 0,
    permission: { default: 0 },
    flags: {}
  };
}

/** Given a map of slug -> Set(restricting group titles), return slug -> single title, or "" if shared/universal. */
function singleOwnerOrBlank(refCounts) {
  const result = new Map();
  for (const [slug, titles] of refCounts.entries()) {
    result.set(slug, titles.size === 1 ? [...titles][0] : "");
  }
  return result;
}

// ---------------------------------------------------------------------------
// Classes (playbooks)
// ---------------------------------------------------------------------------

function buildAbilityOwners() {
  const owners = new Map();
  for (const [slug, pb] of Object.entries(sheetdata.playbook)) {
    const title = titleCase(slug);
    for (const abilitySlug of pb.ability || []) {
      if (!owners.has(abilitySlug)) owners.set(abilitySlug, new Set());
      owners.get(abilitySlug).add(title);
    }
  }
  return singleOwnerOrBlank(owners);
}

function buildClasses() {
  return Object.entries(sheetdata.playbook).map(([slug, pb]) => {
    const name = titleCase(slug);
    const base = pb.base || {};
    const base_skills = {};
    for (const a of ACTIONS) base_skills[a] = [Number(base[a] || 0)];

    const clues = [base.xp_condition, base.xp_condition2, base.xp_condition3].filter(Boolean).map(tr).filter(Boolean);

    const system = {
      description: tr(base.playbook_description),
      logic: "",
      experience_clues: clues.join("\n"),
      base_skills,
      special_resource: base.special_resource || ""
    };
    return makeDoc("class", name, system, "icons/svg/upgrade.svg");
  });
}

function buildAbilities() {
  const owners = buildAbilityOwners();
  const docs = [];
  const seen = new Set();
  for (const slug of owners.keys()) {
    const nameKey = `playbook_ability_${slug}`;
    const rawName = tr(nameKey);
    if (!rawName || seen.has(nameKey)) continue;
    seen.add(nameKey);
    const owner = owners.get(slug);
    const system = {
      description: tr(`${nameKey}_description`),
      class: owner,
      class_default: owner,
      price: "1",
      purchased: false
    };
    docs.push(makeDoc("ability", rawName, system));
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Crew types, crew abilities, crew upgrades
// ---------------------------------------------------------------------------

function buildCrewTypes() {
  return Object.entries(sheetdata.crew).map(([slug, ct]) => {
    const name = titleCase(slug);
    const base = ct.base || {};
    const description = tr(base.crew_description);
    const experience_clues = tr(base.crew_xp_condition);

    const turfs = {};
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(base, `claim_${i}_name`)) {
      const claimNameKey = base[`claim_${i}_name`];
      const claimDescKey = base[`claim_${i}_desc`];
      turfs[String(i)] = {
        name: tr(claimNameKey) || "BITD.Turf",
        value: false,
        description: tr(claimDescKey),
        connects: [],
        connected: [false, false, false, false]
      };
      i++;
    }

    const system = { description, experience_clues, turfs };
    return makeDoc("crew_type", name, system, "icons/svg/city.svg");
  });
}

function buildCrewAbilityOwners() {
  const owners = new Map();
  for (const [slug, ct] of Object.entries(sheetdata.crew)) {
    const title = titleCase(slug);
    for (const abilitySlug of ct.crewability || []) {
      if (!owners.has(abilitySlug)) owners.set(abilitySlug, new Set());
      owners.get(abilitySlug).add(title);
    }
  }
  return singleOwnerOrBlank(owners);
}

function buildCrewAbilities() {
  const owners = buildCrewAbilityOwners();
  const docs = [];
  const seen = new Set();
  for (const slug of owners.keys()) {
    const nameKey = `crew_ability_${slug}`;
    const rawName = tr(nameKey);
    if (!rawName || seen.has(nameKey)) continue;
    seen.add(nameKey);
    const owner = owners.get(slug);
    const system = {
      description: tr(`${nameKey}_description`),
      class: owner,
      class_default: owner,
      price: "1",
      purchased: false
    };
    docs.push(makeDoc("crew_ability", rawName, system));
  }
  return docs;
}

function buildCrewUpgrades() {
  const owners = new Map(); // nameKey -> Set(crew type titles)
  const numboxesByKey = new Map();
  for (const [slug, ct] of Object.entries(sheetdata.crew)) {
    const title = titleCase(slug);
    for (const up of ct.upgrade || []) {
      if (!owners.has(up.name)) owners.set(up.name, new Set());
      owners.get(up.name).add(title);
      numboxesByKey.set(up.name, up.numboxes || "1");
    }
  }
  const singleOwner = singleOwnerOrBlank(owners);

  return [...owners.keys()].map((nameKey) => {
    const rawName = tr(nameKey) || titleFromKey(nameKey, "crew_upgrade_");
    const system = {
      description: tr(`${nameKey}_description`),
      class: "",
      price: String(numboxesByKey.get(nameKey) || "1"),
      purchased: false,
      logic: "",
      crew_type: singleOwner.get(nameKey)
    };
    return makeDoc("crew_upgrade", rawName, system);
  });
}

// ---------------------------------------------------------------------------
// Gear items (universal + playbook-specific)
// ---------------------------------------------------------------------------

function buildUniversalGear() {
  const exclude_prefixes = [
    "crew_ability_",
    "playbook_ability_",
    "playbook_item_",
    "faction_",
    "crew_upgrade_",
    "claim_",
    "key-",
    "crew_",
    "playbook_",
    "gatherinfo_",
    "timebomb",
    "backinghelp",
    "coldopen",
    "strictures",
    "xp_"
  ];
  const actionKeys = new Set([...ACTIONS, "insight", "prowess", "resolve"]);

  const docs = [];
  for (const key of Object.keys(translation)) {
    if (key.endsWith("_description")) continue;
    if (actionKeys.has(key)) continue;
    if (GEAR_EXCLUDE.has(key)) continue;
    if (exclude_prefixes.some((p) => key.startsWith(p))) continue;
    const descKey = `${key}_description`;
    if (!Object.prototype.hasOwnProperty.call(translation, descKey)) continue;

    const rawName = tr(key);
    if (!rawName) continue;
    const system = {
      description: tr(descKey),
      class: "",
      load: "1"
    };
    docs.push(makeDoc("item", rawName, system));
  }
  return docs;
}

function buildPlaybookItems() {
  const docs = [];
  for (const [slug, pb] of Object.entries(sheetdata.playbook)) {
    const title = titleCase(slug);
    for (const entry of pb.playbookitem || []) {
      const rawName = tr(entry.name) || titleFromKey(entry.name, "playbook_item_");
      const system = {
        description: tr(entry.description),
        class: title,
        load: "0"
      };
      docs.push(makeDoc("item", rawName, system));
    }
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Factions
// ---------------------------------------------------------------------------

function buildFactions() {
  const docs = [];
  for (const [group, entries] of Object.entries(sheetdata.factions)) {
    const category = FACTION_CATEGORY_BY_GROUP[group] || "";
    for (const entry of entries) {
      const rawName = tr(entry.name);
      if (!rawName) continue;
      const tier = ROMAN_TIER[entry.tier] ?? 0;
      const holdValue = entry.hold === "S" ? 2 : 1;
      const system = {
        description: "",
        type: category,
        tier: String(tier),
        goal_1: "",
        goal_1_clock_max: 0,
        goal_2: "",
        goal_2_clock_max: 0,
        turf: "",
        assets: "",
        quirks: "",
        notables: "",
        allies: "",
        enemies: "",
        situation: "",
        goal_clock: 0,
        hold: { value: holdValue, max: 2, max_default: 2, name_default: "BITD.Hold", name: "BITD.Hold" },
        status: { value: [0], max: 7, max_default: 7, name_default: "BITD.Status", name: "BITD.Status" },
        notes: tr(`${entry.name}_notes`)
      };
      docs.push(makeDoc("faction", rawName, system, "icons/svg/city.svg"));
    }
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Write packs
// ---------------------------------------------------------------------------

function writePack(filename, docs) {
  const outPath = path.join(ROOT, "packs", filename);
  const lines = docs.map((d) => JSON.stringify(d));
  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`${filename}: ${docs.length} documents`);
}

const classes = buildClasses();
const abilities = buildAbilities();
const crewTypes = buildCrewTypes();
const crewAbilities = buildCrewAbilities();
const crewUpgrades = buildCrewUpgrades();
const items = [...buildUniversalGear(), ...buildPlaybookItems()];
const factions = buildFactions();

writePack("blades68_classes.db", classes);
writePack("blades68_abilities.db", abilities);
writePack("blades68_crew_types.db", crewTypes);
writePack("blades68_crew_abilities.db", crewAbilities);
writePack("blades68_crew_upgrades.db", crewUpgrades);
writePack("blades68_items.db", items);
writePack("blades68_factions.db", factions);

console.log("Done.");

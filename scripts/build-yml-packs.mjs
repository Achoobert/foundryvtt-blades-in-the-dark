#!/usr/bin/env node
/**
 * Compiles hand-authored YAML documents in yml_source/ into the Foundry
 * compendium .db files under packs/.
 *
 * Layout: yml_source/<group>/<name>.yml, one document per file. The group
 * directory picks the target pack (see PACK_BY_DIR); a `pack:` key in the file
 * overrides it.
 *
 * Playbook YAML may also list `abilities:` (name + description). Those upsert
 * into blades68_abilities.db. The first ability is the starting special
 * (`system.starting_ability` on the class). Names listed on more than one
 * playbook (e.g. Versatile) get a blank class restriction.
 *
 * Documents are upserted into the target pack by name, so YAML files can
 * override or extend whatever build-blades68-packs.mjs generated without
 * clobbering the rest of the pack. Existing _ids are reused; new documents get
 * a deterministic content hash so re-running is idempotent.
 *
 * Run: node scripts/build-yml-packs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "yml_source");
const PACKS_DIR = path.join(ROOT, "packs");

const PACK_BY_DIR = {
  crews: "blades68_crew_types.db",
  playbooks: "blades68_classes.db",
  factions: "blades68_factions.db",
  items: "blades68_items.db",
  abilities: "blades68_abilities.db"
};

const ABILITY_PACK = PACK_BY_DIR.abilities;

const ACTIONS = [
  "hunt",
  "study",
  "survey",
  "tinker",
  "finesse",
  "prowl",
  "skirmish",
  "wreck",
  "attune",
  "command",
  "consort",
  "sway"
];

const TURF_SIDES = ["left", "top", "right", "bottom"];
const TURF_COLS = 5;
const TURF_OPPOSITE = { left: "right", right: "left", top: "bottom", bottom: "top" };
// The base / lair claim starts owned and cannot be toggled on the sheet.
const BASE_TURF_NAMES = new Set(["base", "lair", "prison", "bitd.base", "bitd.lair", "bitd.prison"]);

const problems = [];

function warn(file, message) {
  problems.push(`${path.relative(ROOT, file)}: ${message}`);
}

function stableId(type, name) {
  return crypto.createHash("sha256").update(`${type}:${name.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

/** Cardinal side from slot `from` toward slot `to` on a TURF_COLS-wide grid, or null. */
function sideBetween(from, to, cols = TURF_COLS) {
  const fr = Math.floor((from - 1) / cols);
  const fc = (from - 1) % cols;
  const tr = Math.floor((to - 1) / cols);
  const tc = (to - 1) % cols;
  if (fr === tr && tc === fc + 1) return "right";
  if (fr === tr && tc === fc - 1) return "left";
  if (fc === tc && tr === fr + 1) return "bottom";
  if (fc === tc && tr === fr - 1) return "top";
  return null;
}

/**
 * Turfs are authored as an ordered list (slot = position) or as an explicit
 * numbered map. Foundry wants a map keyed "1".."N", each slot carrying the full
 * shape the crew/prison sheet templates read.
 *
 * `connects` in YAML may list neighbor slot ids (preferred) and/or literal side
 * names. Neighbor ids are translated to left/top/right/bottom and mirrored so
 * each bridge is drawn from both ends.
 */
function normalizeTurfs(raw, file) {
  const entries = Array.isArray(raw)
    ? raw.map((turf, index) => [String(index + 1), turf])
    : Object.entries(raw).sort(([a], [b]) => Number(a) - Number(b));

  const turfs = {};
  const sideSets = {};

  for (const [slot, turf] of entries) {
    if (turf === null || typeof turf !== "object") {
      warn(file, `turf slot ${slot} is not a mapping`);
      continue;
    }
    sideSets[slot] = new Set();
    const name = String(turf.name ?? "BITD.Turf");
    const isBase = BASE_TURF_NAMES.has(name.trim().toLowerCase());
    turfs[slot] = {
      name,
      value: isBase || turf.value === true,
      description: String(turf.description ?? ""),
      highlight: turf.highlight === true,
      connects: [],
      connected: TURF_SIDES.map(() => false)
    };
  }

  const slotNums = new Set(Object.keys(turfs).map(Number));

  for (const [slot, turf] of entries) {
    if (!turfs[slot]) continue;
    const from = Number(slot);
    const rawConnects = turf.connects == null ? [] : [turf.connects].flat();

    for (const entry of rawConnects) {
      if (TURF_SIDES.includes(entry)) {
        sideSets[slot].add(entry);
        continue;
      }

      const to = Number(entry);
      if (!Number.isInteger(to) || to < 1) {
        warn(file, `turf slot ${slot} has unknown connect "${entry}"`);
        continue;
      }
      if (to === from) {
        warn(file, `turf slot ${slot} connects to itself`);
        continue;
      }
      if (!slotNums.has(to)) {
        warn(file, `turf slot ${slot} connects to missing slot ${to}`);
        continue;
      }

      const side = sideBetween(from, to);
      if (!side) {
        warn(file, `turf slot ${slot} connects to non-adjacent slot ${to}`);
        continue;
      }

      sideSets[slot].add(side);
      sideSets[String(to)].add(TURF_OPPOSITE[side]);
    }
  }

  for (const slot of Object.keys(turfs)) {
    turfs[slot].connects = TURF_SIDES.filter((side) => sideSets[slot].has(side));
  }
  return turfs;
}

/**
 * Optional per-row claim headers (Dealers, Utopians). Authored as a list;
 * Foundry wants a map keyed "1".."N" with persisted tracker fields.
 */
function normalizeTurfHeaders(raw, file) {
  const entries = Array.isArray(raw)
    ? raw.map((header, index) => [String(index + 1), header])
    : Object.entries(raw).sort(([a], [b]) => Number(a) - Number(b));

  const headers = {};
  for (const [slot, header] of entries) {
    if (header === null || typeof header !== "object") {
      warn(file, `turf_headers slot ${slot} is not a mapping`);
      continue;
    }
    const select = Number(header.select ?? 0);
    const units = Number(header.units ?? 0);
    const selected = Array.isArray(header.selected)
      ? header.selected.map(String)
      : [];
    headers[slot] = {
      name: String(header.name ?? ""),
      subheader: String(header.subheader ?? ""),
      unlock: String(header.unlock ?? ""),
      select: Number.isFinite(select) ? select : 0,
      options: Array.isArray(header.options) ? header.options.map(String) : [],
      selected,
      units: Number.isFinite(units) ? units : 0,
      value: header.value === true,
      units_filled: Number(header.units_filled ?? 0) || 0
    };
  }
  return headers;
}

/** Playbook YAML may list only rated actions as `survey: 1` or `survey: [1]`. */
function normalizeBaseSkills(raw, file) {
  if (typeof raw !== "object" || Array.isArray(raw) || raw === null) {
    warn(file, "base_skills is not a mapping");
    return Object.fromEntries(ACTIONS.map((a) => [a, [0]]));
  }
  const skills = {};
  for (const action of ACTIONS) {
    const v = raw[action];
    const n = Array.isArray(v) ? Number(v[0] || 0) : Number(v || 0);
    skills[action] = [Number.isFinite(n) ? n : 0];
  }
  return skills;
}

/** Playbook YAML lists abilities as `{name, description}` maps, or bare names. First is starting unless `starting: true` is set. */
function parseAbilityList(raw, file) {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    warn(file, "abilities must be a list");
    return [];
  }
  const abilities = [];
  for (const [index, entry] of raw.entries()) {
    if (typeof entry === "string") {
      const name = entry.replace(/\s+/g, " ").trim();
      if (!name) warn(file, `ability ${index} is empty`);
      else abilities.push({ name, description: "", starting: index === 0 });
      continue;
    }
    if (entry === null || typeof entry !== "object") {
      warn(file, `ability ${index} is not a mapping`);
      continue;
    }
    const name = String(entry.name ?? "").replace(/\s+/g, " ").trim();
    if (!name) {
      warn(file, `ability ${index} missing name`);
      continue;
    }
    abilities.push({
      name,
      description: String(entry.description ?? ""),
      starting: entry.starting === true || (entry.starting == null && index === 0)
    });
  }
  return abilities;
}

function abilityDoc(name, description, owner) {
  return {
    _id: stableId("ability", name),
    name,
    type: "ability",
    img: "icons/svg/item-bag.svg",
    system: {
      description,
      class: owner,
      class_default: owner,
      price: "1",
      purchased: false
    },
    effects: [],
    folder: null,
    sort: 0,
    permission: { default: 0 },
    flags: {}
  };
}

function buildDoc(source, file) {
  const name = String(source.name ?? "").replace(/\s+/g, " ").trim();
  const type = String(source.type ?? "").trim();
  if (!name || !type) {
    warn(file, "missing required `name` or `type`");
    return null;
  }

  const system = { ...(source.system ?? {}) };
  delete system.abilities;
  if (system.turfs != null) system.turfs = normalizeTurfs(system.turfs, file);
  if (system.turf_headers != null) {
    system.turf_headers = normalizeTurfHeaders(system.turf_headers, file);
  }
  if (system.experience_clues != null) {
    system.experience_clues = Array.isArray(system.experience_clues)
      ? system.experience_clues.map((s) => String(s).trim()).filter(Boolean).join("\n")
      : String(system.experience_clues);
  }
  if (type === "class" || system.base_skills != null) {
    system.base_skills = normalizeBaseSkills(system.base_skills ?? {}, file);
  }

  return {
    _id: stableId(type, name),
    name,
    type,
    img: source.img ?? "icons/svg/item-bag.svg",
    system,
    effects: source.effects ?? [],
    folder: source.folder ?? null,
    sort: source.sort ?? 0,
    permission: source.permission ?? { default: 0 },
    flags: source.flags ?? {}
  };
}

function readSourceFiles() {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  const files = [];
  for (const group of fs.readdirSync(SOURCE_DIR, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupDir = path.join(SOURCE_DIR, group.name);
    for (const entry of fs.readdirSync(groupDir)) {
      if (!/\.ya?ml$/i.test(entry)) continue;
      files.push({ group: group.name, file: path.join(groupDir, entry) });
    }
  }
  return files;
}

function readPack(packFile) {
  const packPath = path.join(PACKS_DIR, packFile);
  if (!fs.existsSync(packPath)) return [];
  return fs
    .readFileSync(packPath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

function writePack(packFile, docs) {
  fs.mkdirSync(PACKS_DIR, { recursive: true });
  const packPath = path.join(PACKS_DIR, packFile);
  fs.writeFileSync(packPath, docs.map((d) => JSON.stringify(d)).join("\n") + "\n", "utf8");
}

const docsByPack = new Map();
const pendingAbilities = [];

function pushDoc(packFile, doc) {
  if (!docsByPack.has(packFile)) docsByPack.set(packFile, []);
  docsByPack.get(packFile).push(doc);
}

for (const { group, file } of readSourceFiles()) {
  const text = fs.readFileSync(file, "utf8");
  let source;
  try {
    source = yaml.load(text);
  } catch (err) {
    warn(file, `invalid YAML - ${err.message}`);
    continue;
  }
  if (source === null || source === undefined) continue; // empty placeholder file
  if (typeof source !== "object" || Array.isArray(source)) {
    warn(file, "expected a single document mapping at the top level");
    continue;
  }

  const requested = source.pack ?? PACK_BY_DIR[group];
  if (!requested) {
    warn(file, `no pack mapped for yml_source/${group}/ - add it to PACK_BY_DIR or set \`pack:\``);
    continue;
  }
  const packFile = path.basename(String(requested));
  if (!packFile.endsWith(".db")) {
    warn(file, `pack "${requested}" must be a .db filename inside packs/`);
    continue;
  }

  const doc = buildDoc(source, file);
  if (!doc) continue;
  pushDoc(packFile, doc);

  const abilities = parseAbilityList(source.abilities ?? source.system?.abilities, file);
  if (!abilities.length) continue;
  if (doc.type === "class") {
    doc.system.starting_ability = (abilities.find((a) => a.starting) ?? abilities[0]).name;
  }
  pendingAbilities.push({ playbook: doc.name, abilities });
}

const abilityOwners = new Map();
const abilityDefs = new Map();
for (const { playbook, abilities } of pendingAbilities) {
  for (const ability of abilities) {
    if (!abilityOwners.has(ability.name)) abilityOwners.set(ability.name, new Set());
    abilityOwners.get(ability.name).add(playbook);
    abilityDefs.set(ability.name, ability.description);
  }
}
for (const [name, description] of abilityDefs) {
  const owners = abilityOwners.get(name);
  const owner = owners.size === 1 ? [...owners][0] : "";
  pushDoc(ABILITY_PACK, abilityDoc(name, description, owner));
}

for (const [packFile, incoming] of docsByPack) {
  const existing = readPack(packFile);
  const indexByName = new Map(existing.map((doc, index) => [`${doc.type}:${doc.name}`, index]));

  let updated = 0;
  for (const doc of incoming) {
    const key = `${doc.type}:${doc.name}`;
    const index = indexByName.get(key);
    if (index === undefined) {
      indexByName.set(key, existing.push(doc) - 1);
      continue;
    }
    // Keep the _id already published in the pack so world references survive.
    existing[index] = { ...doc, _id: existing[index]._id };
    updated++;
  }

  writePack(packFile, existing);
  console.log(`${packFile}: ${updated} updated, ${incoming.length - updated} added (${existing.length} total)`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log("Done.");

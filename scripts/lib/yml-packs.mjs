/**
 * Shared helpers for lossless YAML <-> NeDB pack compile/extract.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export const PACK_MANIFEST = "_pack.yml";

/** Map Foundry packFolders name -> filesystem slug. */
export function folderSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Safe document filename from name (+ optional id suffix on collision). */
export function docSlug(name, id = "") {
  const base = String(name || "unnamed")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "unnamed";
  return id ? `${base}--${id}` : base;
}

export function loadSystemManifest(root) {
  return JSON.parse(fs.readFileSync(path.join(root, "system.json"), "utf8"));
}

/**
 * Build pack placement map from system.json:
 * { packName: { game, folderSlug, folderLabel, pack } }
 */
export function packPlacement(system) {
  const folderByPack = new Map();
  for (const folder of system.packFolders ?? []) {
    for (const packName of folder.packs ?? []) {
      folderByPack.set(packName, folder);
    }
  }

  const placement = new Map();
  for (const pack of system.packs ?? []) {
    const folder = folderByPack.get(pack.name);
    if (!folder) {
      throw new Error(`Pack "${pack.name}" missing from packFolders`);
    }
    const isBlades68 = folder.name === "Blades '68 Content";
    placement.set(pack.name, {
      game: isBlades68 ? "blades68" : "blades_in_the_dark",
      folderSlug: folderSlug(folder.name),
      folderLabel: folder.name,
      pack,
    });
  }
  return placement;
}

export function readNedb(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

export function writeNedb(filePath, docs) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const sorted = [...docs].sort((a, b) => {
    const ida = String(a._id ?? "");
    const idb = String(b._id ?? "");
    if (ida && idb && ida !== idb) return ida.localeCompare(idb);
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
  fs.writeFileSync(filePath, sorted.map((d) => JSON.stringify(d)).join("\n") + (sorted.length ? "\n" : ""));
  return sorted;
}

/** Recursively find every _pack.yml under sourceRoot. */
export function findPackManifests(sourceRoot) {
  const found = [];
  if (!fs.existsSync(sourceRoot)) return found;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === PACK_MANIFEST) found.push(full);
    }
  }
  walk(sourceRoot);
  return found.sort();
}

export function loadPackManifest(manifestPath) {
  const raw = yaml.load(fs.readFileSync(manifestPath, "utf8"));
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`${manifestPath}: expected mapping`);
  }
  for (const key of ["name", "label", "type", "path"]) {
    if (!raw[key]) throw new Error(`${manifestPath}: missing required \`${key}\``);
  }
  return raw;
}

/**
 * Load all document YAML files in a pack directory (not _pack.yml).
 * Returns { docs, problems }.
 */
export function loadPackDocuments(packDir) {
  const docs = [];
  const problems = [];
  const seenIds = new Map();
  const entries = fs
    .readdirSync(packDir)
    .filter((name) => /\.ya?ml$/i.test(name) && name !== PACK_MANIFEST)
    .sort();

  for (const entry of entries) {
    const file = path.join(packDir, entry);
    let source;
    try {
      source = yaml.load(fs.readFileSync(file, "utf8"));
    } catch (err) {
      problems.push(`${file}: invalid YAML - ${err.message}`);
      continue;
    }
    if (source == null) continue;
    if (typeof source !== "object" || Array.isArray(source)) {
      problems.push(`${file}: expected a single document mapping`);
      continue;
    }
    if (!source._id) {
      problems.push(`${file}: missing required \`_id\``);
      continue;
    }
    if (!source.name) {
      problems.push(`${file}: missing required \`name\``);
      continue;
    }
    const id = String(source._id);
    if (seenIds.has(id)) {
      problems.push(`${file}: duplicate _id ${id} (also ${seenIds.get(id)})`);
      continue;
    }
    seenIds.set(id, file);
    docs.push(source);
  }
  return { docs, problems };
}

/** Dump a Foundry document to YAML with multiline strings as block scalars. */
export function dumpDocumentYaml(doc) {
  return yaml.dump(doc, {
    lineWidth: 100,
    noRefs: true,
    sortingKeys: false,
    styles: {
      "!!str": "literal",
    },
  });
}

/**
 * Prefer literal block style only for multiline / long command-like strings.
 * js-yaml's styles map is coarse; post-process via custom type is overkill —
 * dump with default and force literal for known long fields when present.
 */
export function dumpDocumentYamlSmart(doc) {
  return yaml.dump(doc, {
    lineWidth: 120,
    noRefs: true,
    sortingKeys: false,
  });
}

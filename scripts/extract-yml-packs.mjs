#!/usr/bin/env node
/**
 * One-time (re-runnable) extraction: packs/*.db (+ LevelDB fallback) -> yml_source/.
 *
 * Layout mirrors system.json packFolders:
 *   yml_source/blades_in_the_dark/<folder>/<pack>/...
 *   yml_source/blades68/blades_68_content/<pack>/...
 *
 * Prefer NeDB .db when present; fall back to LevelDB directory (needed for hunting_grounds).
 *
 * Run: node scripts/extract-yml-packs.mjs
 * Optional: --clean  wipe yml_source before extract
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ClassicLevel } from "classic-level";
import {
  PACK_MANIFEST,
  packPlacement,
  loadSystemManifest,
  readNedb,
  docSlug,
  dumpDocumentYamlSmart,
} from "./lib/yml-packs.mjs";

function contentId(doc) {
  const key = [
    doc.type ?? "",
    doc.name ?? "",
    doc.system?.class ?? doc.system?.crew_type ?? "",
    doc.system?.description ?? doc.command ?? "",
  ].join("\0");
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "yml_source");
const PACKS_DIR = path.join(ROOT, "packs");

async function readLevelDb(dir) {
  if (!fs.existsSync(path.join(dir, "CURRENT"))) return null;
  const db = new ClassicLevel(dir, { keyEncoding: "utf8", valueEncoding: "utf8" });
  await db.open();
  const docs = [];
  for await (const [, value] of db.iterator()) {
    docs.push(JSON.parse(value));
  }
  await db.close();
  return docs;
}

function writePackMeta(packDir, pack) {
  const meta = {
    name: pack.name,
    label: pack.label,
    type: pack.type,
    path: pack.path.startsWith("./") ? pack.path : `./${pack.path}`,
  };
  if (pack.banner) meta.banner = pack.banner;
  const body = [
    `# Compendium manifest — compiled by scripts/build-yml-packs.mjs`,
    `name: ${JSON.stringify(meta.name)}`,
    `label: ${JSON.stringify(meta.label)}`,
    `type: ${JSON.stringify(meta.type)}`,
    `path: ${JSON.stringify(meta.path)}`,
  ];
  if (meta.banner) body.push(`banner: ${JSON.stringify(meta.banner)}`);
  body.push("");
  fs.writeFileSync(path.join(packDir, PACK_MANIFEST), body.join("\n"));
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

export async function extractYmlPacks({
  root = ROOT,
  sourceDir = SOURCE_DIR,
  packsDir = PACKS_DIR,
  clean = false,
} = {}) {
  const system = loadSystemManifest(root);
  const placement = packPlacement(system);
  const inventory = [];

  if (clean && fs.existsSync(sourceDir)) {
    rmrf(sourceDir);
  }
  fs.mkdirSync(sourceDir, { recursive: true });

  // Remove leftover curated trees that aren't the final hierarchy.
  for (const leftover of ["playbooks", "crews", "prisons", "abilities", "items", "factions", "macros", "og_blades"]) {
    const p = path.join(sourceDir, leftover);
    if (fs.existsSync(p)) rmrf(p);
  }

  for (const [packName, place] of placement) {
    const { pack, game, folderSlug } = place;
    const dbPath = path.join(packsDir, `${path.basename(pack.path).replace(/\.db$/i, "")}.db`);
    // system paths are ./packs/foo.db — resolve against root
    const resolvedDb = path.join(root, String(pack.path).replace(/^\.\//, ""));
    const levelDir = resolvedDb.replace(/\.db$/i, "");

    let docs = readNedb(resolvedDb);
    let source = "nedb";
    if (!docs) {
      docs = await readLevelDb(levelDir);
      source = "leveldb";
    }
    if (!docs) {
      throw new Error(`No NeDB or LevelDB data for pack "${packName}" (${resolvedDb} / ${levelDir})`);
    }

    const packDir = path.join(sourceDir, game, folderSlug, pack.name);
    // Rebuild this pack dir only
    rmrf(packDir);
    fs.mkdirSync(packDir, { recursive: true });
    writePackMeta(packDir, pack);

    const usedNames = new Map();
    const usedIds = new Map();
    for (const doc of docs) {
      if (!doc._id) {
        doc._id = contentId(doc);
        console.warn(`WARN ${packName}: "${doc.name}" missing _id; assigned ${doc._id}`);
      } else if (usedIds.has(doc._id)) {
        const old = doc._id;
        doc._id = contentId(doc);
        // Extremely rare: content also collides — fall back to counter.
        if (usedIds.has(doc._id) || doc._id === old) {
          doc._id = crypto
            .createHash("sha256")
            .update(`${old}:${usedIds.size}:${doc.system?.class ?? ""}:${doc.system?.description ?? ""}`)
            .digest("hex")
            .slice(0, 16);
        }
        console.warn(
          `WARN ${packName}: duplicate _id ${old} for "${doc.name}" (${doc.system?.class || "no class"}); reassigned ${doc._id}`
        );
      }
      usedIds.set(doc._id, doc.name);

      const classSlug = docSlug(doc.system?.class || doc.system?.crew_type || "");
      let slug = docSlug(doc.name);
      if (usedNames.has(slug) && classSlug) {
        slug = `${docSlug(doc.name)}--${classSlug}`;
      }
      if (usedNames.has(slug)) {
        slug = docSlug(doc.name, doc._id);
      }
      usedNames.set(slug, true);
      const file = path.join(packDir, `${slug}.yml`);
      fs.writeFileSync(file, dumpDocumentYamlSmart(doc));
    }

    inventory.push({
      name: packName,
      count: docs.length,
      source,
      dir: path.relative(root, packDir),
    });
    console.log(
      `${packName}: ${docs.length} docs from ${source} -> ${path.relative(root, packDir)}`
    );
  }

  // Clean empty / obsolete curated blades68 subdirs that aren't under blades_68_content
  const blades68Root = path.join(sourceDir, "blades68");
  if (fs.existsSync(blades68Root)) {
    for (const entry of fs.readdirSync(blades68Root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name === "blades_68_content") continue;
      rmrf(path.join(blades68Root, entry.name));
      console.log(`Removed obsolete ${path.join("yml_source/blades68", entry.name)}`);
    }
  }

  // Clean empty blades_in_the_dark placeholder dirs that aren't folder slugs
  const bitdRoot = path.join(sourceDir, "blades_in_the_dark");
  if (fs.existsSync(bitdRoot)) {
    const valid = new Set([...placement.values()].filter((p) => p.game === "blades_in_the_dark").map((p) => p.folderSlug));
    for (const entry of fs.readdirSync(bitdRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (valid.has(entry.name)) continue;
      rmrf(path.join(bitdRoot, entry.name));
      console.log(`Removed obsolete ${path.join("yml_source/blades_in_the_dark", entry.name)}`);
    }
  }

  return inventory;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const clean = process.argv.includes("--clean");
  try {
    const inventory = await extractYmlPacks({ clean });
    const total = inventory.reduce((n, i) => n + i.count, 0);
    console.log(`Done: ${inventory.length} packs, ${total} documents.`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

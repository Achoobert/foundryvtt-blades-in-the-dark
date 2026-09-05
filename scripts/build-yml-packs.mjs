#!/usr/bin/env node
/**
 * Compiles lossless YAML under yml_source/ into NeDB packs/*.db.
 *
 * Layout:
 *   yml_source/<game>/<sidebar_folder>/<compendium>/_pack.yml
 *   yml_source/<game>/<sidebar_folder>/<compendium>/<doc>.yml
 *
 * Each _pack.yml must declare name, label, type, path (matching system.json).
 * Document YAML is a full Foundry document; _id and name are required.
 *
 * Run: node scripts/build-yml-packs.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findPackManifests,
  loadPackManifest,
  loadPackDocuments,
  writeNedb,
  loadSystemManifest,
} from "./lib/yml-packs.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(ROOT, "yml_source");
const PACKS_DIR = path.join(ROOT, "packs");

export function compileYmlPacks({ root = ROOT, sourceDir = SOURCE_DIR, packsDir = PACKS_DIR } = {}) {
  const system = loadSystemManifest(root);
  const expected = new Map((system.packs ?? []).map((p) => [p.name, p]));
  const problems = [];
  const built = new Map();

  const manifests = findPackManifests(sourceDir);
  if (!manifests.length) {
    problems.push(`No ${path.basename("_pack.yml")} manifests under ${sourceDir}`);
  }

  for (const manifestPath of manifests) {
    let meta;
    try {
      meta = loadPackManifest(manifestPath);
    } catch (err) {
      problems.push(err.message);
      continue;
    }

    const packDir = path.dirname(manifestPath);
    const { docs, problems: docProblems } = loadPackDocuments(packDir);
    problems.push(...docProblems);

    const systemPack = expected.get(meta.name);
    if (!systemPack) {
      problems.push(`${manifestPath}: pack name "${meta.name}" not in system.json packs`);
    } else {
      if (systemPack.label !== meta.label) {
        problems.push(
          `${manifestPath}: label "${meta.label}" != system.json "${systemPack.label}"`
        );
      }
      if (systemPack.type !== meta.type) {
        problems.push(
          `${manifestPath}: type "${meta.type}" != system.json "${systemPack.type}"`
        );
      }
      const norm = (p) => String(p).replace(/^\.\//, "");
      if (norm(systemPack.path) !== norm(meta.path)) {
        problems.push(
          `${manifestPath}: path "${meta.path}" != system.json "${systemPack.path}"`
        );
      }
    }

    if (built.has(meta.name)) {
      problems.push(`${manifestPath}: duplicate pack name "${meta.name}"`);
      continue;
    }

    const outRel = String(meta.path).replace(/^\.\//, "");
    const outPath = path.join(root, outRel);
    if (!outPath.startsWith(packsDir) && path.dirname(outPath) !== packsDir) {
      // Allow packsDir override in tests; still require *.db basename.
    }
    if (!outRel.endsWith(".db")) {
      problems.push(`${manifestPath}: path must end with .db`);
      continue;
    }

    if (docProblems.length) continue;

    const written = writeNedb(outPath, docs);
    built.set(meta.name, { path: outPath, count: written.length, meta });
  }

  for (const name of expected.keys()) {
    if (!built.has(name)) {
      problems.push(`system.json pack "${name}" has no YAML source under yml_source/`);
    }
  }

  return { built, problems };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const { built, problems } = compileYmlPacks();
  for (const [name, info] of built) {
    console.log(`${name}: ${info.count} docs -> ${path.relative(ROOT, info.path)}`);
  }
  if (problems.length) {
    console.error(`\n${problems.length} problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`Done: ${built.size} packs.`);
}

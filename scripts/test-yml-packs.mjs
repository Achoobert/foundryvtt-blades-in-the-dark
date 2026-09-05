#!/usr/bin/env node
/**
 * Unit tests for lossless YAML pack compile/extract helpers.
 * Run: node --test scripts/test-yml-packs.mjs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  folderSlug,
  docSlug,
  findPackManifests,
  loadPackDocuments,
  writeNedb,
  readNedb,
  dumpDocumentYamlSmart,
  PACK_MANIFEST,
} from "./lib/yml-packs.mjs";
import { compileYmlPacks } from "./build-yml-packs.mjs";
import yaml from "js-yaml";

test("folderSlug mirrors sidebar names", () => {
  assert.equal(folderSlug("Character Options"), "character_options");
  assert.equal(folderSlug("Factions & NPCs"), "factions_and_npcs");
  assert.equal(folderSlug("Blades '68 Content"), "blades_68_content");
});

test("docSlug is filesystem-safe", () => {
  assert.equal(docSlug("Smash & Grab"), "smash-grab");
  assert.equal(docSlug("Foo", "abc"), "foo--abc");
});

test("writeNedb sorts by _id and is deterministic", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yml-packs-"));
  const file = path.join(dir, "t.db");
  writeNedb(file, [
    { _id: "b", name: "B" },
    { _id: "a", name: "A" },
  ]);
  writeNedb(file, [
    { _id: "a", name: "A" },
    { _id: "b", name: "B" },
  ]);
  const once = fs.readFileSync(file, "utf8");
  writeNedb(file, [
    { _id: "b", name: "B" },
    { _id: "a", name: "A" },
  ]);
  assert.equal(fs.readFileSync(file, "utf8"), once);
  assert.deepEqual(readNedb(file).map((d) => d._id), ["a", "b"]);
});

test("loadPackDocuments rejects missing _id and duplicates", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yml-packs-"));
  fs.writeFileSync(path.join(dir, "ok.yml"), "name: Ok\n_id: id1\ntype: item\n");
  fs.writeFileSync(path.join(dir, "bad.yml"), "name: Bad\ntype: item\n");
  fs.writeFileSync(path.join(dir, "dup.yml"), "name: Dup\n_id: id1\ntype: item\n");
  const { docs, problems } = loadPackDocuments(dir);
  assert.equal(docs.length, 1);
  assert.ok(problems.some((p) => p.includes("missing required `_id`")));
  assert.ok(problems.some((p) => p.includes("duplicate _id")));
});

test("dump/load round-trip preserves fields including multiline command", () => {
  const doc = {
    _id: "abc123",
    name: "Test Macro",
    type: "script",
    command: "const x = 1;\nconsole.log(x);\n",
    flags: { nested: { a: 1 } },
    ownership: { default: 0 },
  };
  const text = dumpDocumentYamlSmart(doc);
  const loaded = yaml.load(text);
  assert.deepEqual(loaded, doc);
});

test("compileYmlPacks discovers manifests and emits lossless NeDB", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yml-compile-"));
  const packsDir = path.join(root, "packs");
  const sourceDir = path.join(root, "yml_source");
  fs.mkdirSync(packsDir, { recursive: true });

  const system = {
    packs: [
      {
        name: "demo",
        label: "Demo",
        type: "Item",
        path: "./packs/demo.db",
      },
    ],
    packFolders: [{ name: "Character Options", packs: ["demo"] }],
  };
  fs.writeFileSync(path.join(root, "system.json"), JSON.stringify(system));

  const packDir = path.join(sourceDir, "blades_in_the_dark", "character_options", "demo");
  fs.mkdirSync(packDir, { recursive: true });
  fs.writeFileSync(
    path.join(packDir, PACK_MANIFEST),
    ["name: demo", "label: Demo", 'type: Item', "path: ./packs/demo.db", ""].join("\n")
  );
  const doc = {
    _id: "zz99",
    name: "Widget",
    type: "item",
    system: { description: "hello", extra: { keep: true } },
    flags: { x: 1 },
  };
  fs.writeFileSync(path.join(packDir, "widget.yml"), dumpDocumentYamlSmart(doc));

  assert.equal(findPackManifests(sourceDir).length, 1);

  const { built, problems } = compileYmlPacks({ root, sourceDir, packsDir });
  assert.deepEqual(problems, []);
  assert.equal(built.get("demo").count, 1);
  const out = readNedb(path.join(packsDir, "demo.db"));
  assert.deepEqual(out[0], doc);
});

test("compileYmlPacks fails when system.json pack missing from YAML", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "yml-compile-miss-"));
  const packsDir = path.join(root, "packs");
  const sourceDir = path.join(root, "yml_source");
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(
    path.join(root, "system.json"),
    JSON.stringify({
      packs: [{ name: "missing", label: "Missing", type: "Item", path: "./packs/missing.db" }],
      packFolders: [{ name: "Character Options", packs: ["missing"] }],
    })
  );
  const { problems } = compileYmlPacks({ root, sourceDir, packsDir });
  assert.ok(problems.some((p) => p.includes('pack "missing" has no YAML source')));
});

/**
 * DEPRECATED: wrote Foundry JSON into packs-source/. Compendiums now live as
 * lossless YAML under yml_source/ and compile via `npm run packs:build`.
 */
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildRoll20Documents } from './roll20-content.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const TRANSLATIONS_PATH = path.join(ROOT, 'example files from roll 20', 'translation copy.json');

function filenameFor(document) {
  const slug = document.name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '') || document.type;
  return `${slug}_${document._id}.json`;
}

async function replacePackSources(root, pack, documents) {
  const directory = path.join(root, 'packs-source', pack);
  await mkdir(directory, { recursive: true });

  for (const filename of await readdir(directory)) {
    if (filename.endsWith('.json')) await unlink(path.join(directory, filename));
  }

  for (const document of documents) {
    await writeFile(
      path.join(directory, filenameFor(document)),
      `${JSON.stringify(document, null, 2)}\n`
    );
  }
}

export async function writeRoll20Documents(translations, root = ROOT) {
  const documents = buildRoll20Documents(translations);

  await Promise.all([
    replacePackSources(root, 'playbooks', documents.playbooks),
    replacePackSources(root, 'items', documents.items),
    replacePackSources(root, 'factions', documents.factions)
  ]);

  return {
    playbooks: documents.playbooks.length,
    items: documents.items.length,
    factions: documents.factions.length
  };
}

async function main() {
  const translations = JSON.parse(await readFile(TRANSLATIONS_PATH, 'utf8'));
  const counts = await writeRoll20Documents(translations);
  console.log(
    `Generated ${counts.playbooks} playbook documents, ${counts.items} item documents, ` +
      `and ${counts.factions} faction documents.`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

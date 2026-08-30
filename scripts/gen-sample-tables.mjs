import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, 'packs-source', 'tables');

function genId() {
  return crypto.randomBytes(9).toString('hex').slice(0, 16);
}

function buildTable({ name, description, entries }) {
  const tableId = genId();
  const results = entries.map((text, index) => {
    const resultId = genId();
    return {
      _id: resultId,
      type: 0,
      text,
      weight: 1,
      range: [index + 1, index + 1],
      drawn: false,
      flags: {},
      _key: `!tables.results!${tableId}.${resultId}`
    };
  });

  return {
    name,
    img: 'icons/svg/d20-grey.svg',
    description,
    results,
    formula: `1d${entries.length}`,
    replacement: false,
    displayRoll: true,
    folder: null,
    sort: 0,
    flags: {},
    _id: tableId,
    _key: `!tables!${tableId}`
  };
}

const troubleDeck = buildTable({
  name: 'Trouble Deck (Sample)',
  description:
    'Starter sample of the Trouble Deck (see rule_books/b68_troubledeck_v1.pdf for the full deck). ' +
    'Draw without replacement mid-score when a complication is called for.',
  entries: [
    'A patrol crosses your path at the worst possible moment.',
    'The lock/security measure is tougher than expected.',
    'An old contact recognizes a member of the crew.',
    'The job site has changed since your information was gathered.',
    'A rival crew is already working an angle here.',
    'Someone talks too loud, too soon.',
    'The weather turns, complicating escape or approach.',
    'A witness sees more than they should.',
    'Equipment fails at a critical moment.',
    'A guard is more alert or capable than anticipated.',
    'An unexpected ally needs help right now.',
    'The plan leaks — someone already knows you are coming.'
  ]
});

const factionDeck = buildTable({
  name: 'Faction Deck (Sample)',
  description:
    'Starter sample of the Faction Deck (see rule_books/b68_factiondeck_v1.pdf for the full deck). ' +
    'Draw during downtime/planning to generate a faction opportunity or move.',
  entries: [
    'A faction offers a lucrative but morally grey job.',
    'Two factions escalate a turf dispute near your base.',
    'A faction leader requests a private meeting.',
    'A faction move threatens one of your claims.',
    'A faction extends an alliance offer with strings attached.',
    'A faction puts a bounty on someone connected to the crew.',
    'A faction\'s enforcer starts asking questions about you.',
    'A faction\'s hold weakens, creating an opening.',
    'A faction calls in an old favor.',
    'A faction publicly blames the crew for something they did not do.',
    'A faction\'s internal conflict spills into the open.',
    'A faction offers exclusive information for a price.'
  ]
});

const gatherInfo = buildTable({
  name: 'Gather Information — Sample Prompts',
  description: 'Small starter set of GM answer prompts for a successful gather-information roll.',
  entries: [
    'You learn a weakness or vulnerability to exploit.',
    'You learn who is really in charge here.',
    'You learn what/who is the biggest threat to your plan.',
    'You learn what is really going on beneath the surface.',
    'You learn the best way in, past, or through.',
    'You learn who benefits most if the job goes wrong.'
  ]
});

await mkdir(OUT_DIR, { recursive: true });
for (const table of [troubleDeck, factionDeck, gatherInfo]) {
  const filename = `${table.name.replace(/[^a-z0-9]+/gi, '_')}_${table._id}.json`;
  await writeFile(path.join(OUT_DIR, filename), JSON.stringify(table, null, 2));
  console.log(`Wrote ${filename}`);
}

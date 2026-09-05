/**
 * DEPRECATED: wrote Foundry JSON into packs-source/. Compendiums now live as
 * lossless YAML under yml_source/ and compile via `npm run packs:build`.
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function genId() {
  return crypto.randomBytes(9).toString('hex').slice(0, 16);
}

function buildItem(collectionKey, type, name, system) {
  const id = genId();
  return {
    _id: id,
    _key: `!${collectionKey}!${id}`,
    name,
    type,
    img: 'icons/svg/item-bag.svg',
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    system
  };
}

function buildFaction(name, system) {
  return { ...buildItem('items', 'faction', name, system), img: 'icons/svg/city.svg' };
}

async function writeDocs(subdir, docs) {
  const dir = path.join(ROOT, 'packs-source', subdir);
  await mkdir(dir, { recursive: true });
  for (const doc of docs) {
    const filename = `${doc.name.replace(/[^a-z0-9]+/gi, '_')}_${doc._id}.json`;
    await writeFile(path.join(dir, filename), JSON.stringify(doc, null, 2));
    console.log(`Wrote ${subdir}/${filename}`);
  }
}

const playbookDocs = [
  buildItem('items', 'playbook', 'Swinger', {
    description:
      '<p>A charismatic party-crasher who moves through high society and the underworld alike, ' +
      'gathering secrets and favors along the way.</p>',
    startingLoad: 'A blade or two, disguises, a flask of good liquor.',
    hueColor: '#c2185b'
  }),
  buildItem('items', 'ability', 'Yeah, Baby', {
    description:
      '<p>You agree on an NPC\'s countering circumstances so the party goes smoothly, ' +
      'or you complicate it for an edge on the crowd.</p>',
    playbook: 'swinger',
    unlocked: false
  }),
  buildItem('items', 'ability', 'Groove Machine', {
    description:
      '<p>You always know where the nearest music is playing, and when you start dancing, ' +
      'others feel compelled to join.</p>',
    playbook: 'swinger',
    unlocked: false
  })
];

const itemDocs = [
  buildItem('items', 'heritage', 'Dagger Isles/Akoros', {
    description: '<p>Raised among the trade routes and rivalries of the Dagger Isles.</p>'
  }),
  buildItem('items', 'vice', 'Pleasure', {
    description: '<p>You lose yourself in fine company, food, or company of a more private kind.</p>',
    purveyor: 'The Grove Factory, a discreet pleasure house'
  }),
  buildItem('items', 'gear', 'Fine Clothes', {
    description: '<p>A well-tailored outfit suited to high society.</p>',
    load: 1,
    carried: true
  }),
  buildItem('items', 'gear', 'Concealed Blade', {
    description: '<p>A slim knife, easy to hide.</p>',
    load: 0,
    carried: true
  }),
  buildItem('items', 'contact', 'Nolstrum, a Politician', {
    description: '<p>They hate that you know their secret.</p>',
    relationship: 'rival',
    faction: ''
  }),
  buildItem('items', 'crew-playbook', 'Militants', {
    description: '<p>Activists pushing revolutionary change against unjust authority.</p>'
  }),
  buildItem('items', 'crew-ability', 'Mutual Aid', {
    description:
      '<p>You lend support to one allied faction as you go. Your crew counts as one tier higher ' +
      "for that faction's long-term projects, if you wish.</p>",
    cost: 0,
    unlocked: false
  }),
  buildItem('items', 'upgrade', 'Secure Lounge', {
    description: '<p>Your lair includes a shared lounge as well as a hideout.</p>',
    quality: 1,
    purchased: false
  }),
  buildItem('items', 'cohort', 'Street Muscle', {
    description: '<p>A loyal gang of enforcers and lookouts.</p>',
    type: 'gang',
    quality: 1,
    harm: 0,
    armor: 0
  }),
  buildItem('items', 'claim', 'Meeting Hall', {
    description: '<p>Base claim: adds turf and a place to plan.</p>',
    controlled: true
  })
];

const factionDocs = [
  buildFaction('The Gallowmark Syndicate', {
    category: 'underworld',
    tier: 3,
    hold: 'strong',
    status: 0,
    war: false,
    notes: '<p>Sample underworld faction: a smuggling ring with fingers in every dock warehouse.</p>'
  }),
  buildFaction('Ironhook Watch', {
    category: 'institutions',
    tier: 4,
    hold: 'strong',
    status: -1,
    war: false,
    notes: '<p>Sample institutional faction: the city\'s overworked, under-trusted constabulary.</p>'
  }),
  buildFaction('Saltford Banking Concern', {
    category: 'corporate',
    tier: 4,
    hold: 'weak',
    status: 1,
    war: false,
    notes: '<p>Sample corporate faction: old money looking for new leverage.</p>'
  }),
  buildFaction('The Nightmarket Union', {
    category: 'citizenry',
    tier: 2,
    hold: 'weak',
    status: 0,
    war: false,
    notes: '<p>Sample citizenry faction: stallholders organized against extortion.</p>'
  })
];

await writeDocs('playbooks', playbookDocs);
await writeDocs('items', itemDocs);
await writeDocs('factions', factionDocs);

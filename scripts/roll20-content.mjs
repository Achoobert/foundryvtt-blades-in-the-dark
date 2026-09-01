import crypto from 'node:crypto';

const ACTION_KEYS = new Set([
  'attune',
  'command',
  'consort',
  'finesse',
  'hack',
  'hunt',
  'prowl',
  'skirmish',
  'study',
  'survey',
  'sway',
  'wreck',
  'insight',
  'prowess',
  'resolve'
]);

const NON_GEAR_KEYS = new Set([
  ...ACTION_KEYS,
  'crew',
  'frame',
  'hunting_grounds',
  'playbook',
  'playbook_gadgets'
]);

const FACTION_METADATA_KEYS = new Set([
  'faction_affiliation_info',
  'faction_affiliation_title',
  'faction_mode'
]);

function normalize(value) {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
}

export function stableId(type, name) {
  return crypto.createHash('sha256').update(`${type}:${normalize(name)}`).digest('hex').slice(0, 16);
}

function toHtml(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return `<p>${text.replace(/\r?\n/g, '<br>')}</p>`;
}

function titleFromKey(key) {
  return key
    .replace(/^playbook_item_/, '')
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function sourceDocument(type, name, system, { img = 'icons/svg/item-bag.svg' } = {}) {
  const cleanName = String(name).replace(/\s+/g, ' ').trim();
  const id = stableId(type, cleanName);
  return {
    _id: id,
    _key: `!items!${id}`,
    name: cleanName,
    type,
    img,
    effects: [],
    folder: null,
    sort: 0,
    ownership: { default: 0 },
    flags: {},
    system
  };
}

function byName(left, right) {
  return left.name.localeCompare(right.name, 'en-US');
}

function buildHeritages(translations) {
  return String(translations.heritage_info ?? '')
    .split('/')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => sourceDocument('heritage', name, { description: '' }));
}

function buildNamedFamily(translations, prefix, type, systemFor) {
  return Object.keys(translations)
    .filter(
      (key) =>
        key.startsWith(prefix) &&
        !key.endsWith('_description') &&
        !key.includes('_dc_action_') &&
        !key.includes('_dc_downtime_') &&
        /[\p{Letter}\p{Number}]/u.test(String(translations[key]))
    )
    .map((key) => {
      const name = String(translations[key]).trim();
      return sourceDocument(type, name, systemFor(key));
    });
}

function buildClaims(translations) {
  return buildNamedFamily(translations, 'claim_', 'claim', (key) => ({
    description: toHtml(translations[`${key}_description`]),
    controlled: false
  }));
}

function buildAbilities(translations) {
  return buildNamedFamily(translations, 'playbook_ability_', 'ability', (key) => ({
    description: toHtml(translations[`${key}_description`]),
    playbook: '',
    unlocked: false
  }));
}

function buildCrewAbilities(translations) {
  return buildNamedFamily(translations, 'crew_ability_', 'crew-ability', (key) => {
    const dcParts = [
      ['Action', translations[`${key}_dc_action_description`]],
      ['Downtime', translations[`${key}_dc_downtime_description`]]
    ]
      .filter(([, description]) => description)
      .map(([label, description]) => `<p><strong>${label}:</strong> ${String(description).trim()}</p>`);

    return {
      description: toHtml(translations[`${key}_description`]),
      dcDescription: dcParts.join(''),
      cost: 0,
      unlocked: false
    };
  });
}

function buildUpgrades(translations) {
  return Object.keys(translations)
    .filter((key) => key.startsWith('upgrade_') && key.endsWith('_description'))
    .map((descriptionKey) => {
      const baseKey = descriptionKey.slice(0, -'_description'.length);
      const shortKey = baseKey.slice('upgrade_'.length);
      const name = String(translations[baseKey] ?? translations[shortKey] ?? titleFromKey(shortKey)).trim();
      return sourceDocument('upgrade', name, {
        description: toHtml(translations[descriptionKey]),
        quality: 0,
        purchased: false
      });
    });
}

function buildFactions(translations) {
  return Object.keys(translations)
    .filter(
      (key) =>
        key.startsWith('faction_') &&
        !key.endsWith('_notes') &&
        !FACTION_METADATA_KEYS.has(key)
    )
    .map((key) => {
      const name = String(translations[key]).trim();
      return sourceDocument(
        'faction',
        name,
        {
          category: 'underworld',
          tier: 0,
          hold: 'weak',
          status: 0,
          war: false,
          description: '',
          turf: '',
          npcs: '',
          notableAssets: '',
          quirks: '',
          allies: '',
          enemies: '',
          situation: '',
          prestigeAbility: { name: '', description: '' },
          notes: toHtml(translations[`${key}_notes`])
        },
        { img: 'icons/svg/city.svg' }
      );
    });
}

function isGearKey(translations, key) {
  if (!Object.hasOwn(translations, `${key}_description`)) return false;
  if (NON_GEAR_KEYS.has(key)) return false;
  return !key.startsWith('claim_') &&
    !key.startsWith('crew_ability_') &&
    !key.startsWith('faction_') &&
    !key.startsWith('playbook_ability_') &&
    !key.startsWith('upgrade_');
}

function buildGear(translations) {
  return Object.keys(translations)
    .filter((key) => isGearKey(translations, key))
    .map((key) =>
      sourceDocument('gear', String(translations[key]).trim(), {
        description: toHtml(translations[`${key}_description`]),
        load: 1,
        carried: false,
        playbook: ''
      })
    );
}

function deduplicate(documents) {
  return [...new Map(documents.map((document) => [`${document.type}:${normalize(document.name)}`, document])).values()];
}

export function buildRoll20Documents(translations) {
  return {
    playbooks: deduplicate([...buildAbilities(translations), ...buildCrewAbilities(translations)]).sort(byName),
    items: deduplicate([
      ...buildHeritages(translations),
      ...buildClaims(translations),
      ...buildUpgrades(translations),
      ...buildGear(translations)
    ]).sort(byName),
    factions: deduplicate(buildFactions(translations)).sort(byName)
  };
}

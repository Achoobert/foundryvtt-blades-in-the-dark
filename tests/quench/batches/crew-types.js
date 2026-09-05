/* global Actor, game */
import { createdDocsTracker, requireSystemActive } from '../helpers.js';
import { BladesHelpers } from '/systems/blades68/module/blades-helpers.js';

/** Canonical side order emitted by scripts/build-yml-packs.mjs. */
const EXPECTED_SHADOWS_CONNECTS = {
  1: ['right', 'bottom'],
  2: ['left', 'right', 'bottom'],
  3: ['left'],
  4: ['left', 'top', 'right'],
  5: ['left', 'bottom'],
  6: ['top', 'right'],
  7: ['top', 'right', 'bottom'],
  8: ['left', 'top', 'right'],
  9: ['left', 'right', 'bottom'],
  10: ['left', 'top', 'right'],
  11: ['left', 'right', 'bottom'],
  12: ['left', 'top', 'right'],
  13: ['left', 'top', 'right', 'bottom'],
  14: ['left', 'right', 'bottom'],
  15: ['left', 'top', 'right'],
  16: ['top', 'right'],
  17: ['left', 'top', 'right'],
  18: ['left', 'right'],
  19: ['left', 'right'],
  20: ['left', 'top']
};

const B68_CREW_TYPES = [
  'Dealers',
  'Hit Squad',
  'Militants',
  'Racers',
  'Shadows',
  'Utopians',
  'Vigilantes'
];

export default function register(quench) {
  quench.registerBatch(
    'blades68.crew-types',
    (context) => {
      const { describe, it, assert, after } = context;
      const tracker = createdDocsTracker();

      after(async () => {
        await tracker.cleanup();
      });

      describe('Shadows crew type turfs', function () {
        it('ships 20 claims with the authored connector sides', async function () {
          this.timeout(10000);
          requireSystemActive();

          const pack = game.packs.get('blades68.blades68_crew_types');
          assert.isOk(pack, 'blades68.blades68_crew_types pack should exist');

          const docs = await pack.getDocuments();
          const shadows = docs.find((doc) => doc.name === 'Shadows' && doc.type === 'crew_type');
          assert.isOk(shadows, 'Shadows crew_type should be in the pack');

          const turfs = shadows.system.turfs ?? {};
          const slots = Object.keys(turfs);
          assert.lengthOf(
            slots,
            20,
            `Shadows should have 20 turf slots (got ${slots.length}: ${slots.join(',')})`
          );

          for (const [slot, expected] of Object.entries(EXPECTED_SHADOWS_CONNECTS)) {
            const actual = [...(turfs[slot]?.connects ?? [])];
            assert.deepEqual(
              actual,
              expected,
              `slot ${slot} (${turfs[slot]?.name}): expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            );
          }
        });
      });
      describe('Dealers and Utopians turf headers', function () {
        it('ships row headers with units / select / options', async function () {
          this.timeout(10000);
          requireSystemActive();

          const pack = game.packs.get('blades68.blades68_crew_types');
          assert.isOk(pack, 'blades68.blades68_crew_types pack should exist');

          const docs = await pack.getDocuments();
          const dealers = docs.find((doc) => doc.name === 'Dealers' && doc.type === 'crew_type');
          const utopians = docs.find((doc) => doc.name === 'Utopians' && doc.type === 'crew_type');
          const shadows = docs.find((doc) => doc.name === 'Shadows' && doc.type === 'crew_type');

          assert.isOk(dealers, 'Dealers crew_type should be in the pack');
          assert.isOk(utopians, 'Utopians crew_type should be in the pack');
          assert.isOk(shadows, 'Shadows crew_type should be in the pack');

          const dealersH1 = dealers.system.turf_headers?.['1'];
          assert.isOk(dealersH1, 'Dealers should have turf_headers.1');
          assert.equal(dealersH1.name, 'Supply');
          assert.equal(dealersH1.units, 30);
          assert.equal(dealersH1.units_filled, 0);
          assert.deepEqual(dealersH1.selected, []);

          const utopiansH1 = utopians.system.turf_headers?.['1'];
          assert.isOk(utopiansH1, 'Utopians should have turf_headers.1');
          assert.equal(utopiansH1.name, 'First Circle');
          assert.equal(utopiansH1.select, 2);
          assert.lengthOf(utopiansH1.options, 7);
          assert.deepEqual(utopiansH1.selected, []);
          assert.include(utopiansH1.options, 'Free');

          const utopiansH2 = utopians.system.turf_headers?.['2'];
          assert.isOk(utopiansH2?.unlock, 'Utopians header 2 should have unlock text');

          const shadowsHeaders = shadows.system.turf_headers;
          const shadowsHasNamed = shadowsHeaders
            && Object.values(shadowsHeaders).some((h) => h?.name);
          assert.isNotOk(shadowsHasNamed, 'Shadows should not ship named turf_headers');
        });
      });

      describe('Blades68Mode crew catalogs', function () {
        it('routes crew_type / crew_ability / crew_upgrade to blades68 packs', function () {
          requireSystemActive();
          assert.equal(BladesHelpers.getBlades68PackName('crew_type'), 'blades68_crew_types');
          assert.equal(BladesHelpers.getBlades68PackName('crew_ability'), 'blades68_crew_abilities');
          assert.equal(BladesHelpers.getBlades68PackName('crew_upgrade'), 'blades68_crew_upgrades');
        });

        it('lists B68 crew types/abilities/upgrades when Blades68Mode is on', async function () {
          this.timeout(15000);
          requireSystemActive();

          const priorMode = game.settings.get('blades68', 'Blades68Mode');
          await game.settings.set('blades68', 'Blades68Mode', true);
          try {
            const types = await BladesHelpers.getAllItemsByType('crew_type');
            for (const name of B68_CREW_TYPES) {
              assert.isOk(
                types.find((i) => i.name === name && i.type === 'crew_type'),
                `Blades68Mode crew_type list should include ${name}`
              );
            }

            const abilities = await BladesHelpers.getAllItemsByType('crew_ability');
            const abilityGroups = BladesHelpers.groupItemsByClass(abilities);
            assert.isOk(abilityGroups.Dealers?.length, 'Dealers crew abilities should group under Dealers');
            assert.isOk(abilityGroups['Hit Squad']?.length, 'Hit Squad crew abilities should group');

            const upgrades = await BladesHelpers.getAllItemsByType('crew_upgrade');
            const upgradeGroups = BladesHelpers.groupItemsByClass(upgrades);
            // B68 upgrades store ownership on system.crew_type (class is often blank).
            assert.isOk(upgradeGroups.Dealers?.length, 'Dealers upgrades should group via crew_type fallback');
            assert.isOk(upgradeGroups.Shadows?.length, 'Shadows upgrades should group via crew_type fallback');
          } finally {
            await game.settings.set('blades68', 'Blades68Mode', priorMode);
          }
        });

        it('keeps classic crew catalogs when Blades68Mode is off', async function () {
          this.timeout(15000);
          requireSystemActive();

          const priorMode = game.settings.get('blades68', 'Blades68Mode');
          await game.settings.set('blades68', 'Blades68Mode', false);
          try {
            const types = await BladesHelpers.getAllItemsByType('crew_type');
            assert.isOk(
              types.find((i) => i.name === 'Assassins' && i.type === 'crew_type'),
              'vanilla crew_type list should include Assassins'
            );
            assert.isNotOk(
              types.find((i) => i.name === 'Dealers' && i.type === 'crew_type'),
              'vanilla crew_type list should not include Dealers'
            );
          } finally {
            await game.settings.set('blades68', 'Blades68Mode', priorMode);
          }
        });
      });

      describe('Crew type contact generation', function () {
        it('creates six Dealers contacts, is idempotent, and keeps custom contacts', async function () {
          this.timeout(20000);
          requireSystemActive();

          // Force a fresh setup load in case a prior test poisoned the cache.
          BladesHelpers._crewSetupCache = undefined;

          const crew = tracker.track(await Actor.create({ name: 'Quench Dealers Crew', type: 'crew' }));
          await crew.update({
            'system.acquaintances': [
              {
                id: 'custom-keep-me',
                name: 'Custom Buddy',
                description_short: 'a homebrew contact',
                standing: 'friend'
              }
            ]
          });

          const created = await BladesHelpers.generateCrewTypeContacts(crew, 'Dealers');
          assert.equal(created, 6, 'should create six Dealers contacts');

          let acquaintances = crew.system.acquaintances ?? [];
          assert.lengthOf(acquaintances, 7, 'custom contact + six generated');
          assert.isOk(acquaintances.find((a) => a.name === 'Custom Buddy' && a.standing === 'friend'));
          assert.isOk(acquaintances.find((a) => a.name === 'Sevoy'));

          for (const acq of acquaintances.filter((a) => a.name !== 'Custom Buddy')) {
            const npc = game.actors.get(acq.id);
            assert.isOk(npc, `NPC actor should exist for ${acq.name}`);
            tracker.track(npc);
            assert.equal(npc.type, 'npc');
            assert.equal(npc.system.associated_crew_type, 'Dealers');
          }

          const again = await BladesHelpers.generateCrewTypeContacts(crew, 'Dealers');
          assert.equal(again, 0, 'rerun should create no duplicates');
          acquaintances = crew.system.acquaintances ?? [];
          assert.lengthOf(acquaintances, 7, 'idempotent rerun keeps the same acquaintance count');
          assert.lengthOf(
            acquaintances.filter((a) => a.name === 'Sevoy'),
            1,
            'Sevoy must appear only once'
          );
        });

        it('macro path: embeds Dealers crew_type then generates six contacts', async function () {
          this.timeout(20000);
          requireSystemActive();

          BladesHelpers._crewSetupCache = undefined;

          const pack = game.packs.get('blades68.blades68_crew_types');
          assert.isOk(pack, 'blades68.blades68_crew_types pack should exist');
          const docs = await pack.getDocuments();
          const dealers = docs.find((doc) => doc.name === 'Dealers' && doc.type === 'crew_type');
          assert.isOk(dealers, 'Dealers crew_type should be in the pack');

          const crew = tracker.track(
            await Actor.create({ name: 'Quench Macro Dealers Crew', type: 'crew' })
          );
          assert.lengthOf(
            crew.items.filter((i) => i.type === 'crew_type'),
            0,
            'blank crew should have no crew_type'
          );

          await crew.createEmbeddedDocuments('Item', [dealers.toObject()]);
          assert.lengthOf(
            crew.items.filter((i) => i.type === 'crew_type'),
            1,
            'should embed exactly one crew_type'
          );
          assert.equal(crew.items.find((i) => i.type === 'crew_type')?.name, 'Dealers');

          const created = await BladesHelpers.generateCrewTypeContacts(crew, 'Dealers');
          assert.equal(created, 6, 'should create six Dealers contacts after embedding type');

          const acquaintances = crew.system.acquaintances ?? [];
          assert.lengthOf(acquaintances, 6);
          assert.isOk(acquaintances.find((a) => a.name === 'Sevoy'));

          for (const acq of acquaintances) {
            const npc = game.actors.get(acq.id);
            assert.isOk(npc, `NPC actor should exist for ${acq.name}`);
            tracker.track(npc);
            assert.equal(npc.system.associated_crew_type, 'Dealers');
          }

          const again = await BladesHelpers.generateCrewTypeContacts(crew, 'Dealers');
          assert.equal(again, 0, 'rerun after embed path should create no duplicates');
        });
      });
    },
    { displayName: 'Crew types, catalogs, and contacts' }
  );
}

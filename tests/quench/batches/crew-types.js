/* global game */
import { requireSystemActive } from '../helpers.js';

/** Canonical side order emitted by scripts/build-yml-packs.mjs. */
const EXPECTED_SHADOWS_CONNECTS = {
  1: ['right', 'bottom'],
  2: ['left', 'right', 'bottom'],
  3: ['left', 'right'],
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

export default function register(quench) {
  quench.registerBatch(
    'blades68.crew-types',
    (context) => {
      const { describe, it, assert } = context;

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
    },
    { displayName: 'Crew type turfs' }
  );
}

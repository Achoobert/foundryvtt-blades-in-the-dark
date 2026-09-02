/* global game */
import { requireSystemActive } from '../helpers.js';

/** Canonical side order emitted by scripts/build-yml-packs.mjs. */
const EXPECTED_IRONHOOK_CONNECTS = {
  1: ['right', 'bottom'],
  2: ['right', 'bottom'],
  3: ['left'],
  4: ['left', 'top', 'bottom'],
  5: ['right', 'bottom'],
  6: ['left'],
  7: ['left'],
  8: ['right'],
  9: ['left']
};

export default function register(quench) {
  quench.registerBatch(
    'blades68.prison',
    (context) => {
      const { describe, it, assert } = context;

      describe('Ironhook Prison', function () {
        it('ships 9 claims copied from Ironhook with authored connectors', async function () {
          this.timeout(10000);
          requireSystemActive();

          const pack = game.packs.get('blades68.prison');
          assert.isOk(pack, 'blades68.prison pack should exist');

          const docs = await pack.getDocuments();
          const ironhook = docs.find((doc) => doc.name === 'Ironhook Prison' && doc.type === 'prison');
          assert.isOk(ironhook, 'Ironhook Prison should be in the prison pack');

          const turfs = ironhook.system.turfs ?? {};
          const slots = Object.keys(turfs);
          assert.lengthOf(
            slots,
            9,
            `Ironhook should have 9 turf slots (got ${slots.length}: ${slots.join(',')})`
          );

          assert.equal(turfs['4']?.name, 'Prison');
          assert.isTrue(turfs['4']?.value, 'Prison slot should start owned');
          assert.equal(turfs['1']?.name, 'Smuggling');
          assert.include(turfs['1']?.description ?? '', '+2 load');
          assert.equal(turfs['3']?.name, 'Cell Block Control');
          assert.include(turfs['3']?.description ?? '', 'trauma');
          assert.equal(turfs['5']?.name, 'Hardcase');
          assert.equal(turfs['6']?.name, 'Outside Claim');
          assert.equal(turfs['7']?.name, 'Guard Payoff');
          assert.equal(turfs['8']?.name, 'Smuggling');
          assert.equal(turfs['9']?.name, 'Parole Influence');

          for (const [slot, expected] of Object.entries(EXPECTED_IRONHOOK_CONNECTS)) {
            const actual = [...(turfs[slot]?.connects ?? [])];
            assert.deepEqual(
              actual,
              expected,
              `slot ${slot} (${turfs[slot]?.name}): expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
            );
          }
        });
      });
    },
    { displayName: 'Prison claims' }
  );
}

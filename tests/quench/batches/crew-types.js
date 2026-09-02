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
    },
    { displayName: 'Crew type turfs' }
  );
}

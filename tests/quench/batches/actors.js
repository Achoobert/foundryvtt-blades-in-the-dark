/* global Actor */
import { createdDocsTracker, requireSystemActive } from '../helpers.js';

export default function register(quench) {
  quench.registerBatch(
    'blades68.actors',
    (context) => {
      const { describe, it, assert, after } = context;
      const tracker = createdDocsTracker();

      after(async () => {
        await tracker.cleanup();
      });

      describe('character actor defaults', function () {
        it('creates a character with the Keys/Trauma/Coin defaults', async function () {
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench PC', type: 'character' }));

          assert.equal(actor.system.keys.max, 5);
          assert.lengthOf(actor.system.keys.list, 5);
          assert.isTrue(actor.system.keys.list.every((slot) => slot.key === ''), 'every slot should start empty and addable');
          assert.equal(actor.system.keys.list[0].marks, 0);
          assert.equal(actor.system.keys.list[0].deadlocked, false);

          assert.equal(actor.system.trauma.max, 4);
          assert.lengthOf(actor.system.trauma.options, 8);

          assert.equal(actor.system.stress.max, 9);
          assert.equal(actor.system.coins_max.hand, 4);
          assert.equal(actor.system.coins_max.stash, 40);
        });

        it('renders the character sheet without error', async function () {
          this.timeout(10000);
          const actor = tracker.track(await Actor.create({ name: 'Quench Sheet Render', type: 'character' }));
          const sheet = actor.sheet;

          await sheet._render(true);
          try {
            assert.isTrue(sheet.rendered);
            assert.isAbove(sheet.element.find('.window-content').length, 0);
          } finally {
            await sheet.close();
          }
        });
      });

      describe('crew actor defaults', function () {
        it('creates a crew with the tier/coin/turf/vault defaults', async function () {
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Crew', type: 'crew' }));

          assert.equal(actor.system.tier, 0);
          assert.equal(actor.system.coins.max, 4);
          assert.equal(actor.system.turf.max, 6);
          assert.equal(actor.system.max.heat, 9);
          assert.equal(actor.system.max.tier, 4);
          assert.equal(actor.system.max.wanted, 4);
          assert.equal(actor.system.max.rep, 12);
        });
      });
    },
    { displayName: 'Actor data model' }
  );
}

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
          assert.equal(actor.system.keys.list[0].experience, 0);
          assert.equal(actor.system.keys.list[0].deadlocked, false);
          assert.equal(actor.system.keys.list[0].deadlocked_to, '');

          assert.equal(actor.system.trauma.max, 4);
          assert.lengthOf(actor.system.trauma.options, 8);

          assert.equal(actor.system.stress.max, 9);
          assert.equal(actor.system.coins_max.hand, 4);
          assert.equal(actor.system.coins_max.stash, 40);
        });

        it('normalizes legacy marks/boomed Key slots into experience/deadlocked', async function () {
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Legacy Keys PC', type: 'character' }));
          await actor.update({
            'system.keys.list': [
              { key: 'Commanding', marks: 2, boomed: true, deadlocked_to: 'controlling' }
            ]
          });

          const keys = actor.getComputedKeys();
          assert.lengthOf(keys, 5);
          assert.equal(keys[0].key, 'Commanding');
          assert.equal(keys[0].experience, 2, 'marks should migrate into experience');
          assert.equal(keys[0].deadlocked, true, 'boomed should migrate into deadlocked');
          assert.equal(keys[0].deadlocked_to, 'controlling');
          assert.equal(keys[1].key, '', 'remaining slots should pad empty');
          assert.equal(keys[1].experience, 0);
          assert.equal(keys[1].deadlocked, false);
          assert.equal(keys[1].deadlocked_to, '');
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

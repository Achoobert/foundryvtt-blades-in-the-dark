/* global game */
import { requireSystemActive } from '../helpers.js';

export default function register(quench) {
  quench.registerBatch(
    'blades68.system',
    (context) => {
      const { describe, it, assert } = context;

      describe('Blades68 system config', function () {
        it('is the active system', function () {
          const system = requireSystemActive();
          assert.equal(system.id, 'blades68');
        });

        it('exposes the dice API on game.blades', function () {
          requireSystemActive();
          assert.isFunction(game.blades?.dice, 'game.blades.dice');
          assert.isFunction(game.blades?.roller, 'game.blades.roller');
        });

        it('registers the standard clock sizes', function () {
          requireSystemActive();
          assert.deepEqual(game.system.bladesClocks?.sizes, [4, 6, 8, 10, 12]);
        });

        it('registers the 8 core trauma types', function () {
          requireSystemActive();
          assert.lengthOf(game.system.traumas, 8);
        });

        it('registers 54 Blades68 personality Keys with matching localization keys', function () {
          requireSystemActive();
          const keys = game.system.blades68Keys;
          assert.lengthOf(keys, 54);
          for (const key of keys) {
            assert.equal(key.label, `BITD.Key${key.id}`);
            assert.equal(key.drift, `BITD.Key${key.id}Drift`);
          }
        });

        it('registers Blades68Mode as a boolean world setting, default off', function () {
          requireSystemActive();
          assert.isBoolean(game.settings.get('blades68', 'Blades68Mode'));
        });
      });
    },
    { displayName: 'System config' }
  );
}

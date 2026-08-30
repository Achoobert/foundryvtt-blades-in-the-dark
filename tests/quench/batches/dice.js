import { getBladesRollStatus, getBladesRollStress, getBladesRollVice } from '/systems/blades68/module/blades-roll.js';

function dice(...results) {
  return results.map((result) => ({ result }));
}

export default function register(quench) {
  quench.registerBatch(
    'blades68.dice-math',
    (context) => {
      const { describe, it, assert } = context;

      describe('action roll status (getBladesRollStatus)', function () {
        it('treats 1-3 as failure', function () {
          assert.equal(getBladesRollStatus(dice(1, 2, 3)), 'failure');
        });

        it('treats 4-5 as partial success', function () {
          assert.equal(getBladesRollStatus(dice(2, 5)), 'partial-success');
        });

        it('treats a single 6 as success', function () {
          assert.equal(getBladesRollStatus(dice(4, 6)), 'success');
        });

        it('treats two 6s as critical success', function () {
          assert.equal(getBladesRollStatus(dice(6, 6)), 'critical-success');
        });

        it('0d (zero mode) keeps the lowest of two d6', function () {
          assert.equal(getBladesRollStatus(dice(6, 6), true), 'success');
          assert.equal(getBladesRollStatus(dice(1, 6), true), 'failure');
          assert.equal(getBladesRollStatus(dice(4, 5), true), 'partial-success');
        });
      });

      describe('resistance stress (getBladesRollStress)', function () {
        it('two 6s clears all stress', function () {
          assert.equal(getBladesRollStress(dice(6, 6)), -1);
        });

        it('a single 6 costs zero stress', function () {
          assert.equal(getBladesRollStress(dice(3, 6)), 0);
        });

        it('costs the gap between the highest die and 6', function () {
          assert.equal(getBladesRollStress(dice(2, 4)), 2);
        });

        it('0d (zero mode) keeps the lowest die', function () {
          assert.equal(getBladesRollStress(dice(6, 6), true), -1);
          assert.equal(getBladesRollStress(dice(2, 3), true), 4);
        });
      });

      describe('indulge vice stress cleared (getBladesRollVice)', function () {
        it('uses the highest die by default', function () {
          assert.equal(getBladesRollVice(dice(2, 5)), 5);
        });

        it('uses the lowest die in 0d (zero mode)', function () {
          assert.equal(getBladesRollVice(dice(2, 5), true), 2);
        });
      });
    },
    { displayName: 'Dice math' }
  );
}

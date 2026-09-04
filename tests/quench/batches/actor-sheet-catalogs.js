/* global Actor, Item, foundry, game */
import { createdDocsTracker, requireSystemActive } from '../helpers.js';
import { BladesHelpers } from '/systems/blades68/module/blades-helpers.js';

/**
 * Fire a change event and poll `until` (if given) rather than trusting a fixed delay — the
 * listener's createEmbeddedDocuments/deleteEmbeddedDocuments round-trips through the same
 * socket as everything else in the world, so a flat sleep occasionally isn't long enough
 * under load. Always waits at least one tick even without an `until` predicate.
 */
async function fireChange(checkbox, until) {
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  if (!until) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return;
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (until()) return;
  }
}

export default function register(quench) {
  quench.registerBatch(
    'blades68.actor-sheet-catalogs',
    (context) => {
      const { describe, it, assert, after } = context;
      const tracker = createdDocsTracker();

      after(async () => {
        await tracker.cleanup();
      });

      describe('Special Abilities checklist', function () {
        it('lists only the equipped class\'s abilities, and checking one adds the matching owned item', async function () {
          this.timeout(10000);
          requireSystemActive();

          const className = `Quench Class ${foundry.utils.randomID()}`;
          const classItem = tracker.track(await Item.create({ name: className, type: 'class' }));
          const abilitySource = tracker.track(
            await Item.create({
              name: `(${className}) Test Ability`,
              type: 'ability',
              system: { class: className, description: 'A test ability.' }
            })
          );
          // An ability belonging to a different class must never show up in the catalog.
          tracker.track(
            await Item.create({
              name: '(Other Class) Unrelated Ability',
              type: 'ability',
              system: { class: 'Some Other Class' }
            })
          );

          const actor = tracker.track(await Actor.create({ name: 'Quench Abilities PC', type: 'character' }));
          await actor.createEmbeddedDocuments('Item', [classItem.toObject()]);

          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            const data = await sheet.getData();
            assert.lengthOf(data.abilityCatalog, 1, 'catalog should only contain the equipped class\'s ability');
            assert.equal(data.abilityCatalog[0].name, 'Test Ability');
            assert.equal(data.abilityCatalog[0].ownedCount, 0);

            // A checkbox's change handler is bound at the render that produced it; toggling
            // ownership re-renders the sheet (fresh DOM, freshly-bound listeners), so each step
            // re-queries the live element instead of reusing a reference from a prior render.
            const abilityCheckbox = () => sheet.element.find('.special-abilities-panel .catalog-toggle').get(0);
            const ownsAbility = () => actor.items.some((i) => i.type === 'ability' && i.name === abilitySource.name);

            let checkbox = abilityCheckbox();
            assert.isOk(checkbox, 'the ability checkbox should be rendered');
            assert.isFalse(checkbox.checked);

            checkbox.checked = true;
            await fireChange(checkbox, ownsAbility);
            assert.isTrue(
              actor.items.some((i) => i.type === 'ability' && i.name === abilitySource.name),
              'checking the box should create the owned ability item'
            );

            checkbox = abilityCheckbox();
            checkbox.checked = false;
            await fireChange(checkbox, () => !ownsAbility());
            assert.isFalse(
              actor.items.some((i) => i.type === 'ability' && i.name === abilitySource.name),
              'unchecking the box should remove the owned ability item'
            );
          } finally {
            await sheet.close();
          }
        });

        it("keeps abilities the actor owns outside the equipped class's catalog visible as Other Abilities", async function () {
          this.timeout(10000);
          requireSystemActive();

          const className = `Quench Class ${foundry.utils.randomID()}`;
          const classItem = tracker.track(await Item.create({ name: className, type: 'class' }));

          const actor = tracker.track(await Actor.create({ name: 'Quench Veteran Pick PC', type: 'character' }));
          await actor.createEmbeddedDocuments('Item', [
            classItem.toObject(),
            { name: '(Some Other Class) Borrowed Ability', type: 'ability', system: { class: 'Some Other Class' } }
          ]);

          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            const data = await sheet.getData();
            assert.lengthOf(data.abilityCatalog, 0);
            assert.lengthOf(data.otherAbilities, 1);
            assert.equal(data.otherAbilities[0].name, '(Some Other Class) Borrowed Ability');
          } finally {
            await sheet.close();
          }
        });
      });

      describe('Loadout checklist', function () {
        it('renders one checkbox per system.num_available slot and reconciles owned copies when toggled', async function () {
          this.timeout(10000);
          requireSystemActive();

          const className = `Quench Class ${foundry.utils.randomID()}`;
          const classItem = tracker.track(await Item.create({ name: className, type: 'class' }));
          tracker.track(
            await Item.create({
              name: 'Test Bandolier',
              type: 'item',
              system: { class: className, num_available: 2 }
            })
          );

          const actor = tracker.track(await Actor.create({ name: 'Quench Loadout PC', type: 'character' }));
          await actor.createEmbeddedDocuments('Item', [classItem.toObject()]);

          const sheet = actor.sheet;
          // A checkbox's change handler is bound at the render that produced it; toggling an
          // owned count re-renders the sheet (fresh DOM, freshly-bound listeners), so each step
          // re-queries the live element instead of reusing a reference from a prior render.
          const slotCheckbox = (slot) => sheet.element.find(`.items-panel .catalog-toggle[data-slot="${slot}"]`).get(0);

          await sheet._render(true);
          try {
            const data = await sheet.getData();
            assert.lengthOf(data.itemCatalog, 1);
            assert.equal(data.itemCatalog[0].slots, 2);
            assert.equal(data.itemCatalog[0].ownedCount, 0);

            assert.lengthOf(
              sheet.element.find('.items-panel .catalog-toggle').toArray(),
              2,
              'should render 2 slot checkboxes for num_available: 2'
            );

            const ownedBandoliers = () => actor.items.filter((i) => i.type === 'item' && i.name === 'Test Bandolier');

            let checkbox = slotCheckbox(1);
            checkbox.checked = true;
            await fireChange(checkbox, () => ownedBandoliers().length === 1);
            assert.lengthOf(
              actor.items.filter((i) => i.type === 'item' && i.name === 'Test Bandolier'),
              1,
              'checking one slot should create one owned copy'
            );

            checkbox = slotCheckbox(2);
            checkbox.checked = true;
            await fireChange(checkbox, () => ownedBandoliers().length === 2);
            assert.lengthOf(
              actor.items.filter((i) => i.type === 'item' && i.name === 'Test Bandolier'),
              2,
              'checking both slots should create a second owned copy'
            );

            checkbox = slotCheckbox(2);
            checkbox.checked = false;
            await fireChange(checkbox, () => ownedBandoliers().length === 1);
            assert.lengthOf(
              actor.items.filter((i) => i.type === 'item' && i.name === 'Test Bandolier'),
              1,
              'unchecking a slot should remove one owned copy'
            );
          } finally {
            await sheet.close();
          }
        });

        it('only counts items with system.equipped true toward system.loadout', async function () {
          requireSystemActive();

          const actor = tracker.track(await Actor.create({ name: 'Quench Load Sum PC', type: 'character' }));
          await actor.createEmbeddedDocuments('Item', [
            { name: 'Carried Sword', type: 'item', system: { load: 3, equipped: true } },
            { name: 'Stashed Anchor', type: 'item', system: { load: 5, equipped: false } },
            { name: 'Unset Equip Item', type: 'item', system: { load: 2 } }
          ]);

          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            const data = await sheet.getData();
            assert.equal(
              data.system.loadout,
              3,
              'only the equipped item\'s load should count toward system.loadout'
            );
          } finally {
            await sheet.close();
          }
        });
      });

      describe('Keys & Deadlocks', function () {
        it('normalizes a keys.list that Foundry stored as an index-keyed object instead of an array', async function () {
          // Partial dot-notation updates (e.g. "system.keys.list.0.key", which is exactly what
          // the per-slot <select>/<input> names on the sheet produce) can leave Foundry's merge
          // with {"0": {...}, "1": {...}} instead of a real array. getComputedKeys() — and thus
          // the whole sheet render — must not crash on that shape; this reproduces a live actor
          // hitting "list.map is not a function" during getData().
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Keys Object-Shape PC', type: 'character' }));
          await actor.update({
            'system.keys.list': { 0: { key: 'Defiant', marks: 1, deadlocked: false } }
          });
          assert.isFalse(Array.isArray(actor.system.keys.list), 'setup should reproduce the object-shaped list');

          const keys = actor.getComputedKeys();
          assert.lengthOf(keys, 5, 'should still pad to 5 slots');
          assert.equal(keys[0].key, 'Defiant', 'the existing slot should be preserved, not dropped');
          assert.equal(keys[0].experience, 1, 'legacy marks should migrate into experience');

          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            assert.isTrue(sheet.rendered, 'the sheet should render without throwing on the object-shaped list');
          } finally {
            await sheet.close();
          }
        });

        it('pads a fresh actor to 5 empty Key slots (no leftover "example" placeholder)', async function () {
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Keys Padding PC', type: 'character' }));
          const keys = actor.getComputedKeys();
          assert.lengthOf(keys, 5);
          assert.isTrue(keys.every((slot) => slot.key === ''), 'every slot should start empty and addable');
        });

        it('Add Key succeeds on a fresh actor and fills an empty slot', async function () {
          this.timeout(10000);
          requireSystemActive();

          // The Keys/Deadlocks block (and its Add Key button) only renders when Blades68Mode
          // is on; toggle it for the duration of this test rather than assuming the world
          // already has it set, and restore whatever the world had configured.
          const priorMode = game.settings.get('blades68', 'Blades68Mode');
          await game.settings.set('blades68', 'Blades68Mode', true);

          const actor = tracker.track(await Actor.create({ name: 'Quench Add Key PC', type: 'character' }));
          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            sheet.element.find('.add-key-popup').click();
            // Wait for the Add Key DialogV2 to render.
            let dialogEl;
            for (let attempt = 0; attempt < 20 && !dialogEl; attempt++) {
              await new Promise((resolve) => setTimeout(resolve, 150));
              dialogEl = document.querySelector('dialog[open]');
            }
            assert.isOk(dialogEl, 'the Add Key dialog should open');

            const checkbox = dialogEl.querySelector('input[name="select_keys"]');
            assert.isOk(checkbox, 'at least one Key checkbox should be offered');
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));

            const okButton = dialogEl.querySelector('button[data-action="ok"]');
            assert.isOk(okButton, 'the dialog should have an Add button');
            okButton.click();

            // Let the dialog's callback resolve and the actor update settle.
            await new Promise((resolve) => setTimeout(resolve, 300));

            const keysList = actor.system.keys.list;
            assert.isTrue(
              keysList.some((slot) => slot.key === checkbox.value),
              'the chosen Key should be saved into a slot (this is the "no empty Key slots" bug: it used to warn and fail here)'
            );
            assert.isTrue(
              keysList.some((slot) => slot.key === ''),
              'other slots should remain empty and still addable'
            );
          } finally {
            await sheet.close();
            await game.settings.set('blades68', 'Blades68Mode', priorMode);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        });

        it('falls back to a plain option for a custom Key name that has no catalog entry', async function () {
          this.timeout(10000);
          requireSystemActive();

          // The Keys/Deadlocks block only renders when Blades68Mode is on; toggle it for
          // the duration of this test and restore whatever the world had configured.
          const priorMode = game.settings.get('blades68', 'Blades68Mode');
          await game.settings.set('blades68', 'Blades68Mode', true);

          const actor = tracker.track(await Actor.create({ name: 'Quench Keys PC', type: 'character' }));
          const keysList = foundry.utils.deepClone(actor.system.keys.list);
          keysList[0].key = 'A Totally Custom Key';
          await actor.update({ 'system.keys.list': keysList });

          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            const selected = sheet.element.find('.keys-container select').first();
            assert.isAbove(selected.length, 0, 'the Keys block should render while Blades68Mode is on');
            assert.equal(selected.val(), 'A Totally Custom Key');
          } finally {
            await sheet.close();
            // Restore before the next test reads this setting, and give the world a moment
            // to settle the change (it round-trips through the same socket as everything else).
            await game.settings.set('blades68', 'Blades68Mode', priorMode);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        });

        it('deadlock popup saves a catalog choice and replaces the Key select', async function () {
          this.timeout(10000);
          requireSystemActive();

          const priorMode = game.settings.get('blades68', 'Blades68Mode');
          await game.settings.set('blades68', 'Blades68Mode', true);

          const actor = tracker.track(await Actor.create({ name: 'Quench Deadlock Catalog PC', type: 'character' }));
          const keysList = foundry.utils.deepClone(actor.getComputedKeys());
          keysList[0].key = 'Commanding';
          keysList[0].experience = 2;
          await actor.update({ 'system.keys.list': keysList });

          const sheet = actor.sheet;
          await sheet._render(true);
          try {
            const popupPromise = BladesHelpers.deadlockKeyPopup(actor, 0);
            let dialogEl;
            for (let attempt = 0; attempt < 20 && !dialogEl; attempt++) {
              await new Promise((resolve) => setTimeout(resolve, 150));
              dialogEl = document.querySelector('dialog[open]');
            }
            assert.isOk(dialogEl, 'the Choose Deadlock dialog should open');

            const radio = dialogEl.querySelector('input[name="select_deadlock"][value="controlling"]');
            assert.isOk(radio, 'Commanding should offer controlling');
            radio.checked = true;
            radio.dispatchEvent(new Event('change', { bubbles: true }));

            dialogEl.querySelector('button[data-action="ok"]').click();
            assert.isTrue(await popupPromise);

            const slot = actor.getComputedKeys()[0];
            assert.equal(slot.deadlocked, true);
            assert.equal(slot.deadlocked_to, 'controlling');
            assert.equal(slot.experience, 2, 'XP should persist through deadlock');
            assert.equal(slot.key, 'Commanding', 'original Key should remain stored');

            await sheet.render(true);
            const deadlockSelect = sheet.element.find('.deadlocked-to-select').first();
            assert.equal(deadlockSelect.val(), 'controlling');
            const xpInputs = sheet.element.find('.key-slot').first().find('.key-marks input[type="radio"]');
            assert.equal(xpInputs.filter(':disabled').length, 4, 'XP radios should be disabled while deadlocked');
            assert.isTrue(sheet.element.find('.key-slot').first().find('input[value="2"]').is(':checked'));
          } finally {
            await sheet.close();
            await game.settings.set('blades68', 'Blades68Mode', priorMode);
            await new Promise((resolve) => setTimeout(resolve, 200));
          }
        });

        it('deadlock popup accepts a custom deadlock and cancel leaves the slot unlocked', async function () {
          this.timeout(10000);
          requireSystemActive();

          const actor = tracker.track(await Actor.create({ name: 'Quench Deadlock Custom PC', type: 'character' }));
          const keysList = foundry.utils.deepClone(actor.getComputedKeys());
          keysList[0].key = 'Commanding';
          await actor.update({ 'system.keys.list': keysList });

          const cancelPromise = BladesHelpers.deadlockKeyPopup(actor, 0);
          let dialogEl;
          for (let attempt = 0; attempt < 20 && !dialogEl; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            dialogEl = document.querySelector('dialog[open]');
          }
          assert.isOk(dialogEl, 'cancel dialog should open');
          dialogEl.querySelector('button[data-action="cancel"]').click();
          assert.isNotOk(await cancelPromise);
          assert.equal(actor.getComputedKeys()[0].deadlocked, false, 'cancel must leave slot unlocked');
          assert.equal(actor.getComputedKeys()[0].deadlocked_to, '');

          const customPromise = BladesHelpers.deadlockKeyPopup(actor, 0);
          dialogEl = null;
          for (let attempt = 0; attempt < 20 && !dialogEl; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            dialogEl = document.querySelector('dialog[open]');
          }
          assert.isOk(dialogEl, 'custom dialog should open');
          const customInput = dialogEl.querySelector('input[name="custom_deadlock"]');
          customInput.value = 'overbearing';
          customInput.dispatchEvent(new Event('input', { bubbles: true }));
          dialogEl.querySelector('button[data-action="ok"]').click();
          assert.isTrue(await customPromise);

          const locked = actor.getComputedKeys()[0];
          assert.equal(locked.deadlocked, true);
          assert.equal(locked.deadlocked_to, 'overbearing');

          assert.isTrue(await BladesHelpers.clearKeyDeadlock(actor, 0));
          const cleared = actor.getComputedKeys()[0];
          assert.equal(cleared.deadlocked, false);
          assert.equal(cleared.deadlocked_to, '', 'unlock should clear deadlocked_to');
          assert.equal(cleared.key, 'Commanding', 'unlock should keep the original Key');
        });

        it('normalizes legacy marks into experience on object-shaped lists', async function () {
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Keys Marks Migrate PC', type: 'character' }));
          await actor.update({
            'system.keys.list': { 0: { key: 'Defiant', marks: 1, boomed: false } }
          });
          const keys = actor.getComputedKeys();
          assert.equal(keys[0].experience, 1);
          assert.equal(keys[0].deadlocked, false);
          assert.equal(keys[0].deadlocked_to, '');
        });

        it('updating one Key slot field does not blank sibling Key slots', async function () {
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Keys Sibling PC', type: 'character' }));
          const keysList = actor.getComputedKeys();
          keysList[0].key = 'Arrogant';
          keysList[0].experience = 1;
          keysList[1].key = 'Blunt';
          keysList[1].experience = 2;
          keysList[2].key = 'Flamboyant';
          await actor.update({ 'system.keys.list': keysList });

          // Simulate the sheet's per-slot writer (what form submit used to stomp).
          const next = actor.getComputedKeys();
          next[1].experience = 3;
          await actor.update({ 'system.keys.list': next });

          const after = actor.getComputedKeys();
          assert.equal(after[0].key, 'Arrogant', 'sibling slot 0 key must survive');
          assert.equal(after[0].experience, 1, 'sibling slot 0 XP must survive');
          assert.equal(after[1].key, 'Blunt', 'edited slot key must survive');
          assert.equal(after[1].experience, 3);
          assert.equal(after[2].key, 'Flamboyant', 'sibling slot 2 key must survive');
        });
      });
    },
    { displayName: 'Actor sheet catalogs (Keys, Special Abilities, Loadout)' }
  );
}

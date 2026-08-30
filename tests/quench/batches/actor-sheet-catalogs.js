/* global Actor, Item, foundry, game */
import { createdDocsTracker, requireSystemActive } from '../helpers.js';

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

            const checkbox = sheet.element.find('.special-abilities-panel .catalog-toggle').get(0);
            assert.isOk(checkbox, 'the ability checkbox should be rendered');
            assert.isFalse(checkbox.checked);

            const ownsAbility = () => actor.items.some((i) => i.type === 'ability' && i.name === abilitySource.name);

            checkbox.checked = true;
            await fireChange(checkbox, ownsAbility);
            assert.isTrue(
              actor.items.some((i) => i.type === 'ability' && i.name === abilitySource.name),
              'checking the box should create the owned ability item'
            );

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
      });

      describe('Keys & Deadlocks', function () {
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
      });
    },
    { displayName: 'Actor sheet catalogs (Keys, Special Abilities, Loadout)' }
  );
}

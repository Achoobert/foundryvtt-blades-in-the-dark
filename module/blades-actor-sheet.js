import {BladesSheet} from "./blades-sheet.js";
import {BladesActiveEffect} from "./blades-active-effect.js";
import {BladesHelpers} from "./blades-helpers.js";
import { enrichHTML } from "./compat.js";
import { simpleRollPopup } from "./blades-roll.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesActorSheet extends BladesSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["blades68", "sheet", "actor", "pc"],
            template: "systems/blades68/templates/actor-sheet.html",
            width: 790,
            height: 890,
            tabs: [{navSelector: ".tabs", contentSelector: ".tab-content", initial: "character-notes"}]
        });
    }

    /* -------------------------------------------- */

    /** @override */
    async getData(options) {
        const superData = super.getData(options);
        const sheetData = superData.data;
        sheetData.owner = superData.owner;
        sheetData.editable = superData.editable;
        sheetData.isGM = game.user.isGM;

        // Prepare active effects
        sheetData.effects = BladesActiveEffect.prepareActiveEffectCategories(this.actor.effects);

        // Calculate Load
        let loadout = 0;
        sheetData.items.forEach(i => {
            if (i.type !== "item") return;
            if (i.system.equipped) loadout += parseInt(i.system.load) || 0;
            if (i.system.bonus_equipped) loadout += parseInt(i.system.load) || 0;
        });

        //Sanity Check
        if (loadout < 0) {
            loadout = 0;
        }
        if (loadout > 11) {
            loadout = 11;
        }

        sheetData.system.loadout = loadout;

        // Encumbrance Levels
        let load_level;
        let mule_level;
        if (game.settings.get('blades68', 'DeepCutLoad')) {
            load_level = ["BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Conspicuous", "BITD.Conspicuous", "BITD.Encumbered",
                "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax", "BITD.OverMax"];
            mule_level = ["BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Discreet", "BITD.Conspicuous",
                "BITD.Conspicuous", "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax"];
        } else {
            load_level = ["BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Normal", "BITD.Normal", "BITD.Heavy", "BITD.Encumbered",
                "BITD.Encumbered", "BITD.Encumbered", "BITD.OverMax", "BITD.OverMax"];
            mule_level = ["BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Light", "BITD.Normal", "BITD.Normal",
                "BITD.Heavy", "BITD.Encumbered", "BITD.OverMax", "BITD.OverMax"];
        }
        let mule_present = 0;


        //look for Mule ability
        // @todo - fix translation.
        sheetData.items.forEach(i => {
            if (i.type === "ability" && i.name === "(C) Mule") {
                mule_present = 1;
            }
        });

        //set encumbrance level
        if (mule_present) {
            sheetData.system.load_level = mule_level[loadout];
        } else {
            sheetData.system.load_level = load_level[loadout];
        }

        if (game.settings.get('blades68', 'DeepCutLoad')) {
            sheetData.system.load_levels = {"BITD.Discreet": "BITD.Discreet", "BITD.Conspicuous": "BITD.Conspicuous"};
        } else {
            sheetData.system.load_levels = {
                "BITD.Light": "BITD.Light",
                "BITD.Normal": "BITD.Normal",
                "BITD.Heavy": "BITD.Heavy"
            };
        }

        sheetData.system.description = await enrichHTML(sheetData.system.description, {
            secrets: sheetData.owner,
            async: true
        });

        // catch unmigrated actor data and apply the Mastery crew ability to attribute maxes
        sheetData.system.attributes = this.actor.getComputedAttributes();

        //check for additional stress and trauma from crew sources
        sheetData.system.stress.max = this.actor.getMaxStress();
        sheetData.system.trauma.max = this.actor.getMaxTrauma();

        //check for healing minimums
        sheetData.system.healing_clock.value = this.actor.getHealingMin();

        sheetData.blades68 = game.settings.get('blades68', 'Blades68Mode');
        sheetData.blades68Keys = game.system.blades68Keys;
        sheetData.system.keys.list = this.actor.getComputedKeys().map((slot) => ({
            ...slot,
            deadlockOptions: BladesHelpers.getDeadlockedKeysFor(slot.key),
        }));

        // Special Abilities & Loadout: the full catalog of the equipped class's abilities/items
        // (checkbox lists), plus anything the actor owns that falls outside that catalog
        // (Veteran picks, homebrew additions, or no class equipped yet).
        const selectedClass = this.actor.items.find(i => i.type === "class") ?? null;
        sheetData.selectedClass = selectedClass;

        const PLAYBOOK_UNIQUE = {
            "Hound": "hound",
            "Hull": "hull",
            "Intellectual": "intellectual",
            "Operative": "operative",
            "Paranormalist": "paranormalist",
            "Radical": "radical",
            "Swinger": "swinger",
            "Veteran": "veteran",
            "Vampire": "vampire",
            "Time Traveler Future": "time_traveler",
            "Time Traveler Past": "time_traveler",
        };
        sheetData.playbookUnique = selectedClass ? (PLAYBOOK_UNIQUE[selectedClass.name] ?? null) : null;

        // Special Abilities: only what the actor actually owns, regardless of class -
        // the full class ability catalog is no longer shown as an inline checklist (use
        // the "Add Ability" compendium picker instead). Abilities with uses > 0 get
        // per-use tracking checkboxes inline on the name line (uses_text is optional label).
        const ownedAbilities = this.actor.items.filter(i => i.type === "ability");
        sheetData.otherAbilities = ownedAbilities.map(i => {
            const usesMax = Math.max(0, parseInt(i.system?.uses) || 0);
            const usesUsed = Math.max(0, parseInt(i.system?.uses_used) || 0);
            const usesText = (i.system?.uses_text || "").trim();
            return {
                _id: i.id,
                name: i.name,
                system: i.system,
                description: BladesHelpers.stripHtml(i.system?.description || ""),
                usesMax,
                usesUsed,
                usesText,
                usesIndexes: Array.from({ length: usesMax }, (_, idx) => idx + 1)
            };
        });
        sheetData.abilityShortList = ownedAbilities
            .map(i => BladesHelpers.trimClassFromName(i.name))
            .join(" - ");

        const itemResult = await this._buildCatalog("item", selectedClass, { slotsField: "num_available" });
        sheetData.itemCatalog = itemResult.catalog;
        // Other Items: the first checkbox marks the item as equipped/carried (and is what
        // counts against Load); if the item has more than one use (e.g. a gun with 3 shots),
        // up to 2 additional checkboxes track uses spent, independent of Load. An item with
        // num_available > 1 (e.g. carrying a second copy) also gets a bonus checkbox that
        // counts its Load a second time, independent of the main equip/use boxes.
        sheetData.otherItems = itemResult.other.map(i => {
            const usesMax = Math.min(3, Math.max(1, parseInt(i.system?.uses) || 1));
            const numAvailable = Math.max(1, parseInt(i.system?.num_available) || 1);
            return {
                _id: i.id,
                name: i.name,
                system: i.system,
                description: BladesHelpers.stripHtml(i.system?.description || ""),
                extraUseIndexes: Array.from({ length: usesMax - 1 }, (_, idx) => idx + 1),
                usesSpent: Math.max(0, parseInt(i.system?.uses_used) || 0),
                hasBonus: numAvailable > 1,
                bonusLabel: `x${numAvailable}`
            };
        });

        return sheetData;
    }

    /* -------------------------------------------- */

    /**
     * Builds a checklist catalog for the actor's equipped class: every item of the given type
     * tagged with that class's name, merged with the actor's owned items of that type to
     * determine how many of each are already carried. Owned items that don't belong to the
     * catalog (e.g. a Veteran pick from another class, or homebrew additions) are returned
     * separately so nothing owned is ever hidden.
     *
     * @param {string} itemType - "ability" or "item"
     * @param {Item|null} selectedClass
     * @param {{slotsField?: string}} [options] - system field naming how many owned copies the
     *   catalog entry supports (e.g. "num_available"); omit for a single-checkbox entry.
     * @returns {Promise<{catalog: Array, other: Array}>}
     */
    async _buildCatalog(itemType, selectedClass, { slotsField } = {}) {
        const owned = this.actor.items.filter(i => i.type === itemType);

        if (!selectedClass) {
            return { catalog: [], other: owned };
        }

        const allSource = await BladesHelpers.getAllItemsByType(itemType);
        const className = selectedClass.name;

        const seen = new Set();
        const catalog = [];
        for (const source of allSource) {
            if ((source.system?.class || "") !== className) continue;
            const displayName = BladesHelpers.trimClassFromName(source.name);
            if (seen.has(displayName)) continue;
            seen.add(displayName);

            const slots = slotsField ? Math.max(1, parseInt(source.system?.[slotsField]) || 1) : 1;
            const ownedMatches = owned.filter(i => BladesHelpers.trimClassFromName(i.name) === displayName);
            catalog.push({
                id: source.id,
                name: displayName,
                description: BladesHelpers.stripHtml(source.system?.description || ""),
                slots,
                slotIndexes: Array.from({ length: slots }, (_, i) => i + 1),
                ownedCount: ownedMatches.length
            });
        }
        catalog.sort((a, b) => a.name.localeCompare(b.name));

        const catalogNames = new Set(catalog.map(c => c.name));
        const other = owned.filter(i => !catalogNames.has(BladesHelpers.trimClassFromName(i.name)));

        return { catalog, other };
    }

    /** @override **/
    async _onDropItem(event, droppedItem) {
        await super._onDropItem(event, droppedItem);
        if (!this.actor.isOwner) {
            ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, {permanent: true});
            return false;
        }
        await this.handleDrop(event, droppedItem);
    }

    /** @override **/
    async _onDropActor(event, droppedActor) {
        await super._onDropActor(event, droppedActor);
        if (!this.actor.isOwner) {
            ui.notifications.error(`You do not have sufficient permissions to edit this character. Please speak to your GM if you feel you have reached this message in error.`, {permanent: true});
            return false;
        }
        await this.handleDrop(event, droppedActor);
    }

    /** @override **/
    async handleDrop(event, droppedEntity) {
        let droppedEntityFull = await fromUuid(droppedEntity.uuid);
        switch (droppedEntityFull.type) {
            case "npc":
                await BladesHelpers.addAcquaintance(this.actor, droppedEntityFull);
                break;
            case "crew":
                await BladesHelpers.addCrew(this.actor, droppedEntityFull);
                break;
            case "item":
                break;
            case "ability":
                break;
            case "class":
                break;
            default:
                break;
        }
    }

    /* -------------------------------------------- */

    /** @override */
    activateListeners(html) {
        super.activateListeners(html);

        // Everything below here is only needed if the sheet is editable
        if (!this.options.editable) return;

        // Remove Crew from character sheet
        html.find('.crew-delete').click(ev => {
            const element = $(ev.currentTarget).parents(".item");
            let crewId = element.data("itemId");
            BladesHelpers.removeCrew(this.actor, crewId);
        });

        // Add custom contact
        html.find('.add-custom-contact').click(() => {
            BladesHelpers.addCustomContact(this.actor);
        });

        // Quick-access roll popup (Fortune / Gather Info / Engagement / Indulge Vice / Acquire Asset)
        html.find('.roll-quick-popup').click(async () => {
            await simpleRollPopup();
        });

        // Add a Key
        html.find('.add-key-popup').click(() => {
            BladesHelpers.addKeyPopup(this.actor);
        });

        // Key / deadlock / XP edits update one slot via full-list write so Foundry form
        // submit cannot replace system.keys.list and blank sibling slots.
        html.find('.key-select').on('change', async (ev) => {
            await this._updateKeySlotField(ev, 'key', ev.currentTarget.value);
        });
        html.find('.deadlocked-to-select').on('change', async (ev) => {
            await this._updateKeySlotField(ev, 'deadlocked_to', ev.currentTarget.value);
        });
        // todo
        html.find('.key-marks input[type="radio"]').on('change', async (ev) => {
            if (!ev.currentTarget.checked) return;
            await this._updateKeySlotField(ev, 'experience', Number(ev.currentTarget.value));
        });

        // Deadlock toggle: check opens a choice popup; uncheck clears deadlocked_to.
        // Managed via actor.update (checkbox has no form name) so cancel leaves the row unlocked.
        html.find('.key-boom input').on('click', async (ev) => {
            ev.preventDefault();
            const slotIndex = Number(ev.currentTarget.closest('.key-slot')?.dataset?.slotIndex);
            if (!Number.isInteger(slotIndex) || slotIndex < 0) return;

            const slot = this.actor.getComputedKeys()[slotIndex];
            if (slot?.deadlocked) {
                await BladesHelpers.clearKeyDeadlock(this.actor, slotIndex);
            } else {
                await BladesHelpers.deadlockKeyPopup(this.actor, slotIndex);
            }
        });

        // Special Abilities / Loadout catalogs: each row's checked box count is reconciled
        // against how many matching items the actor actually owns (creating/deleting the
        // difference), which is what lets multi-slot Loadout entries (e.g. 2 Bandoliers) work
        // with plain checkboxes instead of a single owned/not-owned toggle.
        html.find('.catalog-toggle').change(async (ev) => {
            const row = ev.currentTarget.closest('.catalog-item');
            if (!row) return;
            const itemType = row.dataset.itemType;
            const itemName = row.dataset.itemName;
            const sourceId = row.dataset.sourceId;
            const checkedCount = row.querySelectorAll('.catalog-toggle:checked').length;

            const owned = this.actor.items.filter(i => i.type === itemType && BladesHelpers.trimClassFromName(i.name) === itemName);
            const diff = checkedCount - owned.length;

            if (diff > 0) {
                const source = await BladesHelpers.getItemByType(itemType, sourceId);
                if (!source) return;
                const data = source.toObject();
                delete data._id;
                const toCreate = Array.from({ length: diff }, () => foundry.utils.deepClone(data));
                await this.actor.createEmbeddedDocuments("Item", toCreate);
            } else if (diff < 0) {
                const toDelete = owned.slice(0, -diff).map(i => i.id);
                await this.actor.deleteEmbeddedDocuments("Item", toDelete);
            }
        });

        // Owned items outside the class catalog (Veteran picks, homebrew additions): a plain
        // checkbox marking whether the item is carried/in-use, persisted on system.equipped.
        html.find('.item-equipped-toggle').change(async (ev) => {
            const itemId = ev.currentTarget.dataset.itemId;
            const item = this.actor.items.get(itemId);
            if (!item) return;
            await item.update({ "system.equipped": ev.currentTarget.checked });
        });

        // Item use tracking (e.g. shots left in a gun): independent checkboxes reconciled by
        // count, same pattern as ability-uses-toggle. Spending a use never affects Load - only
        // the equip checkbox above does that.
        html.find('.item-use-toggle').change(async (ev) => {
            const row = ev.currentTarget.closest('.item-uses');
            if (!row) return;
            const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
            if (!item) return;
            const checkedCount = row.querySelectorAll('.item-use-toggle:checked').length;
            await item.update({ "system.uses_used": checkedCount });
        });

        // Bonus checkbox for a second carried copy (num_available > 1): an independent toggle
        // that counts the item's Load a second time when checked.
        html.find('.item-bonus-toggle').change(async (ev) => {
            const itemId = ev.currentTarget.dataset.itemId;
            const item = this.actor.items.get(itemId);
            if (!item) return;
            await item.update({ "system.bonus_equipped": ev.currentTarget.checked });
        });

        // Remove an owned item that falls outside the class catalog.
        html.find('.other-item-delete').click(async (ev) => {
            const row = ev.currentTarget.closest('.other-item');
            if (!row) return;
            await this.actor.deleteEmbeddedDocuments("Item", [row.dataset.itemId]);
        });

        // Ability use tracking: independent checkboxes per system.uses slot, reconciled by
        // count (like the Loadout slot checkboxes) rather than by which box was clicked.
        html.find('.ability-uses-toggle').change(async (ev) => {
            const row = ev.currentTarget.closest('.ability-uses');
            if (!row) return;
            const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
            if (!item) return;
            const checkedCount = row.querySelectorAll('.ability-uses-toggle:checked').length;
            await item.update({ "system.uses_used": checkedCount });
        });

    }

    /**
     * Patch one field on one Key slot and write the full normalized list.
     * @param {Event} ev
     * @param {"key"|"experience"|"deadlocked_to"} field
     * @param {string|number} value
     */
    async _updateKeySlotField(ev, field, value) {
        const slotIndex = Number(ev.currentTarget.closest('.key-slot')?.dataset?.slotIndex);
        if (!Number.isInteger(slotIndex) || slotIndex < 0) return;

        const keysList = this.actor.getComputedKeys();
        if (!keysList[slotIndex]) return;
        keysList[slotIndex][field] = value;
        await this.actor.update({ "system.keys.list": keysList });
    }

    /**
     * Drop ephemeral Key XP radio names (and any stray system.keys.* paths) so a
     * normal sheet form submit cannot stomp Key slots.
     * @override
     */
    _getSubmitData(updateData = {}) {
        const data = super._getSubmitData(updateData);
        const flat = foundry.utils.flattenObject(data);
        for (const key of Object.keys(flat)) {
            if (key.startsWith("key-xp-") || key.startsWith("system.keys")) {
                delete flat[key];
            }
        }
        const cleaned = foundry.utils.expandObject(flat);
        if (cleaned.system?.keys !== undefined) {
            delete cleaned.system.keys;
        }
        return cleaned;
    }

}

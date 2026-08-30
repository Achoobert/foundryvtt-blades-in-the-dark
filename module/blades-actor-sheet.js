import {BladesSheet} from "./blades-sheet.js";
import {BladesActiveEffect} from "./blades-active-effect.js";
import {BladesHelpers} from "./blades-helpers.js";
import { enrichHTML } from "./compat.js";

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
            loadout += (i.type === "item") ? parseInt(i.system.load) : 0
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
        sheetData.system.keys.list = this.actor.getComputedKeys();

        // Special Abilities & Loadout: the full catalog of the equipped class's abilities/items
        // (checkbox lists), plus anything the actor owns that falls outside that catalog
        // (Veteran picks, homebrew additions, or no class equipped yet).
        const selectedClass = this.actor.items.find(i => i.type === "class") ?? null;
        sheetData.selectedClass = selectedClass;

        const abilityResult = await this._buildCatalog("ability", selectedClass);
        sheetData.abilityCatalog = abilityResult.catalog;
        sheetData.otherAbilities = abilityResult.other;
        sheetData.abilityShortList = abilityResult.catalog
            .filter(a => a.ownedCount > 0)
            .map(a => a.name)
            .concat(abilityResult.other.map(i => BladesHelpers.trimClassFromName(i.name)))
            .join(" - ");

        const itemResult = await this._buildCatalog("item", selectedClass, { slotsField: "num_available" });
        sheetData.itemCatalog = itemResult.catalog;
        sheetData.otherItems = itemResult.other;

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

        // Add a Key
        html.find('.add-key-popup').click(() => {
            BladesHelpers.addKeyPopup(this.actor);
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

    }

}

import { generateRandomId } from "./compat.js";
import { openFormDialog } from "./lib/dialog-compat.js";

export class BladesHelpers {

  /**
   * Identifies duplicate items by type and returns a array of item ids to remove
   *
   * @param {Object} item_data
   * @param {Document} actor
   * @returns {Array}
   *
   */
  static removeDuplicatedItemType(item_data, actor) {
    let dupe_list = [];
    let distinct_types = ["crew_type", "crew_reputation", "class", "vice", "background", "heritage", "prison"];
    let allowed_types = ["item"];
    let should_be_distinct = distinct_types.includes(item_data.type);
    // If the Item has the exact same name - remove it from list.
    // Remove Duplicate items from the array.
    actor.items.forEach(i => {
      let has_double = (item_data.type === i.type);
      if (((i.name === item_data.name) || (should_be_distinct && has_double)) && !(allowed_types.includes(item_data.type)) && (item_data._id !== i.id)) {
        dupe_list.push(i.id);
      }
    });

    return dupe_list;
  }

  /**
   * Get a nested dynamic attribute.
   * @param {Object} obj
   * @param {string} property
   */
  static getNestedProperty(obj, property) {
    return property.split('.').reduce((r, e) => {
      return r[e];
    }, obj);
  }


  /**
   * Add item functionality
   */
  static _addOwnedItem(event, actor) {

    event.preventDefault();
    const a = event.currentTarget;
    const item_type = a.dataset.itemType;

    let data = {
      name: generateRandomId(),
      type: item_type
    };
    return actor.createEmbeddedDocuments("Item", [data]);
  }

  /**
   * Get the list of all available ingame items by Type.
   *
   * @param {string} item_type
   * @param {Object} game
   */
  /** //Accidentally duplicated this code before; I don't know if it works any differently
   static async getAllItemsByType(item_type, game) {

   let list_of_items = [];
   let game_items = [];
   let compendium_items = [];

   game_items = game.items.filter(e => e.type === item_type).map(e => {return e.toObject()});

   let pack = game.packs.find(e => e.metadata.name === item_type);
   let compendium_content = await pack.getDocuments();
   compendium_items = compendium_content.map(e => {return e.toObject()});

   list_of_items = game_items.concat(compendium_items);
   list_of_items.sort(function(a, b) {
     let nameA = a.name.toUpperCase();
     let nameB = b.name.toUpperCase();
   return nameA.localeCompare(nameB);
   });
   return list_of_items;

   }
   **/
  /**
   * Maps a base item type to its Blades '68-specific compendium pack name, for types that have
   * a parallel Blades '68 catalog alongside the vanilla Blades in the Dark one (e.g. "ability" ->
   * "blades68_abilities"). Types without a Blades '68 counterpart return undefined.
   */
  static getBlades68PackName(item_type) {
    return { class: "blades68_classes", ability: "blades68_abilities", item: "blades68_items" }[item_type];
  }

  static async getAllItemsByType(item_type) {

    let list_of_items = [];
    let world_items = [];
    let compendium_items = [];

    if (item_type === "npc" || item_type === "crew") {
      world_items = game.actors.filter(e => e.type === item_type).map(e => {
        return e
      });
    } else {
      world_items = game.items.filter(e => e.type === item_type).map(e => {
        return e
      });
    }

    if (item_type != "crew") {
      // In Blades68Mode, pull from the Blades '68 compendium instead of the vanilla Blades in
      // the Dark one (some playbook names collide between the two rulesets, e.g. "Hound", so
      // this must replace rather than merge with the base pack).
      const blades68PackName = this.getBlades68PackName(item_type);
      const packName = (blades68PackName && game.settings.get("blades68", "Blades68Mode"))
        ? blades68PackName
        : item_type;
      let packs = game.packs.filter(e => e.metadata.name === packName);
      let compendium_contents = await Promise.all(packs.map(pack => pack.getDocuments()));
      for(const compendium_content of compendium_contents) {
        compendium_items = compendium_items.concat(compendium_content)
      }
      list_of_items = world_items.concat(compendium_items);
    } else {
      list_of_items = world_items;
    }

    list_of_items.sort(function (a, b) {
      let nameA = a.name.toUpperCase();
      let nameB = b.name.toUpperCase();
      return nameA.localeCompare(nameB);
    });
    return list_of_items;

  }

  /* -------------------------------------------- */

  /**
   * Returns the label for attribute.
   *
   * @param {string} attribute_name
   * @returns {string}
   */
  static getAttributeLabel(attribute_name) {
    let attribute_labels = {};
    const attributes = game.model.Actor.character.attributes;

    for (const att_name in attributes) {
      attribute_labels[att_name] = attributes[att_name].label;
      for (const skill_name in attributes[att_name].skills) {
        attribute_labels[skill_name] = attributes[att_name].skills[skill_name].label;
      }

    }

    return attribute_labels[attribute_name];
  }

  /**
   * Returns the label for roll type.
   *
   * @param {string} roll_name
   * @returns {string}
   */
  static getRollLabel(roll_name) {
    let attribute_labels = {};
    const attributes = game.model.Actor.character.attributes;

    for (const att_name in attributes) {
      if (att_name == roll_name) {
        return attributes[att_name].label;
      }
      for (const skill_name in attributes[att_name].skills) {
        if (skill_name == roll_name) {
          return attributes[att_name].skills[skill_name].label;
        }
      }
    }

    return roll_name;
  }

  /**
   * Returns true if the attribute is an action
   *
   * @param {string} attribute_name
   * @returns {Boolean}
   */
  static isAttributeAction(attribute_name) {
    const attributes = game.model.Actor.character.attributes;

    for (const att_name in attributes) {
      for (const skill_name in attributes[att_name].skills) {
        if (skill_name == attribute_name) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Returns true if the attribute is an attribute
   *
   * @param {string} attribute_name
   * @returns {Boolean}
   */
  static isAttributeAttribute(attribute_name) {
    const attributes = game.model.Actor.character.attributes;

    return (attribute_name in attributes);
  }

  /* -------------------------------------------- */
  static getProperCase(name) {
    return name.charAt(0).toUpperCase() + name.substr(1).toLowerCase();
  }

  /**
   * Creates options for faction clocks.
   *
   * @param {int[]} sizes
   *  array of possible clock sizes
   * @param {int} default_size
   *  default clock size
   * @param {int} current_size
   *  current clock size
   * @returns {string}
   *  html-formatted option string
   */
  static createListOfClockSizes(sizes, default_size, current_size) {

    let text = ``;

    sizes.forEach(size => {
      text += `<option value="${size}"`;
      if (!(current_size) && (size === default_size)) {
        text += ` selected`;
      } else if (size === current_size) {
        text += ` selected`;
      }

      text += `>${size}</option>`;
    });

    return text;

  }

  // adds an NPC to the character as an acquaintance of neutral standing
  static async addAcquaintance(actor, acq) {
    let current_acquaintances = actor.system.acquaintances;
    let acquaintance = {
      id: acq.id,
      name: acq.name,
      description_short: acq.system.description_short,
      standing: "neutral"
    };
    let unique_id = !current_acquaintances.some((oldAcq) => {
      return oldAcq.id == acq.id;
    });
    if (unique_id) {
      await actor.update({system: {acquaintances: current_acquaintances.concat([acquaintance])}});
    } else {
      ui.notifications.info(game.i18n.localize("BITD.log.info.SameNPC"));
    }
  }

  static async removeAcquaintance(actor, acqId) {
    let current_acquaintances = actor.system.acquaintances;
    let updated_acquaintances = current_acquaintances.filter(acq => acq._id !== acqId && acq.id !== acqId);
    await actor.update({system: {acquaintances: updated_acquaintances}});
  }

  static async importAcquaintance(actor, acqId) {
    //try to import from a compendium
    try {
      let new_actor = await game.actors.importFromCompendium(game.packs.get("blades68.npc"), acqId);
      //get the UUID of newly created actor
      let new_id = new_actor.id;
      console.log(new_id);
      //get array index of Acquaintance being updated
      let old_index = await actor.system.acquaintances.findIndex(e => e.id == acqId);
      // update Acquaintance on actor with new UUID
      let updated_acquaintances = actor.system.acquaintances;
      updated_acquaintances[old_index].id = new_id;
      await actor.update({system: {acquaintances: updated_acquaintances}});
      await new_actor.sheet.render(true);
    } catch (error) {
      ui.notifications.warn(game.i18n.localize(("BITD.log.warn.NoNPC")));
      console.error(error);
    }
  }

  static async addCustomContact(actor) {
    const dialogContent = `
    <form>
      <div class="form-group">
        <label>Name:</label>
        <input type="text" name="name" required />
      </div>
      <div class="form-group">
        <label>Description:</label>
        <input type="text" name="description_short" />
      </div>
      <div class="form-group">
        <label>Standing:</label>
        <select name="standing">
          <option value="neutral">Neutral</option>
          <option value="friend">Friend</option>
          <option value="rival">Rival</option>
        </select>
      </div>
    </form>
  `;

    const result = await openFormDialog({
      title: "Add Custom Contact",
      content: dialogContent,
      okLabel: "Add Contact",
      cancelLabel: "Cancel",
      defaultButton: "ok",
    });

    if (!result) {
      return false;
    }

    const name = String(result.name ?? "").trim();
    if (!name) {
      ui.notifications?.warn?.("Name is required for a custom contact.");
      return false;
    }

    const newContact = {
      id: generateRandomId(),
      name,
      description_short: String(result.description_short ?? ""),
      standing: result.standing ?? "neutral",
    };

    const acquaintances = actor.system.acquaintances || [];
    acquaintances.push(newContact);
    await actor.update({ "system.acquaintances": acquaintances });
    return true;
  }

  static async addKeyPopup(actor) {
    const keyOptions = game.system.blades68Keys || [];
    const options_html = keyOptions.map(opt => `
      <div class="item-block">
        <input id="select-key-${opt.id}" type="checkbox" name="select_keys" value="${opt.id}">
        <label for="select-key-${opt.id}" title="${game.i18n.localize(opt.drift)}">${game.i18n.localize(opt.label)}</label>
      </div>`).join("");

    const dialogContent = `
      <form class="items-to-add">
        <div class="form-group">
          <label>${game.i18n.localize('BITD.CustomKey')}:</label>
          <input type="text" name="custom_key">
        </div>
        <div class="items-list add-items-list">
          <div class="item-group">
            ${options_html}
          </div>
        </div>
      </form>
    `;

    const result = await openFormDialog({
      title: game.i18n.localize('BITD.AddKey'),
      content: dialogContent,
      okLabel: game.i18n.localize('Add'),
      cancelLabel: game.i18n.localize('Cancel'),
      defaultButton: "ok",
    });

    if (!result) {
      return false;
    }

    let chosen = [];
    if (result.select_keys) {
      chosen = Array.isArray(result.select_keys) ? result.select_keys : [result.select_keys];
    }
    const customKey = String(result.custom_key ?? "").trim();
    if (customKey) {
      chosen.push(customKey);
    }

    if (!chosen.length) {
      return false;
    }

    // Use the self-healing, max-padded list (actor.system.keys.list alone may be short a
    // slot, or still carry the legacy "example" placeholder, on actors created before this fix).
    const keysList = actor.getComputedKeys();
    const emptySlotIndexes = keysList
      .map((slot, idx) => (slot.key ? null : idx))
      .filter(idx => idx !== null);

    if (!emptySlotIndexes.length) {
      ui.notifications?.warn?.("No empty Key slots are available.");
      return false;
    }

    if (chosen.length > emptySlotIndexes.length) {
      ui.notifications?.warn?.(`Only ${emptySlotIndexes.length} Key slot(s) available; extra selections were ignored.`);
      chosen = chosen.slice(0, emptySlotIndexes.length);
    }

    chosen.forEach((key, i) => {
      keysList[emptySlotIndexes[i]].key = key;
    });

    await actor.update({ "system.keys.list": keysList });
    return true;
  }

  /**
   * Allowed deadlock outcomes for a Key id (catalog entry), or [] for custom/unknown Keys.
   * @param {string} keyId
   * @returns {string[]}
   */
  static getDeadlockedKeysFor(keyId) {
    const opt = (game.system.blades68Keys || []).find((k) => k.id === keyId);
    return opt?.deadlockedKeys ? [...opt.deadlockedKeys] : [];
  }

  /**
   * Open a single-choice popup to pick which deadlock a Key resolves into.
   * On confirm: sets deadlocked + deadlocked_to. On cancel: leaves the slot unlocked.
   * @param {Actor} actor
   * @param {number} slotIndex
   * @returns {Promise<boolean>}
   */
  static async deadlockKeyPopup(actor, slotIndex) {
    const keysList = actor.getComputedKeys();
    const slot = keysList[slotIndex];
    if (!slot?.key) {
      ui.notifications?.warn?.("Choose a Key before deadlocking it.");
      return false;
    }

    const deadlockOptions = this.getDeadlockedKeysFor(slot.key);
    const escapeHtml = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    const options_html = deadlockOptions.map((opt, i) => `
      <div class="item-block">
        <input id="select-deadlock-${i}" type="radio" name="select_deadlock" value="${escapeHtml(opt)}">
        <label for="select-deadlock-${i}">${escapeHtml(opt)}</label>
      </div>`).join("");

    const dialogContent = `
      <form class="items-to-add">
        <div class="form-group">
          <label>${game.i18n.localize('BITD.CustomDeadlock')}:</label>
          <input type="text" name="custom_deadlock">
        </div>
        <div class="items-list add-items-list">
          <div class="item-group">
            ${options_html || `<p class="notes">${game.i18n.localize('BITD.NoCatalogDeadlocks')}</p>`}
          </div>
        </div>
      </form>
    `;

    const result = await openFormDialog({
      title: game.i18n.localize('BITD.ChooseDeadlock'),
      content: dialogContent,
      okLabel: game.i18n.localize('Add'),
      cancelLabel: game.i18n.localize('Cancel'),
      defaultButton: "ok",
    });

    if (!result) {
      return false;
    }

    const custom = String(result.custom_deadlock ?? "").trim();
    const chosen = custom || String(result.select_deadlock ?? "").trim();
    if (!chosen) {
      return false;
    }

    keysList[slotIndex].deadlocked = true;
    keysList[slotIndex].deadlocked_to = chosen;
    await actor.update({ "system.keys.list": keysList });
    return true;
  }

  /**
   * Clear a slot's deadlock flag and deadlocked_to value.
   * @param {Actor} actor
   * @param {number} slotIndex
   * @returns {Promise<boolean>}
   */
  static async clearKeyDeadlock(actor, slotIndex) {
    const keysList = actor.getComputedKeys();
    if (!keysList[slotIndex]) {
      return false;
    }
    keysList[slotIndex].deadlocked = false;
    keysList[slotIndex].deadlocked_to = "";
    await actor.update({ "system.keys.list": keysList });
    return true;
  }

  static async getSourcedItemsByType(item_type) {
    const limited_items = await this.getAllItemsByType(item_type);
    return limited_items;
  }

  static async getItemByType(item_type, item_id) {
    let game_items = await this.getAllItemsByType(item_type);
    let item = game_items.find(item => item.id === item_id);
    return item;
  }

  static async getPlaybookAcquaintances(actor_type, selected_playbook) {
    let all_acquaintances = await this.getSourcedItemsByType('npc');
    let playbook_acquaintances = [];
    if (actor_type == "character") {
      playbook_acquaintances = all_acquaintances.filter(i => i.system.associated_class === selected_playbook);
    } else if (actor_type == "crew") {
      playbook_acquaintances = all_acquaintances.filter(i => i.system.associated_crew_type === selected_playbook);
    }
    return playbook_acquaintances;

  }

  static async import_pb_contacts(actor, playbook) {
    const pb_type = await actor.type;
    const pb_actor = await this.getPlaybookAcquaintances(pb_type, playbook);
    const LM = pb_actor.length;
    let i = 0;
    while (i < LM) {
      const new_acq = pb_actor[i];
      await this.addAcquaintance(actor, new_acq);
      i++;
    }
  }

  // adds a crew to the character
  static async addCrew(actor, dropped_crew) {
    let current_crew = actor.system.crew;
    let new_crew = {
      id: dropped_crew.id,
      name: dropped_crew.name,
      description: dropped_crew.system.description,
      img: dropped_crew.img
    };

    let unique_id = !current_crew.some((oldAcq) => {
      return oldAcq.id == dropped_crew.id;
    });

    if (unique_id) {
      actor.update({system: {crew: [new_crew]}});

    } else {
      ui.notifications.info(game.i18n.localize("BITD.log.info.SameCrew"));
    }
  }

  // removes a crew from the character
  static async removeCrew(actor, crewId) {
    let current_crew = actor.system.crew;
    let updated_crew = current_crew.filter(acq => acq._id !== crewId && acq.id !== crewId);
    await actor.update({system: {crew: updated_crew}});
  }

  /**
   * Groups items by their system.class property.
   * Items without a class are grouped under "General".
   *
   * @param {Array} item_list - Array of item objects
   * @returns {Object} Object with class names as keys and arrays of items as values
   */
  static groupItemsByClass(item_list) {
    let grouped_items = {};
    let generics = [];

    for (const item of item_list) {
      let itemclass = foundry.utils.getProperty(item, "system.class");
      if (!itemclass || itemclass === "") {
        generics.push(item);
      } else {
        if (!(itemclass in grouped_items) || !Array.isArray(grouped_items[itemclass])) {
          grouped_items[itemclass] = [];
        }
        grouped_items[itemclass].push(item);
      }
    }

    // Sort keys alphabetically and put generics last
    let sorted = {};
    Object.keys(grouped_items).sort().forEach(key => {
      sorted[key] = grouped_items[key];
    });
    if (generics.length > 0) {
      sorted["General"] = generics;
    }

    return sorted;
  }

  /**
   * Removes the class prefix from an item name.
   * e.g., "(Cutter) Not to be Trifled With" -> "Not to be Trifled With"
   *
   * @param {string} name - The item name
   * @returns {string} The name without the class prefix
   */
  static trimClassFromName(name) {
    return name.replace(/^\([^)]*\)\s*/, "");
  }

  /**
   * Strips HTML tags from a string.
   *
   * @param {string} html - HTML string to strip
   * @returns {string} Plain text without HTML tags
   */
  static stripHtml(html) {
    if (!html) return "";
    let doc = new DOMParser().parseFromString(html, "text/html");
    return doc.body.textContent || "";
  }
}

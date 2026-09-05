import { bladesRoll } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { openFormDialog } from "./lib/dialog-compat.js";

/**
 * Extend the basic Actor
 * @extends {Actor}
 */
export class BladesActor extends Actor {
  /** @override */
  static async create(data, options = {}) {
    data.prototypeToken = data.prototypeToken || {};

    // For Crew and Character set the Token to sync with charsheet.
    switch (data.type) {
      case "character":
      case "crew":
      case "\uD83D\uDD5B clock":
      case "npc":
      case "factions":
        data.prototypeToken.actorLink = true;
        break;
    }

    return super.create(data, options);
  }

  /** @override */
  getRollData() {
    const rollData = super.getRollData();

    rollData.dice_amount = this.getAttributeDiceToThrow();

    return rollData;
  }

  /* -------------------------------------------- */
  /**
   * Calculate Attribute Dice to throw.
   */
  getAttributeDiceToThrow() {
    // Calculate Dice to throw.
    let dice_amount = {};
    dice_amount["BITD.Vice"] = 4;

    for (var attribute_name in this.system.attributes) {
      //dice_amount[attribute_name] = 0;
      dice_amount[attribute_name] =
        this.system.attributes[attribute_name].bonus;
      for (var skill_name in this.system.attributes[attribute_name].skills) {
        // dice_amount[skill_name] = parseInt(this.system.attributes[attribute_name].skills[skill_name]['value'][0])
        dice_amount[skill_name] = parseInt(
          this.system.attributes[attribute_name].skills[skill_name]["value"],
        );

        // We add a +1d for every skill higher than 0.
        if (dice_amount[skill_name] > 0) {
          dice_amount[attribute_name]++;
        }
      }
      // Vice dice roll uses lowest attribute dice amount
      dice_amount["BITD.Vice"] = Math.min(
        dice_amount["insight"],
        dice_amount["prowess"],
        dice_amount["resolve"],
      );
    }

    return dice_amount;
  }

  /* -------------------------------------------- */

  _getCrewActor() {
    const crewInfo = this.system?.crew?.[0];
    if (!crewInfo?.id) return null;
    const crewActor = game.actors.get(crewInfo.id);
    return crewActor ?? null;
  }

  /* -------------------------------------------- */

  async rollAttributePopup(attribute_name, defaultDice = 0) {
    // const roll = new Roll("1d20 + @abilities.wis.mod", actor.getRollData());
    let attribute_label = BladesHelpers.getRollLabel(attribute_name);

    const sanitizedDefaultDice = (() => {
      const numeric = Number(defaultDice);
      if (Number.isNaN(numeric)) return 0;
      return Math.max(0, Math.min(Math.floor(numeric), 10));
    })();

    // get crew tier/gambits info from character sheet if available
    let current_tier = 0;
    let current_gambits = 0;
    try {
      const crewActor = this._getCrewActor();
      const parsedTier = Number(crewActor?.system?.tier);
      current_tier = Number.isFinite(parsedTier) ? parsedTier : 0;
      const parsedGambits = Number(crewActor?.system?.gambits?.value);
      current_gambits = Number.isFinite(parsedGambits) ? parsedGambits : 0;
    } catch (error) {
      console.warn("No Crew is attached to the Actor.");
      console.error(error);
    }

    const actionRollEnabled = game.settings.get("blades68", "ActionRoll");

    let content = `
        <form class="bitd-roll-dialog">
          <div class="form-group">
            <label>${game.i18n.localize("BITD.Modifier")}:</label>
            <select id="mod" name="mod">
              ${this.createListOfDiceMods(-3, +3, 0)}
            </select>
          </div>`;
    if (BladesHelpers.isAttributeAction(attribute_name)) {
      content += `
        <fieldset class="form-group" style="display:grid; gap:0.5em;">
          <legend>Roll Types</legend>`;
      // Row 1: Action Roll (if enabled)
      if (actionRollEnabled) {
        content += `
          <div style="display:grid; grid-template-columns:auto; gap:0.5em 1em; align-items:center;">
            <label><input type="radio" id="actionRoll" name="rollSelection" value="actionRoll" checked=true> ${game.i18n.localize("BITD.ActionRoll")}</label>
            <input type="hidden" id="pos" name="pos" value="risky">
            <input type="hidden" id="fx" name="fx" value="standard">
          </div>`;
      }
      // Row 2: Threat Roll (if enabled)
      if (game.settings.get("blades68", "ThreatRoll")) {
        content += `
          <div style="display:grid; grid-template-columns:auto auto auto auto; gap:0.5em 1em; align-items:center;">
            <label><input type="radio" id="threatRoll" name="rollSelection" value="threatRoll"> ${game.i18n.localize("BITD.ThreatRoll")}</label>
            <span><label>${game.i18n.localize("BITD.Position")}:</label> <select id="pos2" name="pos2"><option value="risky" selected>${game.i18n.localize("BITD.PositionRisky")}</option><option value="desperate">${game.i18n.localize("BITD.PositionDesperate")}</option></select></span>
            <span><label>${game.i18n.localize("BITD.ExtraThreats")}:</label> <select id="extraThreats" name="extraThreats">${Array(
              6,
            )
              .fill()
              .map((item, i) => `<option value="${i}">${i}</option>`)
              .join("")}</select></span>
            <button type="button" class="bitd-inline-roll" data-roll-for="threatRoll">${game.i18n.localize("BITD.Roll")}</button>
          </div>`;
      }
      // Row 3: Other roll types (skill-click popup only offers Action Roll, Gather
      // Information, and Acquire Asset — Fortune/Indulge Vice/Engagement are triggered
      // from their own dedicated entry points, not from clicking a skill on the sheet)
      content += `
          <div style="display:grid; grid-template-columns:auto auto auto auto; column-gap:0.5em; row-gap:0.4em; align-items:center;">
            <label><input type="radio" id="gatherInfo" name="rollSelection" value="gatherInfo"> ${game.i18n.localize("BITD.GatherInformation")}</label>
            <span style="grid-column:2 / 4;"></span>
            <button type="button" class="bitd-inline-roll" data-roll-for="gatherInfo">${game.i18n.localize("BITD.Roll")}</button>
            <label><input type="radio" id="acquireAsset" name="rollSelection" value="acquireAsset"> ${game.i18n.localize("BITD.AcquireAsset")}</label>
            <label style="margin:0; justify-self:end; white-space:nowrap;">${game.i18n.localize("BITD.CrewTier")}:</label>
            <select id="tier" name="tier" style="width:auto; min-width:4.5em; justify-self:start;"><option value="${current_tier}" selected disabled hidden>${current_tier}</option>${Array(
              5,
            )
              .fill()
              .map((item, i) => `<option value="${i}">${i}</option>`)
              .join("")}</select>
            <button type="button" class="bitd-inline-roll" data-roll-for="acquireAsset">${game.i18n.localize("BITD.Roll")}</button>
          </div>
        </fieldset>
        <fieldset class="roll-options-toggles" style="margin-top:0.5em;">
          <legend>${game.i18n.localize("BITD.RollOptions")}</legend>
          <div style="display:grid; gap:0.3em;">
            <label><input type="checkbox" id="opt-assist" name="optAssist" value="1"> ${game.i18n.localize("BITD.RollOptionAssist")}</label>
            ${current_gambits > 0 ? `<label><input type="checkbox" id="opt-gambit" name="optGambit" value="1"> ${game.i18n.localize("BITD.RollOptionGambit")}</label>` : ""}
            <label><input type="checkbox" id="opt-push" name="optPush" value="1"> ${game.i18n.localize("BITD.RollOptionPush")}</label>
            <label><input type="checkbox" id="opt-devils-bargain" name="optDevilsBargain" value="1"> ${game.i18n.localize("BITD.RollOptionDevilsBargain")}</label>
            <label><input type="checkbox" id="opt-group-action" name="optGroupAction" value="1"> ${game.i18n.localize("BITD.RollOptionGroupAction")}</label>
            <label><input type="checkbox" id="opt-setup-action" name="optSetupAction" value="1"> ${game.i18n.localize("BITD.RollOptionSetupAction")}</label>
          </div>
        </fieldset>
        ${actionRollEnabled ? this._buildPositionEffectTable() : ""}
            `;
    } else {
      if (BladesHelpers.isAttributeAttribute(attribute_name)) {
        content += `
            <fieldset class="roll-options-reminder" style="margin-top:0.5em;">
              <legend>${game.i18n.localize("BITD.Resistance")}</legend>
              <p style="margin:0;">${game.i18n.localize("BITD.RollOptionResist")}</p>
            </fieldset>`;
      } else if (attribute_name === "BITD.Vice") {
        content += `
            <fieldset class="roll-options-reminder" style="margin-top:0.5em;">
              <legend>${game.i18n.localize("BITD.IndulgeVice")}</legend>
              <p style="margin:0;">${game.i18n.localize("BITD.RollOptionIndulgeVice")}</p>
            </fieldset>`;
      }
      content += `
            <input  id="pos" name="pos" type="hidden" value="">
			<input  id="pos2" name="pos2" type="hidden" value="">
            <input id="fx" name="fx" type="hidden" value="">`;
    }
    content += `
        <div className="form-group">
          <label>${game.i18n.localize("BITD.Notes")}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
       </form>
      `;
    const dialogResult = await openFormDialog({
      title: `${game.i18n.localize("BITD.Roll")} ${game.i18n.localize(attribute_label)}`,
      content,
      okLabel: game.i18n.localize("BITD.Roll"),
      cancelLabel: game.i18n.localize("Close"),
      defaultButton: "cancel",
      hideOkButton: actionRollEnabled && BladesHelpers.isAttributeAction(attribute_name),
      onRender: (form, submit) => this._wireRollDialog(form, submit),
    });

    if (!dialogResult) {
      return;
    }

    const optionNotes = [];
    let bonusDice = 0;
    if (dialogResult.optAssist) {
      bonusDice += 1;
      optionNotes.push(game.i18n.localize("BITD.RollOptionAssistShort"));
    }
    if (dialogResult.optGambit) {
      bonusDice += 1;
      optionNotes.push(game.i18n.localize("BITD.RollOptionGambitShort"));
    }
    if (dialogResult.optPush) {
      bonusDice += 1;
      optionNotes.push(game.i18n.localize("BITD.RollOptionPushShort"));
    }
    if (dialogResult.optDevilsBargain) {
      bonusDice += 1;
      optionNotes.push(game.i18n.localize("BITD.RollOptionDevilsBargainShort"));
    }
    if (dialogResult.optGroupAction) {
      optionNotes.push(game.i18n.localize("BITD.RollOptionGroupActionShort"));
    }
    if (dialogResult.optSetupAction) {
      optionNotes.push(game.i18n.localize("BITD.RollOptionSetupActionShort"));
    }

    const modifier = (Number(dialogResult.mod ?? 0) || 0) + bonusDice;
    let note = dialogResult.note ?? "";
    if (optionNotes.length) {
      note = note ? `${note} (${optionNotes.join(", ")})` : optionNotes.join(", ");
    }
    const rollData = this.getRollData();
    const actionDiceAmount = rollData.dice_amount[attribute_name] + modifier;
    const viceDiceAmount = rollData.dice_amount["BITD.Vice"] + modifier;
    const stress = Number(this.system.stress.value) || 0;

    if (dialogResult.optGambit) {
      await this._spendGambit();
    }
    if (dialogResult.optPush) {
      await this._applyPushYourselfStress();
    }

    if (!BladesHelpers.isAttributeAction(attribute_name)) {
      await this.rollAttribute(attribute_name, modifier, "", "", note);
      return;
    }

    const rollSelection = dialogResult.rollSelection ?? "actionRoll";
    const effect = dialogResult.fx ?? "standard";
    const position = dialogResult.pos ?? "risky";

    switch (rollSelection) {
      case "actionRoll":
        await this.rollAttribute(
          attribute_name,
          modifier,
          position,
          effect,
          note,
        );
        break;
      case "threatRoll": {
        const extraThreats = Number(dialogResult.extraThreats ?? 0) || 0;
        const position2 = dialogResult.pos2 ?? "risky";
        await bladesRoll(
          actionDiceAmount,
          attribute_name,
          position2,
          "BITD.ThreatRoll",
          note,
          extraThreats,
        );
        break;
      }
      case "fortune":
        await bladesRoll(actionDiceAmount, "BITD.Fortune", "", "", note, "");
        break;
      case "gatherInfo":
        await bladesRoll(
          actionDiceAmount,
          "BITD.GatherInformation",
          "",
          "",
          note,
          "",
        );
        break;
      case "indulgeVice":
        await bladesRoll(viceDiceAmount, "BITD.Vice", "", "", note, stress, undefined, this);
        break;
      case "engagement": {
        const engagementDice =
          Number(dialogResult.qty ?? sanitizedDefaultDice) || 0;
        await bladesRoll(engagementDice, "BITD.Engagement", "", "", note, "");
        break;
      }
      case "acquireAsset": {
        const tier = Number(dialogResult.tier ?? current_tier) || 0;
        const assetDice = tier + modifier;
        await bladesRoll(
          assetDice,
          "BITD.AcquireAsset",
          "",
          "",
          note,
          "",
          tier,
        );
        break;
      }
      default:
        await this.rollAttribute(
          attribute_name,
          modifier,
          position,
          effect,
          note,
        );
        break;
    }
  }

  /* -------------------------------------------- */

  /**
   * Builds the Position x Effect grid that replaces the old dropdowns for
   * Action Rolls. Clicking a cell both picks that position/effect and
   * immediately submits the dialog (see {@link _wireRollDialog}).
   */
  _buildPositionEffectTable() {
    const positions = [
      ["controlled", "BITD.PositionControlled"],
      ["risky", "BITD.PositionRisky"],
      ["desperate", "BITD.PositionDesperate"],
    ];
    const effects = [
      ["zero", "BITD.EffectZero"],
      ["limited", "BITD.EffectLimited"],
      ["standard", "BITD.EffectStandard"],
      ["great", "BITD.EffectGreat"],
      ["extreme", "BITD.EffectExtreme"],
    ];
    const rollLabel = game.i18n.localize("BITD.Roll");

    const headerCells = effects
      .map(([, key]) => `<th>${game.i18n.localize(key)}</th>`)
      .join("");

    const bodyRows = positions
      .map(([posValue, posKey]) => {
        const cells = effects
          .map(([fxValue, fxKey]) => {
            const isDefault = posValue === "risky" && fxValue === "standard";
            return `<td><button type="button" class="bitd-roll-cell${isDefault ? " is-default" : ""}" data-position="${posValue}" data-effect="${fxValue}" data-roll-label="${rollLabel}" title="${rollLabel} — ${game.i18n.localize(posKey)} / ${game.i18n.localize(fxKey)}"></button></td>`;
          })
          .join("");
        return `<tr><th>${game.i18n.localize(posKey)}</th>${cells}</tr>`;
      })
      .join("");

    return `
        <fieldset class="bitd-pos-fx-fieldset" style="margin-top:0.5em;">
          <legend>${game.i18n.localize("BITD.Position")} / ${game.i18n.localize("BITD.Effect")}</legend>
          <table class="bitd-pos-fx-table">
            <thead><tr><th></th>${headerCells}</tr></thead>
            <tbody>${bodyRows}</tbody>
          </table>
        </fieldset>`;
  }

  /* -------------------------------------------- */

  /**
   * Wires up the interactive bits of the roll dialog that a plain HTML
   * string can't attach handlers to: clicking a Position/Effect cell submits
   * the dialog directly (there is no separate Roll button), the per-row
   * inline Roll buttons submit for roll types the table doesn't cover, and
   * Push Yourself / Devil's Bargain gray each other out since they can't be
   * combined.
   */
  _wireRollDialog(form, submit) {
    const posInput = form.querySelector("#pos");
    const fxInput = form.querySelector("#fx");
    const actionRadio = form.querySelector("#actionRoll");

    form.querySelectorAll(".bitd-roll-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        if (posInput) posInput.value = cell.dataset.position;
        if (fxInput) fxInput.value = cell.dataset.effect;
        if (actionRadio) actionRadio.checked = true;
        submit();
      });
    });

    form.querySelectorAll("[data-roll-for]").forEach((button) => {
      button.addEventListener("click", () => {
        const radio = form.querySelector(`[name="rollSelection"][value="${button.dataset.rollFor}"]`);
        if (radio) radio.checked = true;
        submit();
      });
    });

    const pushCheckbox = form.querySelector("#opt-push");
    const devilsBargainCheckbox = form.querySelector("#opt-devils-bargain");
    if (pushCheckbox && devilsBargainCheckbox) {
      pushCheckbox.addEventListener("change", () => {
        devilsBargainCheckbox.disabled = pushCheckbox.checked;
        if (pushCheckbox.checked) devilsBargainCheckbox.checked = false;
      });
      devilsBargainCheckbox.addEventListener("change", () => {
        pushCheckbox.disabled = devilsBargainCheckbox.checked;
        if (devilsBargainCheckbox.checked) pushCheckbox.checked = false;
      });
    }
  }

  /* -------------------------------------------- */

  /**
   * Spends one Gambit from the linked Crew, if any is available.
   */
  async _spendGambit() {
    const crewActor = this._getCrewActor();
    const current = Number(crewActor?.system?.gambits?.value);
    if (!crewActor || !Number.isFinite(current) || current <= 0) return;
    await crewActor.update({ "system.gambits.value": current - 1 });
  }

  /* -------------------------------------------- */

  /**
   * Applies the 2 stress cost of Pushing Yourself and briefly vibrates the
   * newly filled stress boxes on the character's open sheet.
   */
  async _applyPushYourselfStress() {
    const current = Number(this.system.stress.value) || 0;
    const max = Number(this.system.stress.max) || 9;
    const next = Math.min(current + 2, max);
    if (next === current) return;

    await this.update({ "system.stress.value": next });

    // The stress update re-renders the open sheet, which would replace the
    // stress box elements and wipe a pulse class added immediately. Wait for
    // that render (or give up after a short timeout, e.g. no sheet is open)
    // before touching the DOM.
    await this._awaitNextSheetRender();
    this._pulseStressBoxes(current, next);
  }

  /**
   * Resolves once this actor's open sheet next re-renders, or after a short
   * timeout if it doesn't (e.g. the sheet isn't currently open).
   */
  _awaitNextSheetRender(timeoutMs = 300) {
    const sheetClassName = this.sheet?.constructor?.name;
    if (!sheetClassName) return Promise.resolve();

    return new Promise((resolve) => {
      let done = false;
      const hookName = `render${sheetClassName}`;
      const finish = () => {
        if (done) return;
        done = true;
        Hooks.off(hookName, hookId);
        resolve();
      };
      const hookId = Hooks.on(hookName, (app) => {
        if (app.object?.id === this.id) finish();
      });
      setTimeout(finish, timeoutMs);
    });
  }

  /**
   * Adds a brief vibrate animation (removed after 3s) to the stress boxes
   * between `fromValue` (exclusive) and `toValue` (inclusive) on this
   * actor's currently rendered sheet, if any.
   */
  _pulseStressBoxes(fromValue, toValue) {
    const sheetElement = this.sheet?.rendered ? this.sheet.element : null;
    if (!sheetElement) return;
    const root = sheetElement.jquery ? sheetElement[0] : sheetElement;
    if (!root) return;

    for (let i = fromValue + 1; i <= toValue; i++) {
      const label = root.querySelector(`label[for="character-${this.id}-stress-${i}"]`);
      if (!label) continue;
      label.classList.add("bitd-stress-pulse");
      setTimeout(() => label.classList.remove("bitd-stress-pulse"), 3000);
    }
  }

  /* -------------------------------------------- */

  async rollAttribute(
    attribute_name = "",
    additional_dice_amount = 0,
    position,
    effect,
    note,
  ) {
    let dice_amount = 0;
    if (attribute_name !== "") {
      let roll_data = this.getRollData();
      dice_amount += roll_data.dice_amount[attribute_name];
    } else {
      dice_amount = 1;
    }
    dice_amount += additional_dice_amount;

    await bladesRoll(
      dice_amount,
      attribute_name,
      position,
      effect,
      note,
      this.system.stress.value,
    );
  }

  /* -------------------------------------------- */

  /**
   * Create <options> for available actions
   *  which can be performed.
   */
  createListOfActions() {
    let text, attribute, skill;
    let attributes = this.system.attributes;

    for (attribute in attributes) {
      const skills = attributes[attribute].skills;

      text += `<optgroup label="${attribute} Actions">`;
      text += `<option value="${attribute}">${attribute} (Resist)</option>`;

      for (skill in skills) {
        text += `<option value="${skill}">${skill}</option>`;
      }

      text += `</optgroup>`;
    }

    return text;
  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs
   *  Min die modifier
   * @param {int} re
   *  Max die modifier
   * @param {int} s
   *  Selected die
   */
  createListOfDiceMods(rs, re, s) {
    var text = ``;
    var i = 0;

    if (s == "") {
      s = 0;
    }

    for (i = rs; i <= re; i++) {
      var plus = "";
      if (i >= 0) {
        plus = "+";
      }
      text += `<option value="${i}"`;
      if (i == s) {
        text += ` selected`;
      }

      text += `>${plus}${i}d</option>`;
    }

    return text;
  }

  /* -------------------------------------------- */
  getComputedAttributes() {
    let attributes = this.system.attributes;
    for (const a in attributes) {
      for (const s in attributes[a].skills) {
        if (
          attributes[a].skills[s].max === undefined ||
          attributes[a].skills[s].max === 4
        ) {
          attributes[a].skills[s].max = 3;
        }

        //include Active Effect alterations to skill minimums
        if (attributes[a].skills[s].value <= attributes[a].skills[s].min) {
          attributes[a].skills[s].value = attributes[a].skills[s].min;
        }
      }
    }
    //check for mastery
    if (this.getHasMastery()) {
      for (const b in attributes) {
        for (const t in attributes[b].skills) {
          if (attributes[b].skills[t].max === 3) {
            attributes[b].skills[t].max = 4;
          }
        }
      }
    }
    return attributes;
  }

  getMaxStress() {
    let max_stress = this.system.stress.max;
    const crew_actor = this._getCrewActor();
    if (crew_actor) {
      const bonus = Number(crew_actor?.system?.scoundrel?.add_stress);
      if (Number.isFinite(bonus)) {
        max_stress += bonus;
      }
    }
    return max_stress;
  }

  getMaxTrauma() {
    let max_trauma = this.system.trauma.max;
    const crew_actor = this._getCrewActor();
    if (crew_actor) {
      const bonus = Number(crew_actor?.system?.scoundrel?.add_trauma);
      if (Number.isFinite(bonus)) {
        max_trauma += bonus;
      }
    }
    return max_trauma;
  }

  getHasMastery() {
    const crew_actor = this._getCrewActor();
    if (!crew_actor) {
      return false;
    }
    return Boolean(crew_actor?.system?.scoundrel?.mastery);
  }

  getHealingMin() {
    let current_healing = parseInt(this.system.healing_clock.value);
    if (current_healing < this.system.healing_clock.min) {
      current_healing = this.system.healing_clock.min;
    }
    return current_healing;
  }

  /**
   * Keys/Deadlocks self-heal: older actors (and the pre-fix template default) only ever
   * seeded a single, non-empty "example" slot, which left no empty slot for Add Key to fill
   * and only rendered 1 of the intended 5 rows. Pad the list up to system.keys.max with empty
   * slots and normalize any leftover "example" placeholder to an empty, addable slot.
   *
   * Also migrates legacy per-slot fields (`marks` → `experience`, `boomed` → `deadlocked`)
   * and guarantees every slot has the canonical shape:
   * `{ key, experience, deadlocked, deadlocked_to }`.
   */
  getComputedKeys() {
    const max = this.system.keys?.max ?? 5;
    const rawList = this.system.keys?.list ?? [];
    // Partial dot-notation updates (e.g. "system.keys.list.0.key") can leave Foundry's merge
    // with a plain object keyed by index ({"0": {...}, "1": {...}}) instead of a real array;
    // normalize either shape back into an array before working with it.
    const asArray = Array.isArray(rawList) ? rawList : Object.values(rawList);
    const list = foundry.utils.deepClone(asArray);
    const emptySlot = () => ({ key: "", experience: 0, deadlocked: false, deadlocked_to: "" });
    const normalized = list.map((slot) => {
      const key = slot?.key === "example" ? "" : (slot?.key ?? "");
      const experience = Number(
        slot?.experience ?? slot?.marks ?? 0
      );
      const deadlocked = Boolean(slot?.deadlocked ?? slot?.boomed ?? false);
      const deadlocked_to = deadlocked ? String(slot?.deadlocked_to ?? "") : "";
      return {
        key,
        experience: Number.isFinite(experience) ? Math.max(0, Math.min(3, experience)) : 0,
        deadlocked,
        deadlocked_to,
      };
    });
    while (normalized.length < max) {
      normalized.push(emptySlot());
    }
    return normalized;
  }
}

/**
 * A simple and flexible system for world-building using an arbitrary collection of character and item attributes
 * Author: Atropos
 * Software License: GNU GPLv3
 */

// Import Modules
import { registerSystemSettings } from "./settings.js";
import { preloadHandlebarsTemplates } from "./blades-templates.js";
import { bladesRoll, simpleRollPopup } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { BladesActor } from "./blades-actor.js";
import { BladesItem } from "./blades-item.js";
import { BladesItemSheet } from "./blades-item-sheet.js";
import { BladesActorSheet } from "./blades-actor-sheet.js";
import { BladesActiveEffect } from "./blades-active-effect.js";
import { BladesCrewSheet } from "./blades-crew-sheet.js";
import { BladesClockSheet } from "./blades-clock-sheet.js";
import { BladesNPCSheet } from "./blades-npc-sheet.js";
import { BladesFactionSheet } from "./blades-faction-sheet.js";
import * as migrations from "./migration.js";
import { getActorSheetClass, getItemSheetClass, registerActorSheet, unregisterActorSheet, registerItemSheet, unregisterItemSheet } from "./compat.js";

window.BladesHelpers = BladesHelpers;

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */
Hooks.once("init", async function() {
  console.log(`Initializing Blades In the Dark System`);

  game.blades = {
    dice: bladesRoll,
	roller: simpleRollPopup
  };
  game.system.bladesClocks = {
    sizes: [ 4, 6, 8, 10, 12 ]
  };

  game.system.traumas = [ "cold", "haunted", "obsessed", "paranoid", "reckless", "soft", "unstable", "vicious" ];

  // Blades '68 personality Keys (see lang/en.json BITD.Key*/BITD.Key*Drift entries).
  // deadlockedKeys are the two drift outcomes (▼ / ▲) that become selectable when a Key is deadlocked.
  const blades68DeadlockedKeys = {
    Arrogant: ["humbled", "self-obsessed"],
    Bitter: ["affable", "vindictive"],
    Blunt: ["diplomatic", "caustic"],
    Bold: ["nervous", "reckless"],
    Brooding: ["morose", "untroubled"],
    Calculating: ["apathetic", "paranoid"],
    Charismatic: ["cold", "manipulative"],
    Cold: ["brutal", "friendly"],
    Comical: ["serious", "unhinged"],
    Commanding: ["deferential", "controlling"],
    Confident: ["insecure", "arrogant"],
    Cool: ["jittery", "cold"],
    Curious: ["disinterested", "possessed"],
    Cynical: ["optimistic", "nihilist"],
    Dedicated: ["cynical", "obsessed"],
    Defiant: ["compliant", "furious"],
    Determined: ["laid-back", "obsessed"],
    Disciplined: ["loose", "uptight"],
    Distant: ["warm", "cold"],
    Eccentric: ["ordinary", "erratic"],
    Enigmatic: ["open", "reclusive"],
    Enthusiastic: ["apathetic", "reckless"],
    Erratic: ["calm", "chaotic"],
    Fearless: ["nervous", "turbulent"],
    Flamboyant: ["demure", "self-obsessed"],
    Haunted: ["self-assured", "tormented"],
    Hopeful: ["cynical", "content"],
    Idealistic: ["cynical", "zealous"],
    Insecure: ["confident", "anxious"],
    Kind: ["cold", "charitable"],
    Laidback: ["indifferent", "tense"],
    Lonely: ["social", "loner"],
    Loyal: ["selfish", "self-sacrificing"],
    Meticulous: ["sloppy", "obsessive"],
    Openminded: ["rigid", "reckless"],
    Passionate: ["apathetic", "furious"],
    Playful: ["serious", "unhinged"],
    Professional: ["casual", "heartless"],
    Protective: ["cold", "vengeful"],
    Rational: ["irregular", "uncaring"],
    Reckless: ["careful", "chaotic"],
    Romantic: ["cynical", "in-love"],
    Sad: ["content", "miserable"],
    Sardonic: ["grim", "witty"],
    Sharp: ["dulled", "searing"],
    Shy: ["open", "withdrawn"],
    Soft: ["hard", "passive"],
    Sophisticated: ["modest", "pretentious"],
    Spiritual: ["cynical", "obsessed"],
    Stubborn: ["flexible", "pig-headed"],
    Suspicious: ["trusting", "paranoid"],
    Talkative: ["quiet", "long-winded"],
    Tired: ["rejuvenated", "defeated"],
    Violent: ["merciful", "vicious"],
    Witty: ["serious", "goofy"],
  };

  game.system.blades68Keys = Object.keys(blades68DeadlockedKeys).map(name => ({
    id: name,
    label: `BITD.Key${name}`,
    drift: `BITD.Key${name}Drift`,
    deadlockedKeys: blades68DeadlockedKeys[name],
  }));

  CONFIG.Item.documentClass = BladesItem;
  CONFIG.Actor.documentClass = BladesActor;
  CONFIG.ActiveEffect.documentClass = BladesActiveEffect;

  // Register System Settings
  registerSystemSettings();


  if (game.settings.get('blades68', "PublicClocks")) {
	Hooks.on("preCreateActor", (actor, createData, options, userId) => {
		if (actor.type === "\uD83D\uDD5B clock") {
			actor.updateSource({
				'ownership.default': CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
			});
		}
	});
  }


  // Is the value Turf side.
  Handlebars.registerHelper('is_turf_side', function(value, options) {
    if (["left", "right", "top", "bottom"].includes(value)) {
      return options.fn(this);
    } else {
      return options.inverse(this);
    }
  });

  // Multiboxes.
  Handlebars.registerHelper('multiboxes', function(selected, options) {

    let html = options.fn(this);

    // Fix for single non-array values.
    if ( !Array.isArray(selected) ) {
      selected = [selected];
    }

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp(' value=\"' + escapedValue + '\"');
          let oldHtml = html;
          html = html.replace(rgx, "$& checked");
          while( ( oldHtml === html ) && ( escapedValue >= 0 ) ){
            escapedValue--;
            rgx = new RegExp(' value=\"' + escapedValue + '\"');
            html = html.replace(rgx, "$& checked");
          }
        }
      });
    }
    return html;
  });

  // Trauma Counter
  Handlebars.registerHelper('traumacounter', function(selected, options) {

    let html = options.fn(this);

    var count = 0;
    for (const trauma in selected) {
      if (selected[trauma] === true) {
        count++;
      }
    }

    //if (count > 4) count = 4;

    const rgx = new RegExp(' value=\"' + count + '\"');
    return html.replace(rgx, "$& checked");

  });

  // NotEquals handlebar.
  Handlebars.registerHelper('noteq', (a, b, options) => {
    return (a !== b) ? options.fn(this) : '';
  });

  //Less than comparison
  Handlebars.registerHelper('lteq', (a, b) => {
    return (a <= b);
  });

  //Greater than comparison
  Handlebars.registerHelper('gteq', (a, b) => {
    return (a >= b);
  });

  Handlebars.registerHelper('oneless', (a) => {
    return (a - 1);
  });

  // True if one of the given Key options has this id (used to fall back to a plain
  // <option> for custom Key text that doesn't match a catalog entry).
  Handlebars.registerHelper('keyOptionExists', (options, key) => {
    return (options || []).some(opt => opt.id === key);
  });

  // True if a value is in an array (used for custom deadlocked_to fallback options).
  Handlebars.registerHelper('includes', (arr, value) => {
    return Array.isArray(arr) && arr.includes(value);
  });

  // True if the actor owns at least one item of the given type (used to hide trait labels).
  Handlebars.registerHelper('hasItemType', (items, type) => {
    return (items || []).some(i => i?.type === type);
  });

	//Reputation and Turf Bar on Crew Sheet
    Handlebars.registerHelper('repturf', (_id, turfs_amount, max_rep, options) => {

    let html = options.fn(this);
	var turfs_amount_int = parseInt(turfs_amount);
    for (let i = 1; i <= max_rep; i++) {

      if (i > max_rep - turfs_amount_int) {
        html += `<input disabled type="radio" id="crew-${_id}-reputation-${i}" name="system.reputation" value="${i} dtype="Radio"><label style="background-image: url('systems/blades-in-the-dark/styles/assets/blades68/stresspill_filled.png')" class="radio-toggle" for="crew-${_id}-reputation-${i}"></label>`;
	  } else {
	  html += `<input type="radio" id="crew-${_id}-reputation-${i}" name="system.reputation" value="${i}" dtype="Radio"><label class="radio-toggle" for="crew-${_id}-reputation-${i}"></label>`;
	  }
	}

    return html;
  });

  // Enrich the HTML replace /n with <br>
  Handlebars.registerHelper('html', (options) => {

    let text = options.hash['text'].replace(/\n/g, "<br />");

    return new Handlebars.SafeString(text);
  });

  // times_from_1 left as legacy code to not break Alternate Sheets compatibility
  Handlebars.registerHelper('times_from_1', function(n, block) {

    var accum = '';
    for (var i = 1; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  // times_from_0 left as legacy code to not break Alternate Sheets compatibility
  Handlebars.registerHelper('times_from_0', function(n, block) {

    var accum = '';
    for (var i = 0; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  // "N Times" loop for handlebars.
  //  Block is executed N times starting from start.
  //
  // Usage:
  // {{#times_from 1 10}}
  //   <span>{{this}}</span>
  // {{/times_from}}
  Handlebars.registerHelper('times_from', function(start, n, block) {

    let accum = '';
    for (let i = start; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  // Concat helper
  // https://gist.github.com/adg29/f312d6fab93652944a8a1026142491b1
  // Usage: (concat 'first 'second')
  Handlebars.registerHelper('concat', function() {
    var outStr = '';
    for(var arg in arguments){
        if(typeof arguments[arg]!='object'){
            outStr += arguments[arg];
        }
    }
    return outStr;
  });


  /**
   * @inheritDoc
   * Takes label from Selected option instead of just plain value.
   */

  Handlebars.registerHelper('selectOptionsWithLabel', function(choices, options) {

    const localize = options.hash['localize'] ?? false;
    let selected = options.hash['selected'] ?? null;
    let blank = options.hash['blank'] || null;
    selected = selected instanceof Array ? selected.map(String) : [String(selected)];

    // Create an option
    const option = (key, object) => {
      if ( localize ) object.label = game.i18n.localize(object.label);
      let isSelected = selected.includes(key);
      html += `<option value="${key}" ${isSelected ? "selected" : ""}>${object.label}</option>`
    };

    // Create the options
    let html = "";
    if ( blank ) option("", blank);
    Object.entries(choices).forEach(e => option(...e));

    return new Handlebars.SafeString(html);
  });


  /**
   * Create appropriate Blades clock
   */
  // Clocks in color for Clock Actors
  Handlebars.registerHelper('blades-clock-color', function(parameter_name, type, color, current_value, uniq_id) {

    let html = '';

    if (current_value === null || current_value === 'null') {
      current_value = 0;
    }
	if (color === undefined) {
      color = "black";
    }

    if (parseInt(current_value) > parseInt(type)) {
      current_value = type;
    }

    // Label for 0
    html += `<label class="clock-zero-label" for="clock-0-${uniq_id}}"><i class="fab fa-creative-commons-zero nullifier"></i></label>`;
    html += `<div id="blades-clock-${uniq_id}" class="blades-clock clock-${type} clock-${type}-${current_value}" style="background-image:url('systems/blades-in-the-dark/themes/${color}/${type}clock_${current_value}.svg');">`;

    let zero_checked = (parseInt(current_value) === 0) ? 'checked' : '';
    html += `<input type="radio" value="0" id="clock-0-${uniq_id}}" data-dType="String" name="${parameter_name}" ${zero_checked}>`;

    for (let i = 1; i <= parseInt(type); i++) {
      let checked = (parseInt(current_value) === i) ? 'checked' : '';
      html += `
        <input type="radio" value="${i}" id="clock-${i}-${uniq_id}" data-dType="String" name="${parameter_name}" ${checked}>
        <label class="radio-toggle" for="clock-${i}-${uniq_id}"></label>
      `;
    }

    html += `</div>`;
    return html;
  });
  // Clocks in black for clocks embedded in sheets
  Handlebars.registerHelper('blades-clock', function(parameter_name, type, current_value, uniq_id) {

    let html = '';

    if (current_value === null || current_value === 'null') {
      current_value = 0;
    }

    if (parseInt(current_value) > parseInt(type)) {
      current_value = type;
    }

    // Label for 0
    html += `<label class="clock-zero-label" for="clock-0-${uniq_id}}"><i class="fab fa-creative-commons-zero nullifier"></i></label>`;
    html += `<div id="blades-clock-${uniq_id}" class="blades-clock clock-${type} clock-${type}-${current_value}" style="background-image:url('systems/blades-in-the-dark/themes/black/${type}clock_${current_value}.svg');">`;

    let zero_checked = (parseInt(current_value) === 0) ? 'checked' : '';
    html += `<input type="radio" value="0" id="clock-0-${uniq_id}}" data-dType="String" name="${parameter_name}" ${zero_checked}>`;

    for (let i = 1; i <= parseInt(type); i++) {
      let checked = (parseInt(current_value) === i) ? 'checked' : '';
      html += `
        <input type="radio" value="${i}" id="clock-${i}-${uniq_id}" data-dType="String" name="${parameter_name}" ${checked}>
        <label class="radio-toggle" for="clock-${i}-${uniq_id}"></label>
      `;
    }

    html += `</div>`;
    return html;
  });
  
  Handlebars.registerHelper('pc', function( string ) {
    return BladesHelpers.getProperCase( string );
  });
  
  // check for game settings
  Handlebars.registerHelper('getSetting', function( string ) {
	  return (game.settings.get('blades68', string));

  });
});

/**
 * Once the entire VTT framework is initialized, check to see if we should perform a data migration
 * and register sheets. Sheet registration is delayed until the ready hook so the DocumentSheetConfig
 * API and the new foundry.documents collections are guaranteed to exist on V13+ while still
 * allowing the compatibility helpers to fall back on older cores.
 */
Hooks.once("ready", async function() {
  const actorSheetClass = getActorSheetClass();
  const itemSheetClass = getItemSheetClass();

  unregisterActorSheet("core", actorSheetClass);
  registerActorSheet("blades", BladesActorSheet, { types: ["character"], makeDefault: true });
  registerActorSheet("blades", BladesCrewSheet, { types: ["crew"], makeDefault: true });
  registerActorSheet("blades", BladesFactionSheet, { types: ["factions"], makeDefault: true });
  registerActorSheet("blades", BladesClockSheet, { types: ["\uD83D\uDD5B clock"], makeDefault: true });
  registerActorSheet("blades", BladesNPCSheet, { types: ["npc"], makeDefault: true });
  unregisterItemSheet("core", itemSheetClass);
  registerItemSheet("blades", BladesItemSheet, {makeDefault: true});

  await preloadHandlebarsTemplates();

/**
  // Determine whether a system migration is required
  const currentVersion = game.settings.get("bitd", "systemMigrationVersion");
  const NEEDS_MIGRATION_VERSION = 2.15;

  let needMigration = (currentVersion < NEEDS_MIGRATION_VERSION) || (currentVersion === null);

  // Perform the migration
  if ( needMigration && game.user.isGM ) {
    migrations.migrateWorld();
  }
  **/
});

/*
 * Hooks
 */

// getSceneControlButtons
Hooks.on('getSceneControlButtons', controls => {
	
	if (foundry.utils.isNewerVersion(game.version,13)) {
		controls.tokens.tools.DiceRoller = {
			name: "DiceRoller",
			title: "BITD.DiceRoller",
			icon: "fas fa-dice",
			onChange: (event, active) => {
				simpleRollPopup();
			},
			button: true
		};		
	}
});
	
Hooks.on("renderSceneControls", async (app, html) => {	

	if (foundry.utils.isNewerVersion(13,game.version)) { 
	  let dice_roller = $('<li class="scene-control" data-tooltip="Dice Roll"><i class="fas fa-dice"></i></li>');
	  dice_roller.click( async function() {
		await simpleRollPopup();
	  });
	  html.children().first().append( dice_roller );
	}

});

const PAUSE_IMAGE = "systems/blades68/styles/assets/blades68/bladesin68_logo.png";

function setPauseImage(target) {
  // renderGamePause (V13+) passes an HTMLElement, renderPause (V12 and older) passes jQuery
  const root = target instanceof HTMLElement ? target : target?.[0];
  const image = root?.querySelector("img");

  if (image) {
    image.src = PAUSE_IMAGE;
  }
}

Hooks.on("renderGamePause", (app, element) => setPauseImage(element));
Hooks.on("renderPause", (app, html) => setPauseImage(html));

/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
import { loadHandlebarsTemplates } from "./compat.js";

export const preloadHandlebarsTemplates = async function() {

  // Define template paths to load
  const templatePaths = [

    // Actor Sheet Partials
    "systems/blades68/templates/parts/coins.html",
    "systems/blades68/templates/parts/attributes.html",
    "systems/blades68/templates/parts/turf-list.html",
    "systems/blades68/templates/parts/turf-header.html",
    "systems/blades68/templates/parts/cohort-block.html",
    "systems/blades68/templates/parts/factions.html",
    "systems/blades68/templates/parts/active-effects.html",
  ];

  // Load the template parts
  return loadHandlebarsTemplates(templatePaths);
};

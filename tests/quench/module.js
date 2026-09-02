/* global Hooks */
import registerSystem from './batches/system.js';
import registerDice from './batches/dice.js';
import registerActors from './batches/actors.js';
import registerActorSheetCatalogs from './batches/actor-sheet-catalogs.js';
import registerCrewTypes from './batches/crew-types.js';

const BATCH_REGISTRARS = [
  registerSystem,
  registerDice,
  registerActors,
  registerActorSheetCatalogs,
  registerCrewTypes
];

Hooks.on('quenchReady', (quench) => {
  for (const register of BATCH_REGISTRARS) register(quench);
});

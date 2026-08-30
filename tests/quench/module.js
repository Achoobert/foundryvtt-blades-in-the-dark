/* global Hooks */
import registerSystem from './batches/system.js';
import registerDice from './batches/dice.js';
import registerActors from './batches/actors.js';

const BATCH_REGISTRARS = [registerSystem, registerDice, registerActors];

Hooks.on('quenchReady', (quench) => {
  for (const register of BATCH_REGISTRARS) register(quench);
});

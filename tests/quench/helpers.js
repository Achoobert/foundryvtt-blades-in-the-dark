/* global game */

export const SYSTEM_ID = 'blades68';

export function requireSystemActive() {
  if (game.system.id !== SYSTEM_ID) {
    throw new Error(`Expected system "${SYSTEM_ID}" active, got "${game.system.id}" — is Blades68 the world's system?`);
  }
  return game.system;
}

/** Track actors/items created by a batch so an `after` hook can clean them up. */
export function createdDocsTracker() {
  const created = [];
  return {
    created,
    track(doc) {
      created.push(doc);
      return doc;
    },
    async cleanup() {
      for (const doc of created.splice(0)) {
        await doc.delete();
      }
    }
  };
}

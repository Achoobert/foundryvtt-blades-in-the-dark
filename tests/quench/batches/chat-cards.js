/* global Actor, Hooks */
import { createdDocsTracker, requireSystemActive } from '../helpers.js';

function waitForNextChatMessage() {
  return new Promise((resolve) => {
    Hooks.once('createChatMessage', (msg) => resolve(msg));
  });
}

export default function register(quench) {
  quench.registerBatch(
    'blades68.chat-cards',
    (context) => {
      const { describe, it, assert, after } = context;
      const tracker = createdDocsTracker();

      after(async () => {
        await tracker.cleanup();
      });

      describe('action-roll chat card', function () {
        it('shows the localized skill name after a skill roll (regression: §5.11 "show skill used in chat card")', async function () {
          this.timeout(10000);
          requireSystemActive();
          const actor = tracker.track(await Actor.create({ name: 'Quench Chat Card PC', type: 'character' }));
          await actor.update({ 'system.attributes.insight.skills.hunt.value': 2 });

          const wait = waitForNextChatMessage();
          await actor.rollAttribute('hunt', 0, 'risky', 'standard', '');
          const msg = await wait;

          assert.include(msg.content, 'chat-label', 'expected a .chat-label div in the chat card content');
          assert.include(msg.content, 'Hunt', 'expected the localized skill name "Hunt" to appear in the chat card');

          // Also check the rendered chat log DOM, in case the markup is correct
          // but CSS hides or collapses it.
          await new Promise((resolve) => setTimeout(resolve, 500));
          const el = document.querySelector(`[data-message-id="${msg.id}"] .chat-label`);
          assert.exists(el, 'expected .chat-label element to exist in the rendered chat log DOM');

          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          assert.notEqual(style.display, 'none', 'chat-label should not be display:none');
          assert.isAbove(rect.height, 0, 'chat-label should have nonzero rendered height');
          assert.equal(el.textContent.trim(), 'Hunt', 'chat-label text should be the localized skill name');
        });
      });
    },
    { displayName: 'Chat cards' }
  );
}

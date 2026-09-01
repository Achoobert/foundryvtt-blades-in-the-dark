/* global cy, describe, expect, it */
import 'cypress-if';

describe('Quench tests', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.licenseAgreeAndClickAccept();
    cy.setupInputPasswordAndClickLogin();
    cy.closeTourOverlay();
    cy.launchTestWorldFromSetup();
    cy.loginAsGM();
    cy.window({ timeout: 120000 }).should((win) => {
      expect(win.game?.ready, 'game.ready before Quench').to.eq(true);
    });
    cy.get('.quench-button, [data-tooltip="QUENCH.Title"]', { timeout: 120000 }).should('exist');
  });

  it('run quench tests', () => {
    cy.get('.quench-button, [data-tooltip="QUENCH.Title"]').if().then(() => {
      cy.get('.quench-button, [data-tooltip="QUENCH.Title"]').click();
    });

    cy.get('.quench-button, [data-tooltip="QUENCH.Title"]').click();
    cy.get("[data-select='all']").should('exist').click({ force: true });
    cy.get('#quench-run').should('be.visible').and('not.be.disabled').click();

    // Quench disables Run while a suite is in flight; re-enabled once finished.
    cy.get('#quench-run').should('be.disabled');
    cy.get('#quench-run', { timeout: 300000 }).should('not.be.disabled');

    cy.get('.stats', { timeout: 10000 }).should('exist');
    cy.get('.stats').then((stats) => {
      cy.log('Test report: ', stats.text());
    });

    cy.wait(1000);
    cy.get('.error').if().then((summary) => {
      cy.log('errors: ', summary.text());
    });

    cy.get('.stats').if().then(($stats) => {
      const summary = $stats.text();
      const passMatch = summary.match(/(\d+)\s+pass/i);
      const passCount = passMatch ? Number(passMatch[1]) : 0;
      // A broken registerBatch call fails silently and Quench reports "Ran 0 tests" —
      // assert a nonzero pass count, not just "no failures".
      expect(passCount, `Quench ran zero tests:\n${summary}`).to.be.greaterThan(0);

      if (!summary.includes('failed')) return;

      // Quench flags a failed runnable with a times-circle status icon in its summary row.
      const failedTests = Cypress.$('li.test:has(> .summary > i.fa-times-circle)')
        .map((_, el) => Cypress.$(el).find('> .summary').text().trim())
        .get();
      const errors = Cypress.$('.error-message')
        .map((_, el) => Cypress.$(el).text().trim())
        .get();
      const diffs = Cypress.$('.diff')
        .map((_, el) => Cypress.$(el).text().trim())
        .get();

      expect(
        summary,
        `Quench failures:\n${JSON.stringify({ summary, failedTests, errors, diffs }, null, 2)}`
      ).to.not.include('failed');
    });
  });
});

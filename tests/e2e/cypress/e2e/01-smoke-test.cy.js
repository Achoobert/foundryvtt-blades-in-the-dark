describe('Smoke tests', () => {
  it('should visit the home page', () => {
    cy.visit('/');
    cy.get('body').should('exist', { timeout: 10000 });
  });

  it('should login', () => {
    cy.visit('/');
    cy.licenseAgreeAndClickAccept();
    cy.setupInputPasswordAndClickLogin();
    cy.closeTourOverlay();
    cy.launchTestWorldFromSetup();
    cy.loginAsGM();
    cy.get('body').should('exist', { timeout: 10000 });
  });

  it('loads the Blades68 system', () => {
    cy.visit('/');
    cy.licenseAgreeAndClickAccept();
    cy.setupInputPasswordAndClickLogin();
    cy.closeTourOverlay();
    cy.launchTestWorldFromSetup();
    cy.loginAsGM();

    cy.window({ timeout: 120000 }).should((win) => {
      expect(win.game.system.id, 'game.system.id').to.eq('blades68');
      expect(win.game.modules.get('quench')?.active, 'quench module active').to.eq(true);
      expect(win.game.modules.get('blades68-quench-tests')?.active, 'blades68-quench-tests module active').to.eq(true);
    });
  });
});

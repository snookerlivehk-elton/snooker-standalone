describe('Full user flow', () => {
  it('allows a user to setup a match and see the scoreboard', () => {
    cy.visit('http://localhost:5173');

    // Fill in match setup
    cy.get('#matchName').clear().type('Test Match');
    cy.get('#p1Name').clear().type('Player A');
    cy.get('#p1MemberId').clear().type('PA');
    cy.get('#p2Name').clear().type('Player B');
    cy.get('#p2MemberId').clear().type('PB');

    // Start the match
    cy.contains('Start Match').click();

    // Verify scoreboard is displayed
    cy.contains('Test Match');
    cy.contains('Player A');
    cy.contains('Player B');

    // Verify initial scores are 0
    cy.get('.text-6xl.font-bold').should('contain', '0');
  });
});
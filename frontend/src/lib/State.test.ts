/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';
import { State } from './State';

const defaultParams = {
    playersInfo: [
        { name: 'Player 1', memberId: 'p1' },
        { name: 'Player 2', memberId: 'p2' }
    ],
    settings: {
        matchName: 'Test Match',
        redBalls: 15,
        framesRequired: 3
    },
    startingPlayerIndex: 0
};

describe('State', () => {
    let state: State;

    beforeEach(() => {
        state = new State(defaultParams);
    });

    it('should initialize with default settings', () => {
        const state = new State();
        expect(state.players.length).toBe(2);
        expect(state.settings.redBalls).toBe(15);
        expect(state.redsRemaining).toBe(15);
        expect(state.mustPotRed).toBe(true);
    });

    it('should start a new match with two players', () => {
        expect(state.players).toHaveLength(2);
        expect(state.players[0].name).toBe('Player 1');
        expect(state.players[1].name).toBe('Player 2');
        expect(state.players[0].memberId).toBe('p1');
        expect(state.players[1].memberId).toBe('p2');
    });

    // ... (rest of the tests remain the same)

    describe('end of frame and match', () => {
        it('should start a new frame correctly', () => {
            state.settings.framesRequired = 5; // Ensure match doesn't end
            state.players[0].score = 60;
            state.players[1].score = 20;
            state.isFrameOver = true;
            state.newFrame();
            expect(state.players[0].framesWon).toBe(1);
            expect(state.frame).toBe(2);
            expect(state.players[0].score).toBe(0);
            expect(state.redsRemaining).toBe(15);
        });

        it('should end the match when a player reaches the required frames', () => {
        state.settings.framesRequired = 3;
        state.players[0].framesWon = 1;
        state.players[0].score = 10; // Make player 0 win the frame
        state.newFrame(); // This will increment framesWon to 2 and check for match over
        expect(state.isMatchOver).toBe(true);
    });
    });
});

// Add a clone method to State for testing purposes
State.prototype.clone = function() {
    const new_state = new State({
        playersInfo: this.players.map(p => ({ name: p.name, memberId: p.memberId })),
        settings: { ...this.settings },
        startingPlayerIndex: this.currentPlayerIndex
    });
    Object.assign(new_state, JSON.parse(JSON.stringify(this)));
    new_state.players = this.players.map(p => p.clone());
    return new_state;
};
/** @vitest-environment node */

import { describe, it, expect } from 'vitest';
import { Player } from './Player';

describe('Player', () => {
  it('should initialize with correct name and memberId', () => {
    const player = new Player('John Doe', 'JD');
    expect(player.name).toBe('John Doe');
    expect(player.memberId).toBe('JD');
    expect(player.score).toBe(0);
    expect(player.framesWon).toBe(0);
    expect(player.fouls).toBe(0);
  });

  it('should add points to the score', () => {
    const player = new Player('John Doe', 'JD');
    player.add_points(10);
    expect(player.score).toBe(10);
    player.add_points(5);
    expect(player.score).toBe(15);
  });

  it('should subtract points from the score', () => {
    const player = new Player('John Doe', 'JD');
    player.score = 20;
    player.subtract_points(5);
    expect(player.score).toBe(15);
  });

  it('should add a frame won', () => {
    const player = new Player('John Doe', 'JD');
    player.add_frame();
    expect(player.framesWon).toBe(1);
    player.add_frame();
    expect(player.framesWon).toBe(2);
  });

  it('should add a foul', () => {
    const player = new Player('John Doe', 'JD');
    player.add_foul();
    expect(player.fouls).toBe(1);
    player.add_foul();
    expect(player.fouls).toBe(2);
  });

  it('should reset the score', () => {
    const player = new Player('John Doe', 'JD');
    player.score = 50;
    player.reset_score();
    expect(player.score).toBe(0);
  });

  it('should add a high break', () => {
    const player = new Player('John Doe', 'JD');
    player.add_high_break(45, 180);
    expect(player.highBreaks).toEqual([{ score: 45, time: 180 }]);
    player.add_high_break(60, 240);
    expect(player.highBreaks).toEqual([{ score: 45, time: 180 }, { score: 60, time: 240 }]);
  });

  it('should clone the player object', () => {
    const player = new Player('John Doe', 'JD');
    player.score = 30;
    player.framesWon = 1;
    player.fouls = 2;
    player.add_high_break(25, 120);

    const clonedPlayer = player.clone();
    expect(clonedPlayer).not.toBe(player);
    expect(clonedPlayer.name).toBe(player.name);
    expect(clonedPlayer.memberId).toBe(player.memberId);
    expect(clonedPlayer.score).toBe(player.score);
    expect(clonedPlayer.framesWon).toBe(player.framesWon);
    expect(clonedPlayer.fouls).toBe(player.fouls);
    expect(clonedPlayer.highBreaks).toEqual(player.highBreaks);

    // Ensure it's a deep copy for highBreaks
    clonedPlayer.add_high_break(50, 200);
    expect(player.highBreaks.length).toBe(1);
    expect(clonedPlayer.highBreaks.length).toBe(2);
  });
});
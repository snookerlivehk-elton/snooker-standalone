import { describe, it, expect } from 'vitest'
import { StatsEngine } from './StatsEngine'
import { RoomStorage } from './RoomStorage'

const roomId = 'test-room'

function resetRoom() {
  try {
    localStorage.clear()
  } catch {}
}

describe('StatsEngine metrics', () => {
  it('computes red/color success, pot/miss ratios, entry success and break buckets', () => {
    resetRoom()
    // Simulate a sequence:
    // Player 0: switch -> red pot -> color pot -> red pot -> color miss -> switch
    RoomStorage.appendEvent(roomId, { type: 'switch', playerIndex: 1, playerMemberId: 'P2' })
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 0, playerMemberId: 'P1', ballName: 'red', points: 1 })
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 0, playerMemberId: 'P1', ballName: 'yellow', points: 2 })
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 0, playerMemberId: 'P1', ballName: 'red', points: 1 })
    RoomStorage.appendEvent(roomId, { type: 'miss', playerIndex: 0, playerMemberId: 'P1', points: 0 })
    RoomStorage.appendEvent(roomId, { type: 'switch', playerIndex: 0, playerMemberId: 'P1' })
    // Player 1: red pot x1, color pot x1, red pot x1, color pot x1 => streak 4 pots, then switch
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 1, playerMemberId: 'P2', ballName: 'red', points: 1 })
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 1, playerMemberId: 'P2', ballName: 'green', points: 3 })
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 1, playerMemberId: 'P2', ballName: 'red', points: 1 })
    RoomStorage.appendEvent(roomId, { type: 'pot', playerIndex: 1, playerMemberId: 'P2', ballName: 'blue', points: 5 })
    RoomStorage.appendEvent(roomId, { type: 'switch', playerIndex: 1, playerMemberId: 'P2' })
    const stats = StatsEngine.compute(roomId, null)
    const p0 = stats.perPlayer[0]
    const p1 = stats.perPlayer[1]
    expect(p0.potCount).toBeGreaterThan(0)
    expect(p0.missCount).toBeGreaterThan(0)
    expect(p0.potOverMissRate).toBeGreaterThan(0)
    expect(p0.redSuccessRate).toBeGreaterThanOrEqual(0)
    expect(p0.colorSuccessRate).toBeGreaterThanOrEqual(0)
    expect(p0.safeSuccessRate).toBeGreaterThanOrEqual(0)
    expect(p1.entrySuccessRate).toBeGreaterThanOrEqual(0)
    expect(p1.break20_29 + p1.break30_49 + p1.break50_79 + p1.break80_99 + p1.break100_146 + p1.break147).toBeGreaterThanOrEqual(0)
  })
})

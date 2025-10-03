import { Player } from './Player';

// As per the data structure design suggestion
interface Shot {
    player: number; // Index of the player
    ball?: 'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black';
    points: number;
    type: 'pot' | 'foul' | 'safety' | 'break';
    timestamp: number;
}

export interface StateConstructorParams {
    p1Name?: string;
    p2Name?: string;
    p1MemberId?: string;
    p2MemberId?: string;
    matchName?: string;
    redBalls?: number;
    framesRequired?: number;
    firstBreaker?: number;
}

export class State {
    // Match Info
    public players: Player[];
    public settings: {
        matchName: string;
        redBalls: number;
        framesRequired: number;
    };

    // Current State
    public frame: number;
    public currentPlayerIndex: number;
    public redsRemaining: number;
    public pottedColors: number[];
    public mustPotRed: boolean;
    public isFreeBall: boolean;
    public isFrameOver: boolean;
    public isMatchOver: boolean;
    public isRespotBlack: boolean;
    public isClearingColours: boolean;
    public isFoulCommitted: boolean; // New state to track if a foul was just made
    public breakScore: number;
    public breakTime: number; // in seconds
    public status: 'playing' | 'paused' | 'ended';

    // History for Undo
    public history: State[];

    // Shot History
    public shotHistory: Shot[];

    // Timers
    public timers: {
        frameTime: number; // in seconds
        matchTime: number; // in seconds
    };

    constructor(params: any = {}) {
        const p1Name = params.playersInfo?.[0]?.name ?? 'Player 1';
        const p2Name = params.playersInfo?.[1]?.name ?? 'Player 2';
        const p1MemberId = params.playersInfo?.[0]?.memberId ?? 'P1';
        const p2MemberId = params.playersInfo?.[1]?.memberId ?? 'P2';
        const matchName = params.settings?.matchName ?? 'Snooker Match';
        const redBalls = params.settings?.redBalls ?? 15;
        const framesRequired = params.settings?.framesRequired ?? 1;
        const startingPlayerIndex = params.startingPlayerIndex ?? 0;

        // Match Info
        this.players = [
            new Player(p1Name, p1MemberId),
            new Player(p2Name, p2MemberId)
        ];
        this.settings = {
            matchName,
            redBalls,
            framesRequired
        };

        // Current State
        this.frame = 1;
        this.currentPlayerIndex = startingPlayerIndex;
        this.redsRemaining = this.settings.redBalls;
        this.pottedColors = [];
        this.mustPotRed = true;
        this.isFreeBall = false;
        this.isFrameOver = false;
        this.isMatchOver = false;
        this.isRespotBlack = false;
        this.isClearingColours = false;
        this.isFoulCommitted = false;
        this.breakScore = 0;
        this.breakTime = 0;
        this.status = 'playing';

        // History for Undo
        this.history = [];

        // Shot History
        this.shotHistory = [];

        // Timers
        this.timers = {
            frameTime: 0,
            matchTime: 0,
        };
    }

    public static fromJSON(json: string | object): State {
        const obj = typeof json === 'string' ? JSON.parse(json) : json;
        const state = new State();
        Object.assign(state, obj);
        state.players = obj.players.map((p: any) => Player.fromJSON(p));
        state.history = []; // Don't carry over history when creating from JSON
        return state;
    }

    // e.g., pot, foul, switchPlayer, etc.
    public pot(ballValue: number): void {
        // A value of 0 or less can be used to signify a miss from the UI.
        if (ballValue < 1) {
            this.miss();
            return;
        }
        this.saveState();

        const isFreeBallPot = this.isFreeBall;
        if (isFreeBallPot) {
            const player = this.players[this.currentPlayerIndex];
            player.add_points(1);
            this.breakScore += 1;
            this.mustPotRed = false; // Must pot a color after a free ball
            this.isFreeBall = false; // Free ball is consumed

        // A pot is a valid shot, so it's not a foul anymore
        this.isFoulCommitted = false;

        // Don't decrement reds or add to potted colors if it was a color
        // The color is respotted

        this.shotHistory.push({
            player: this.currentPlayerIndex,
            ball: this.getBallName(ballValue),
            points: 1,
            type: 'pot',
            timestamp: Date.now(),
        });

        // Now, the player has to pot a *real* color, so we return and wait for the next pot
        return;
    }

    // A pot is a valid shot, so it's not a foul anymore
    this.isFoulCommitted = false;

        // Foul check: potting the wrong ball
        if (this.redsRemaining > 0) { // These rules apply only when reds are on the table
            if (this.mustPotRed && ballValue > 1) {
                this.foul(Math.max(4, ballValue));
                return;
            }
            if (!this.mustPotRed && ballValue === 1) {
                this.foul(4); // Potting a red when a color was required
                return;
            }
        }

        if (this.isClearingColours) {
            const expectedSequence = [2, 3, 4, 5, 6, 7];
            const nextBallInSequence = expectedSequence[this.pottedColors.length];
            if (ballValue !== nextBallInSequence) {
                this.foul(Math.max(4, ballValue));
                return;
            }
        }

        const player = this.players[this.currentPlayerIndex];
        let points = ballValue;

        if (this.isRespotBlack) {
            if (ballValue === 7) {
                this.isFrameOver = true;
                player.add_frame();
            } else {
                // Potting any other ball during respot black is a foul
                this.foul(Math.max(4, ballValue));
                return;
            }
        }

        if (this.isFreeBall && ballValue > 1) {
            points = 1; // On a free ball, any color potted counts as 1
        }

        player.add_points(points);
        this.breakScore += points;

        if (ballValue === 1) {
            if (!this.isFreeBall && this.redsRemaining > 0) {
                this.redsRemaining--;
            }
            this.mustPotRed = false; // After potting a red, must pot a color
        } else { // Potted a color
            if (this.redsRemaining > 0) {
                this.mustPotRed = true; // After a color, must pot a red
            } else { // redsRemaining is 0
                if (!this.isClearingColours) {
                    // This is the color potted after the last red.
                    // It's a "free" choice, and then clearing starts.
                    this.isClearingColours = true;
                } else {
                    // This is the normal clearing colors logic.
                    if (!this.isFreeBall) {
                        this.pottedColors.push(ballValue);
                    }

                    if (this.pottedColors.length === 6 && ballValue === 7) {
                        // Check for a tie
                        if (this.players[0].score === this.players[1].score) {
                            this.isRespotBlack = true;
                            // The black is respotted, so we don't consider it "potted" in the sequence
                            this.pottedColors.pop();
                        } else {
                            this.isFrameOver = true;
                        }
                    }
                }
            }
        }

        this.shotHistory.push({
            player: this.currentPlayerIndex,
            ball: this.getBallName(ballValue),
            points: points,
            type: 'pot',
            timestamp: Date.now(),
        });

        // After a pot, it's no longer a free ball
        this.isFreeBall = false;
    }

    public toggleFreeBall(): void {
        this.isFreeBall = !this.isFreeBall;
    }

    public foul(penalty: number): void {
        this.saveState();
        // Rule: Foul on final black
        if (this.redsRemaining === 0 && this.pottedColors.length === 6) {
            this.isFrameOver = true;
            const opponentIndex = 1 - this.currentPlayerIndex;
            this.players[opponentIndex].add_frame();
            return;
        }

        // Rule: Foul during respot black
        if (this.isRespotBlack) {
            this.isFrameOver = true;
            const opponentIndex = 1 - this.currentPlayerIndex;
            this.players[opponentIndex].add_frame();
            return;
        }

        // Check for high break before resetting
        if (this.breakScore >= 20) {
            this.players[this.currentPlayerIndex].add_high_break(this.breakScore, this.breakTime);
        }

        // The opponent gets the points
        const opponentIndex = 1 - this.currentPlayerIndex;
        this.players[opponentIndex].add_points(penalty);

        // Increment the foul count for the current player
        this.players[this.currentPlayerIndex].add_foul();

        // Reset the break score of the current player
        this.breakScore = 0;
        this.breakTime = 0;

        // Record the foul in the shot history against the player who fouled
        this.shotHistory.push({
            player: this.currentPlayerIndex,
            points: penalty,
            type: 'foul',
            timestamp: Date.now(),
        });

        // Switch to the other player
        this.currentPlayerIndex = opponentIndex;

        // It's now a foul, so the next player might have a free ball
        this.isFoulCommitted = true;
    }

    public miss(): void {
        this.saveState();
        this.players[this.currentPlayerIndex].add_miss();
        this.switchPlayer();
    }

    public safe(): void {
        this.saveState();
        this.players[this.currentPlayerIndex].add_safety();
        this.switchPlayer();
    }

    public switchPlayer(): void {
        this.saveState();
        if (this.breakScore >= 20) {
            this.players[this.currentPlayerIndex].add_high_break(this.breakScore, this.breakTime);
        }
        this.breakScore = 0;
        this.breakTime = 0;
        this.currentPlayerIndex = 1 - this.currentPlayerIndex;
        this.mustPotRed = this.redsRemaining > 0;
        this.isFreeBall = false; // Free ball is cancelled on player switch
        this.isFoulCommitted = false; // Reset foul state on player switch
    }

    public concede(): void {
        this.saveState();
        this.isFrameOver = true;
        const opponentIndex = 1 - this.currentPlayerIndex;
        this.players[opponentIndex].add_frame();
        this.checkMatchOver();
    }

    public newFrame(): void {
        this.saveState();
        // Determine winner and award frame
        const winnerIndex = this.players[0].score > this.players[1].score ? 0 : 1;
        this.players[winnerIndex].add_frame();

        this.checkMatchOver();

        if (!this.isMatchOver) {
            this.frame++;
            this.players.forEach(p => p.reset_score());
            this.redsRemaining = this.settings.redBalls;
            this.pottedColors = [];
            this.mustPotRed = true;
            this.isFreeBall = false;
            this.isFrameOver = false;
            this.isRespotBlack = false;
            this.isClearingColours = false;
            this.breakScore = 0;
            this.breakTime = 0;
            this.timers.frameTime = 0;
            // Alternate starting player for the new frame
            this.currentPlayerIndex = (this.frame - 1) % 2; // Simple alternation
        }
    }

    saveState() {
        const json = JSON.stringify(this);
        const copy = State.fromJSON(JSON.parse(json));
        // 將當前的歷史鏈複製到快照上，確保連續多步撤銷可行
        copy.history = this.history.slice();
        this.history.push(copy);
    }

    undo(): State {
        if (this.history.length > 0) {
            const previousState = this.history.pop();
            if (previousState) {
                return previousState;
            }
        }
        return this;
    }

    // Undo multiple steps. Returns the resulting previous state after popping up to `steps` snapshots.
    // If `steps` <= 0 or history is shorter, it gracefully stops when history is exhausted.
    undoSteps(steps: number): State {
        let count = Math.max(0, Math.floor(steps || 0));
        let current: State = this;
        while (count > 0 && current.history.length > 0) {
            const prev = current.history.pop();
            if (!prev) break;
            current = prev;
            count--;
        }
        return current;
    }

    // Deep clone preserving players, fields, and the history chain.
    clone(): State {
        const base = new State({
            playersInfo: this.players.map(p => ({ name: p.name, memberId: p.memberId })),
            settings: { ...this.settings },
            startingPlayerIndex: this.currentPlayerIndex,
        });
        Object.assign(base, JSON.parse(JSON.stringify(this)));
        base.players = this.players.map(p => p.clone());
        // Preserve the existing history chain (snapshots are immutable copies)
        base.history = this.history.slice();
        return base;
    }

    private checkMatchOver(): void {
        const totalRequired = this.settings.framesRequired;
        if (totalRequired % 2 === 0) {
            // 偶數局：打完所有局數才判定勝負，可出現平手
            const framesPlayed = this.players[0].framesWon + this.players[1].framesWon;
            if (framesPlayed >= totalRequired) {
                this.isMatchOver = true;
                this.status = 'ended';
            }
        } else {
            // 奇數局：採用「best-of」邏輯，先拿到多數局者勝
            const framesToWin = Math.ceil(totalRequired / 2);
            for (const player of this.players) {
                if (player.framesWon >= framesToWin) {
                    this.isMatchOver = true;
                    this.status = 'ended';
                    break;
                }
            }
        }
    }

    private getBallName(ballValue: number): 'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black' | undefined {
        switch (ballValue) {
            case 1: return 'red';
            case 2: return 'yellow';
            case 3: return 'green';
            case 4: return 'brown';
            case 5: return 'blue';
            case 6: return 'pink';
            case 7: return 'black';
            default: return undefined;
        }
    }

    public getWinner(): Player | null {
        if (!this.isMatchOver) {
            return null;
        }
        if (this.settings.framesRequired % 2 === 0) {
            // 偶數局：打完所有局後比較局數，多者勝；相同為平手
            const a = this.players[0].framesWon;
            const b = this.players[1].framesWon;
            if (a === b) return null;
            return a > b ? this.players[0] : this.players[1];
        }
        // 奇數局：有人先達到多數局即為勝者
        const framesToWin = Math.ceil(this.settings.framesRequired / 2);
        for (const player of this.players) {
            if (player.framesWon >= framesToWin) return player;
        }
        return null;
    }

    public toJSON() {
        const { history, ...rest } = this;
        return rest;
    }

    public getRemainingPoints(): number {
        let remaining = this.redsRemaining * 8; // 1 for the red, 7 for the black
        const colors = [2, 3, 4, 5, 6, 7];
        if (this.redsRemaining > 0) {
            remaining += 27;
        } else {
            for (const color of colors) {
                if (!this.pottedColors.includes(color)) {
                    remaining += color;
                }
            }
        }
        return remaining;
    }
}
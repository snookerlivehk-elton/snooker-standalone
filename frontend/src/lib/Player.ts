export class Player {
    name: string;
    memberId: string;
    score: number;
    framesWon: number;
    fouls: number;
    misses: number;
    safeties: number;
    highBreaks: { score: number; time: number }[] = [];

    constructor(name: string, memberId: string) {
        this.name = name;
        this.memberId = memberId;
        this.score = 0;
        this.framesWon = 0;
        this.fouls = 0;
        this.misses = 0;
        this.safeties = 0;
    }

    public static fromJSON(json: any): Player {
        const player = new Player(json.name, json.memberId);
        player.score = json.score;
        player.framesWon = json.framesWon;
        player.fouls = json.fouls;
        player.misses = json.misses;
        player.safeties = json.safeties;
        player.highBreaks = json.highBreaks;
        return player;
    }

    public add_points(points: number): void {
        this.score += points;
    }

    public subtract_points(points: number): void {
        this.score -= points;
    }

    public add_frame(): void {
        this.framesWon++;
    }

    public reset_score(): void {
        this.score = 0;
    }

    public add_foul(): void {
        this.fouls++;
    }

    public add_miss(): void {
        this.misses++;
    }

    public add_safety(): void {
        this.safeties++;
    }

    public add_high_break(breakScore: number, breakTime: number): void {
        this.highBreaks.push({ score: breakScore, time: breakTime });
    }

    clone(): Player {
        const newPlayer = new Player(this.name, this.memberId);
        newPlayer.score = this.score;
        newPlayer.framesWon = this.framesWon;
        newPlayer.fouls = this.fouls;
        newPlayer.misses = this.misses;
        newPlayer.safeties = this.safeties;
        newPlayer.highBreaks = [...this.highBreaks];
        return newPlayer;
    }
}
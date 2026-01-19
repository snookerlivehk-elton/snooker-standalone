import 'dotenv/config';
export interface Room {
    id: string;
    name: string;
    code?: string | undefined;
    scores: [number, number];
    gameState?: any;
    operatorId?: string | undefined;
}
//# sourceMappingURL=index.d.ts.map
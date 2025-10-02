Master API Specification (Initial Proposal)

Base URL
- `/api`

Authentication
- Phase 1: none (internal use). Phase 2: token-based headers.

Endpoints
- POST `/api/matches`
  - Create a match record (settings + players).
  - Body:
    ```json
    {
      "roomId": "1",
      "match": { "name": "Snooker Live", "framesRequired": 5, "redBalls": 15 },
      "players": [
        { "name": "Alice", "memberId": "A1" },
        { "name": "Bob", "memberId": "B2" }
      ],
      "timestamps": { "start": 1710000000000 }
    }
    ```
  - Response: `{ "matchId": "uuid" }`

- POST `/api/matches/{matchId}/events`
  - Append events (batch accepted).
  - Body:
    ```json
    {
      "events": [
        {"type":"pot","playerIndex":0,"playerMemberId":"A1","ballName":"red","points":1,"timestamp":1710000001000,"shotTimeMs":8000},
        {"type":"switch","playerIndex":0,"playerMemberId":"A1","timestamp":1710000002000,"shotTimeMs":1000}
      ]
    }
    ```
  - Response: `{ "accepted": 2 }`

- POST `/api/matches/{matchId}/finalize`
  - Finalize and persist stats & foul totals.
  - Body (aligned with `StatsEngine.buildMatchRecord`):
    ```json
    {
      "foulTotals": [4, 8],
      "stats": {
        "eventsCount": 120,
        "perPlayer": [
          {"playerIndex":0,"totalShots":60,"potCount":30,"totalPoints":70,"potRate":0.5,"avgShotTimeMs":9000,"quickShotCount":12,"quickShotRate":0.2,"maxBreakPoints":32,"safeCount":8,"safeSuccessRate":0.25,"foulCount":2,"potByBall":{"red":15,"yellow":4,"green":3,"brown":2,"blue":3,"pink":2,"black":1},"shotTimeBuckets":[10,20,20,10]},
          {"playerIndex":1,"totalShots":60,"potCount":28,"totalPoints":68,"potRate":0.4667,"avgShotTimeMs":9500,"quickShotCount":10,"quickShotRate":0.1667,"maxBreakPoints":28,"safeCount":9,"safeSuccessRate":0.22,"foulCount":3,"potByBall":{"red":14,"yellow":3,"green":4,"brown":2,"blue":3,"pink":1,"black":1},"shotTimeBuckets":[8,22,18,12]}
        ]
      },
      "timestamps": {"end":1710003600000},
      "winnerMemberId": "A1"
    }
    ```
  - Response: `{ "finalized": true }`

- GET `/api/matches/{matchId}`
  - Returns match, players, foulTotals, stats, events (paginated if large).

- GET `/api/matches`
  - Query list: `memberId`, `from`, `to`, `page`, `pageSize`.

- GET `/api/members/{memberId}/stats`
  - Aggregated member stats across matches.

Notes
- Pagination for events recommended: `GET /api/matches/{id}/events?page=...`.
- Validation: enforce enums for `type` and `ballName`.
- Security: authorize write endpoints in production; audit via append-only logs.
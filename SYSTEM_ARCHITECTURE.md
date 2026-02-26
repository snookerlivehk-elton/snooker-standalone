# Snooker System Architecture Documentation

## 1. System Overview

This system is a **Snooker Match Management and Scoring Platform**. It provides real-time scoring, match statistics tracking, member management, and historical data analysis.

### Tech Stack
*   **Frontend**: React (Vite), TypeScript, Tailwind CSS.
*   **Backend**: Node.js, Express, Socket.io.
*   **Database**: PostgreSQL (via Prisma ORM).
*   **Deployment**: Railway (Backend + DB), GitHub Pages (Frontend).
*   **External Services**: Resend (Email Verification).

---

## 2. Directory Structure

```
snooker-standalone/
├── backend/                # Node.js Backend
│   ├── index.ts            # Main application entry point (API + Socket.io)
│   ├── prisma/             # Database schema and migrations
│   │   └── schema.prisma   # Data model definition
│   └── scripts/            # Utility scripts (e.g., db maintenance)
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # UI Components (PlayerCard, etc.)
│   │   ├── lib/            # Core Logic (Game State, Stats, API wrappers)
│   │   ├── Scoreboard.tsx  # Main Scoring Interface
│   │   ├── Setup.tsx       # Match Setup Interface
│   │   ├── MemberProfile.tsx # Member Stats & History
│   │   └── ...
└── ...
```

---

## 3. Database Schema (PostgreSQL / Prisma)

The database is designed to store member identities, match history, and detailed event logs.

### Key Tables
*   **`Member`**: Stores user info (Email, Name, Password Hash, Role, Member Code).
    *   *Note*: `email` is unique and case-insensitive (via application logic).
*   **`Room`**: Persistent storage for active match rooms (ID like `AAAAA0001`).
    *   Used to restore state if the server restarts.
    *   *Cleanup*: Logic exists to remove rooms older than 7 days.
*   **`Match`**: The central record for a match.
    *   Links to `Room` (optional) and `Member` (Winner, Operator).
    *   Stores meta-data: `frames_required`, `red_balls`, `started_at`, `ended_at`.
*   **`MatchPlayer`**: Performance data for a specific player in a specific match.
    *   Stores computed stats: `pot_rate`, `max_break`, `avg_shot_time`, etc.
*   **`MatchStats`**: Aggregate stats for the match (e.g., total events).
*   **`Event`**: Detailed log of every action (Pot, Miss, Foul) for replay and deep analysis.
*   **`EmailVerification`**: Temporary storage for 6-digit verification codes.

---

## 4. Backend Architecture (`backend/index.ts`)

The backend serves as both a REST API and a Real-time WebSocket server.

### Key Modules
1.  **Authentication**:
    *   **Login**: `/api/members/login` - Verifies email/password (SHA-256 + Salt). Handles case-sensitivity fallback.
    *   **Register**: `/api/members/register` - Creates new members.
    *   **Verification**: `/api/match-verification-code` - Sends emails via Resend.
2.  **Match Management**:
    *   **Start Match**: `/api/matches` or `/api/matches/partial` - Initializes a match record.
    *   **Append Events**: `/api/matches/:id/events` - Batched upload of scoring events.
    *   **Finalize**: `/api/matches/:id/finalize` - Called at match end to compute and save final `MatchStats`.
3.  **Real-time Sync (Socket.io)**:
    *   **Rooms**: Clients join rooms (e.g., `socket.join('AAAAA0001')`).
    *   **State Update**: Server broadcasts `gameState updated` events to keep viewers in sync.

### Important Functions
*   **`finalizeMatch` (API)**: Critical transaction that updates `Match`, `MatchStats`, `MatchPlayer`, and `FoulTotals` atomically.
*   **`resolveDistrictCode`**: Logic to generate HK district-based member codes (e.g., `N-YL-0001`).

---

## 5. Frontend Architecture

The frontend is a Single Page Application (SPA) driven by a robust state machine.

### Core Logic Libraries (`frontend/src/lib/`)
*   **`State.ts`**: **The Brain**. A class representing the immutable state of a Snooker frame (score, balls on table, current player).
    *   Methods: `pot(ball)`, `miss()`, `foul()`, `undo()`.
    *   *Immutability*: Each action returns a *new* `State` instance, enabling easy Undo/Redo.
*   **`StatsEngine.ts`**: **The Analyst**. Calculates statistics (Pot Success %, Break Building) by replaying the event stream.
    *   Used by `Scoreboard` to prepare data for upload.
*   **`RoomStorage.ts`**: **The Persistence Layer**.
    *   Wraps `localStorage` to save match state locally (prevents data loss on refresh).
    *   Manages the queue of events waiting to be uploaded to the backend.

### Key Views
1.  **`Setup.tsx`**:
    *   Handles Member Lookup (by Email).
    *   Sends/Verifies Email Codes.
    *   Configures Match Rules (Red balls, Handicap).
    *   *Logic*: Decides whether to create a "Ranked Match" (DB record) or "Guest Match".
2.  **`Scoreboard.tsx`**:
    *   The main interface.
    *   Captures user input -> Updates `State` -> Appends to `RoomStorage` -> Triggers Upload.
    *   Handles "End Frame" and "Match Over" logic (redirects to Live View).
3.  **`MemberProfile.tsx`**:
    *   Displays member stats and match history.
    *   Fetches data from `/api/members/:id` and `/api/members/:id/matches`.

---

## 6. Key Workflows & Logic

### A. Match Lifecycle
1.  **Initialization**: User enters emails in `Setup`. System verifies members.
2.  **Creation**: `startMatchV2` calls backend. Backend creates `Match` and returns `matchId`.
3.  **Scoring**:
    *   User clicks ball -> `State.pot(ball)`.
    *   Event stored in `localStorage`.
    *   `uploadSegment` runs periodically to sync events to Backend.
4.  **Completion**:
    *   Match ends -> Frontend calculates final stats using `StatsEngine`.
    *   Frontend calls `finalizeMatch` with full stats payload.
    *   Backend saves stats and marks match as finished.

### B. Verification Logic
*   To prevent unauthorized ranked matches, players must verify ownership of their Member Email via a 6-digit code sent to their inbox.
*   Codes expire in 10 minutes.

### C. Operator Mode
*   Special `ADMIN` or `Operator` users can manage rooms.
*   Operators have a dashboard to see active rooms and historical records.

---

## 7. Deployment Notes

*   **Environment Variables**:
    *   `DATABASE_URL`: PostgreSQL connection string.
    *   `RESEND_API_KEY`: For email services.
    *   `RESEND_FROM_EMAIL`: Verified sender address.
    *   `ADMIN_TOKEN`: For accessing admin endpoints.
*   **CI/CD**:
    *   Backend: GitHub Actions -> Railway.
    *   Frontend: GitHub Actions -> GitHub Pages.

---
*Generated by Trae AI for Developer Handover*

# Snooker System Architecture Documentation

## 1. System Overview

This system is a **Snooker club operations and member platform**. It provides member management, club dashboards, reservations, QR sessions, points, news, leaderboards, and historical match/break data analysis.

### Tech Stack
*   **Frontend**: React (Vite), TypeScript, Tailwind CSS.
*   **Backend**: Node.js, Express.
*   **Database**: PostgreSQL (via Prisma ORM).
*   **Deployment**: Railway (Backend + DB), GitHub Pages (Frontend).
*   **External Services**: Resend (Email Verification).

---

## 2. Directory Structure

```
snooker-standalone/
├── backend/                # Node.js Backend
│   ├── index.ts            # Main application entry point (REST API)
│   ├── prisma/             # Database schema and migrations
│   │   └── schema.prisma   # Data model definition
│   └── scripts/            # Utility scripts (e.g., db maintenance)
├── frontend/               # React Frontend
│   ├── src/
│   │   ├── components/     # Shared UI components
│   │   ├── lib/            # API wrappers, feature flags, shared helpers
│   │   ├── HomePage.tsx    # System portal entry
│   │   ├── VenueDashboard.tsx # Club management dashboard
│   │   ├── Me.tsx          # Member portal
│   │   └── ...
└── ...
```

---

## 3. Database Schema (PostgreSQL / Prisma)

The database is designed to store member identities, club operations data, match history, and leaderboard-related records.

### Key Tables
*   **`Member`**: Stores user info (Email, Name, Password Hash, Role, Member Code).
    *   *Note*: `email` is unique and case-insensitive (via application logic).
*   **`Match`**: The central record for a match.
    *   Links to `Member` (Winner, Operator).
    *   Stores meta-data: `frames_required`, `red_balls`, `started_at`, `ended_at`.
*   **`MatchPlayer`**: Performance data for a specific player in a specific match.
    *   Stores computed stats: `pot_rate`, `max_break`, `avg_shot_time`, etc.
*   **`BreakRecord`**: Stores high-break related records and club leaderboard data.
*   **`Club*` / `Table*` / `Reservation*` / `Points*`**: Support club profile, booking, QR session billing, and points operations.
*   **`EmailVerification`**: Temporary storage for 6-digit verification codes.

---

## 4. Backend Architecture (`backend/index.ts`)

The backend serves as a REST API with feature-gated modules for clubs and members.

### Key Modules
1.  **Authentication**:
    *   **Login**: `/api/members/login` - Verifies email/password (SHA-256 + Salt). Handles case-sensitivity fallback.
    *   **Register**: `/api/members/register` - Creates new members.
    *   **Verification**: Password reset and email verification flows use Resend.
2.  **Club Operations**:
    *   **Club Dashboard**: Club profile, member management, messaging, live announcements, and pricing/tables.
    *   **Reservations / QR Sessions**: Booking, table sessions, and billing workflows.
    *   **Points / Leaderboards**: Points ledger, balances, breaks, and rankings.
3.  **System Admin**:
    *   **Feature Flags**: Admin endpoints manage platform-wide feature availability.
    *   **Overview / Maintenance**: Health checks, admin overview, and controlled maintenance routes.

### Important Functions
*   **`resolveDistrictCode`**: Logic to generate HK district-based member codes (e.g., `N-YL-0001`).

---

## 5. Frontend Architecture

The frontend is a Single Page Application (SPA) organized around portals and club operations workflows.

### Core Logic Libraries (`frontend/src/lib/`)
*   **`api.ts`**: Main frontend API wrapper for member, admin, and club operations.
*   **`features.ts`**: Feature flag loader and cache for conditional UI and route access.
*   **`i18n.ts`**: Shared labels and localized text utilities.

### Key Views
1.  **`HomePage.tsx`**:
    *   System portal entry that aggregates venue, ranking, and news content.
2.  **`VenueDashboard.tsx`**:
    *   Main club management surface for profile, members, messages, reservations, tables, points, and tournaments.
3.  **`Me.tsx`**:
    *   Displays member profile, stats, and match history.
    *   Fetches data from `/api/members/:id` and `/api/members/:id/matches`.

---

## 6. Key Workflows & Logic

### A. Member & Club Lifecycle
1.  **Authentication**: Members or operators log in via `/members/login`.
2.  **Club Access**: Feature-gated routes expose club dashboard modules based on system and club-level permissions.
3.  **Operations**:
    *   Staff manage profile, members, content, announcements, pricing, tables, and reservations.
    *   Members view stats, match history, and personal information in the member portal.
4.  **Billing / QR**:
    *   QR session and reservation flows connect tables, pricing schemes, points, and settlement logic.

### B. Verification Logic
*   Password reset and email verification flows rely on 6-digit codes sent to the member inbox.
*   Codes expire in 10 minutes.

### C. Operator Mode
*   `ADMIN` or operator-capable members can manage their club via `VenueDashboard`.
*   Operators use the dashboard for club operations instead of legacy room-based match hosting.

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

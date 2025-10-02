Master Database Schema Proposal

Overview
- Normalize core entities for portability and analytics.
- Align payloads with `StatsEngine.buildMatchRecord`.
- Target: PostgreSQL (recommended) but compatible with most SQL engines.

Entities
- members
  - `id` UUID PK
  - `name` TEXT NOT NULL
  - `member_code` TEXT UNIQUE NULL
  - `created_at` TIMESTAMP DEFAULT now()

- matches
  - `id` UUID PK
  - `room_id` TEXT NOT NULL
  - `name` TEXT NOT NULL
  - `frames_required` INT NOT NULL
  - `red_balls` INT NOT NULL
  - `started_at` TIMESTAMP NULL
  - `ended_at` TIMESTAMP NULL
  - `winner_member_id` UUID NULL REFERENCES members(id)
  - `version` INT NOT NULL DEFAULT 1
  - Indexes: (`started_at`), (`winner_member_id`), (`room_id`)

- match_players
  - `id` UUID PK
  - `match_id` UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  - `member_id` UUID NOT NULL REFERENCES members(id)
  - `frames_won` INT NOT NULL DEFAULT 0
  - `total_points` INT NOT NULL DEFAULT 0
  - `pot_rate` NUMERIC(6,4) NOT NULL DEFAULT 0
  - `avg_shot_time_ms` INT NOT NULL DEFAULT 0
  - `max_break_points` INT NOT NULL DEFAULT 0
  - `foul_count` INT NOT NULL DEFAULT 0
  - `quick_shot_rate` NUMERIC(6,4) NOT NULL DEFAULT 0
  - `safe_success_rate` NUMERIC(6,4) NOT NULL DEFAULT 0
  - `pot_by_ball` JSONB NOT NULL DEFAULT '{}'  -- {red,yellow,green,brown,blue,pink,black}
  - `shot_time_buckets` JSONB NOT NULL DEFAULT '[]' -- [0-5s,5-10s,10-20s,>20s]
  - Indexes: (`match_id`,`member_id`), (`member_id`)

- events
  - `id` BIGSERIAL PK
  - `match_id` UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE
  - `idx` INT NOT NULL  -- sequential order within match
  - `type` TEXT NOT NULL CHECK (type IN ('pot','foul','miss','safe','switch','newFrame','concede','freeBallToggle'))
  - `player_index` INT NOT NULL CHECK (player_index IN (0,1))
  - `player_member_id` TEXT NOT NULL
  - `ball_name` TEXT NULL CHECK (ball_name IN ('red','yellow','green','brown','blue','pink','black'))
  - `points` INT NULL
  - `timestamp` BIGINT NULL
  - `shot_time_ms` INT NULL
  - Indexes: (`match_id`,`idx`), (`match_id`,`timestamp`)

- foul_totals
  - `match_id` UUID PK REFERENCES matches(id) ON DELETE CASCADE
  - `player0_total` INT NOT NULL DEFAULT 0
  - `player1_total` INT NOT NULL DEFAULT 0

- match_stats
  - `match_id` UUID PK REFERENCES matches(id) ON DELETE CASCADE
  - `events_count` INT NOT NULL DEFAULT 0
  - `per_player` JSONB NOT NULL  -- array of two PlayerStats

Retention & Partitioning
- Consider time-based partition on `events` by `match_id` or date.
- Use `JSONB` with generated columns for frequent filters if needed.

Migrations
- Recommend Prisma or Knex; maintain migrations under `backend/migrations/`.
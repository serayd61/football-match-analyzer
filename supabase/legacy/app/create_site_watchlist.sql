-- ============================================================================
-- SITE_WATCHLIST — clubs a signed-in user follows on the new dashboard
-- (/{locale}/dashboard → "Following"). Run once in the Supabase SQL editor.
-- Written by src/app/api/site/watchlist/route.ts (service role);
-- read by src/lib/site/dashboard.ts.
-- ============================================================================

CREATE TABLE IF NOT EXISTS site_watchlist (
  id           BIGSERIAL PRIMARY KEY,
  user_email   TEXT        NOT NULL,
  team_id      INTEGER     NOT NULL,          -- feed (FotMob) team id
  team_name    TEXT        NOT NULL,
  league_slug  TEXT,                          -- SITE_LEAGUES slug, nullable
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT site_watchlist_user_team UNIQUE (user_email, team_id)
);

CREATE INDEX IF NOT EXISTS site_watchlist_user_idx ON site_watchlist (user_email, created_at);

-- Service role only; no anon/authenticated access (the API checks the session).
ALTER TABLE site_watchlist ENABLE ROW LEVEL SECURITY;

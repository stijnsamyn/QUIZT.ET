-- Generieke scoretabel voor Snake en Pong.
-- Tetris houdt zijn eigen tetris_scores-tabel (bestaande data blijft intact).
CREATE TABLE IF NOT EXISTS game_scores (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  game text NOT NULL,
  score int NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "game_scores_select_all" ON game_scores;
CREATE POLICY "game_scores_select_all" ON game_scores
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "game_scores_insert_own" ON game_scores;
CREATE POLICY "game_scores_insert_own" ON game_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS game_scores_game_score_idx
  ON game_scores (game, score DESC, created_at DESC);

-- Expliciete grants: Supabase geeft nieuwe tabellen in public sinds 30-10-2026
-- geen automatische Data API-toegang meer (ook niet bij db reset of branches).
GRANT SELECT ON game_scores TO anon;
GRANT SELECT, INSERT ON game_scores TO authenticated;
GRANT ALL ON game_scores TO service_role;
GRANT USAGE, SELECT ON SEQUENCE game_scores_id_seq TO authenticated, service_role;

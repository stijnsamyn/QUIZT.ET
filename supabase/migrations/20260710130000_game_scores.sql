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

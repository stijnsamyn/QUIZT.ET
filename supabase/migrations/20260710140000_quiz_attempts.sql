-- Historische pogingen: score wordt bevroren op moment van indienen.
-- Zelfs als de juiste antwoorden van een vraag later wijzigen, blijft
-- de score in deze tabel wat je toen hebt gehaald.
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  quiz_id uuid NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  source text DEFAULT 'manual',            -- 'manual' | 'pdf' | 'exam'
  title text,                              -- vrije label ("Officieel examen 10-07")
  answers jsonb NOT NULL DEFAULT '{}',     -- { question_id: [chosen_indexes] }
  correct_snapshot jsonb NOT NULL DEFAULT '{}', -- { question_id: [correct_indexes] } op moment van indienen
  score int NOT NULL DEFAULT 0,            -- aantal juist beantwoord
  wrong int NOT NULL DEFAULT 0,
  total_answered int NOT NULL DEFAULT 0,
  total_questions int NOT NULL DEFAULT 0   -- totaal aantal vragen in de quiz
);

ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quiz_attempts_select_own" ON quiz_attempts;
CREATE POLICY "quiz_attempts_select_own" ON quiz_attempts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_attempts_insert_own" ON quiz_attempts;
CREATE POLICY "quiz_attempts_insert_own" ON quiz_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "quiz_attempts_delete_own" ON quiz_attempts;
CREATE POLICY "quiz_attempts_delete_own" ON quiz_attempts
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS quiz_attempts_user_quiz_idx
  ON quiz_attempts (user_id, quiz_id, submitted_at DESC);

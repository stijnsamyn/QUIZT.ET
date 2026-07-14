-- Registratie van beoordeelde dubbels: als een beheerder beslist twee
-- gelijkaardige vragen te BEHOUDEN, wordt het paar hier gemarkeerd als
-- "bekeken", zodat andere beheerders zien dat iemand er al naar keek.
-- Verwijderen van een van beide vragen blijft altijd mogelijk (cascade ruimt
-- de review dan op).
CREATE TABLE IF NOT EXISTS duplicate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES quizzes(id) ON DELETE CASCADE,
  q_low  uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  q_high uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz DEFAULT now(),
  note text,
  UNIQUE (q_low, q_high)
);

ALTER TABLE duplicate_reviews ENABLE ROW LEVEL SECURITY;

-- Iedereen die ingelogd is mag de reviews lezen (om "al bekeken" te tonen).
CREATE POLICY "duprev_select" ON duplicate_reviews
  FOR SELECT TO authenticated USING (true);

-- Enkel beheerders/admins mogen markeren of de markering weghalen.
CREATE POLICY "duprev_insert" ON duplicate_reviews
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('beheerder','admin')));
CREATE POLICY "duprev_update" ON duplicate_reviews
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('beheerder','admin')));
CREATE POLICY "duprev_delete" ON duplicate_reviews
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('beheerder','admin')));

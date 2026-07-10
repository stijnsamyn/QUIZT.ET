-- Missing UPDATE policy: without this, updates on quiz_attempts return
-- success but affect 0 rows (RLS silent block), which caused "own answers
-- not saved" from the attempt detail view.
DROP POLICY IF EXISTS "quiz_attempts_update_own" ON quiz_attempts;
CREATE POLICY "quiz_attempts_update_own" ON quiz_attempts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

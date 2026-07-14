-- Verwijdering van een quiz vereist voortaan goedkeuring door een admin.
-- Een beheerder vraagt de verwijdering aan (delete_requested_by/at worden gezet);
-- een admin keurt goed (verwijdert de quiz echt) of weigert (velden weer leeg).
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS delete_requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delete_requested_at timestamptz;

-- OPTIONELE HARDENING (aanbevolen): laat de database enkel admins een quiz
-- verwijderen, zodat de regel ook geldt buiten de app om. Pas 'profiles'/'role'
-- aan indien jouw rollen elders staan. Ontkoppel de bestaande delete-policy eerst.
--
-- DROP POLICY IF EXISTS "quizzes_delete" ON quizzes;
-- CREATE POLICY "quizzes_delete_admin_only" ON quizzes
--   FOR DELETE TO authenticated
--   USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

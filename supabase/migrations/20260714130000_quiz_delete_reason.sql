-- Reden bij een verwijder-aanvraag: de beheerder typt waarom de quiz weg mag;
-- de admin ziet die reden bij het beoordelen.
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS delete_request_reason text;

-- Matrix- en open vragen naast de bestaande meerkeuze
--
-- Filosofie:
--   • Bestaande vragen blijven type "mcq" (default) — geen migratie van data nodig.
--   • Matrix: rijen × kolommen met per rij één juist antwoord.
--       matrix_rows        text[]  — rij-labels
--       matrix_cols        text[]  — kolom-labels
--       matrix_correct     int[]   — per rij de index van de juiste kolom (-1 = geen juist / n.v.t.)
--     De keuze van de speler wordt opgeslagen in answers.chosen_indexes: één int per rij
--     (index van de gekozen kolom, of -1 als niet ingevuld).
--   • Open: vrije tekst-input met optioneel modelantwoord.
--       open_answer        text    — modelantwoord (referentie, niet geheim)
--     Het antwoord van de speler komt in answers.open_answer_text.
--     Open vragen worden niet automatisch juist/fout gescoord (blijft "in overleg")
--     tenzij de tekst exact overeenkomt met het modelantwoord — dan juist.

alter table public.questions
  add column if not exists question_type text not null default 'mcq'
    check (question_type in ('mcq','matrix','open')),
  add column if not exists matrix_rows    text[],
  add column if not exists matrix_cols    text[],
  add column if not exists matrix_correct int[],
  add column if not exists open_answer    text;

alter table public.answers
  add column if not exists open_answer_text text;

-- Kleine helper-index voor snelle filtering per type (bv. beheer-overzichten)
create index if not exists idx_questions_type on public.questions(question_type);

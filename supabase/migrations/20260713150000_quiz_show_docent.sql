-- Per-quiz toggle voor docent-antwoorden.
-- Default = false: alleen quizzen waar de docent regelmatig afwijkt van het
-- wettelijke antwoord, zet dit expliciet aan via de beheer-UI. Als deze vlag
-- uit staat verbergen we in de UI de D-kolom, de docent-toelichting, de
-- "👨‍🏫 Docent koos…"-reactie-chip en het docent-blok na antwoord.
alter table public.quizzes
  add column if not exists show_docent boolean not null default false;

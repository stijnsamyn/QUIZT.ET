# Quiztet

Algemene afspraken voor alle projecten: `../CLAUDE.md`.

## Projecten-hub (altijd aan denken)

Dit project staat op de projecten-hub (`../Hub`, http://127.0.0.1:8600 en de menubalk-app),
via `project.json` in deze map. Verandert er iets aan hoe het project draait of heet, werk dan
**in dezelfde wijziging** `project.json` mee bij:

- naam of beschrijving (één regel, klopt met de huidige stand);
- `type`, `start`, `poort`, `pad`, `autostart` (lokaal starten);
- `online`: het https-adres van de live versie (bv. na een verhuis naar de Pi);
- `ticker`, `dagelijks` als die er zijn.

Een nieuwe of vrijgekomen poort ook in de poortentabel van `../CLAUDE.md`. Alle velden:
`../Hub/README.md`. Controle: ververs de hubpagina en kijk of de kaart klopt.

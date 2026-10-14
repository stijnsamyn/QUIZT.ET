# Lokaal draaien

Deze app is statisch, maar hoort niet rechtstreeks vanaf schijf geopend te worden.
Via `file://` is de herkomst van de pagina `null`; Supabase weigert dan de
aanmelding, en `localStorage` wordt gedeeld met elke andere lokale pagina.

Draai hem daarom achter een servertje:

```bash
python3 -m http.server 8020 --bind 127.0.0.1
```

Daarna staat de app op <http://127.0.0.1:8020/>.

## Via de projecten-hub

Op de machine van de maker gebeurt dat vanuit de menubalk-app `Projecten`, die dit
project start, opvolgt en het verschil met GitHub toont. De startopdracht staat in
`project.json`. Achtergrond en ontwerpkeuzes: `../Hub/info.md`.

## Let op bij testen

De lokale versie en de live versie op GitHub Pages praten met **dezelfde**
Supabase-database. Wat je lokaal aanmaakt of weggooit, verandert de echte gegevens.

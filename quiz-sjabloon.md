<!--
============================================================
  QUIZ-SJABLOON  —  lees dit eerst
============================================================

Met dit bestand maak je een volledige quiz aan die je nadien op het platform
importeert (Beheer → Quiz importeren). De quiz komt binnen als CONCEPT, zodat je
alles nog kan nakijken voor je publiceert.

TWEE MANIEREN OM IN TE VULLEN
  1) Zelf typen volgens het formaat hieronder.
  2) Door een AI laten invullen: plak DIT VOLLEDIGE BESTAND samen met je
     cursus/lesmateriaal in een AI-chat en geef de opdracht:
     "Vul dit quiz-sjabloon in op basis van bijgevoegde tekst. Houd je exact aan
      het formaat en de regels in de commentaar bovenaan. Verzin niets: baseer
      elk juist antwoord, de wettelijke basis en de uitleg op de tekst. Zet bij
      elke vraag **Bron:** AI."

HERKOMST (mens of AI) — BELANGRIJK
  Op het platform is bij elk juist antwoord en elke uitleg zichtbaar of het door
  een MENS (👤) of door AI (🤖) is bepaald. Geef dat hier aan met:
     **Bron:** AI      (antwoord én uitleg door AI bepaald)
     **Bron:** mens    (door een mens bepaald — dit is de standaard als je niets zet)
  Laat je de AI dit bestand invullen, laat ze dan overal "**Bron:** AI" zetten.
  Bij het importeren kan je bovendien in één keer aanvinken dat de hele import
  AI-gegenereerd is.

FORMAATREGELS (de importer leest hierop)
  • Bovenaan: "# Titel: ..." en "Beschrijving: ..." (één quiz per bestand).
  • Elke vraag begint met "## Vraag" (nummering mag, is niet verplicht).
  • Daaronder de vraagtekst (één of meerdere regels).
  • Dan de antwoordopties, elk op een eigen regel beginnend met "- [ ]".
    Zet bij ELK juridisch juist antwoord een x tussen de haakjes: "- [x]".
    Optioneel volgt een tweede paar haakjes voor het DOCENT-antwoord:
       "- [x] [ ] tekst"   — juridisch juist, docent volgt niet dit antwoord
       "- [ ] [d] tekst"   — docent koos dit, maar het is niet juridisch juist
       "- [x] [d] tekst"   — beide vinden dit juist
       "- [ ] [ ] tekst"   — niet juist en niet door docent gekozen
    Enkel invullen als de docent expliciet iets anders koos dan de wet. Vragen waarbij
    J en D niet overeenstemmen komen binnen als NIET-GEVALIDEERD — je moet ze pas
    bewust valideren via het vinkje in de vraag-editor.
    Gewone vraag = precies één optie met [x]. Meerkeuzevraag = meerdere opties
    met [x] (dan wordt de vraag automatisch als meerkeuze behandeld). Min. 2 opties.
  • "**Wettelijke basis:**" — de wetsartikelen/grondslag (optioneel, aangeraden).
  • "**Wettekst:**" — de volledige wettekst van de artikels (optioneel; wordt uitklapbaar
    bij de vraag getoond).
  • "**Uitleg:**" — waarom dit antwoord juist is (optioneel, aangeraden).
    LET OP: de app schudt de antwoordopties per speler. Verwijs in je uitleg dus
    NOOIT direct naar "antwoord A" of "optie B" (die letter varieert per speler).
    Gebruik in de plaats {A} {B} {C} … — die worden op runtime vertaald naar de
    letter die de speler écht ziet.
    Bv.  "Antwoord {A} is juist omdat art. 34 Sv. bepaalt dat…"
  • "**Docent:**" of "**Docent-toelichting:**" — korte uitleg waarom de docent afwijkt
    van het juridische antwoord (optioneel; enkel zinvol als er ook een [d]-optie is).
    Ook hier mag je {A} {B} … gebruiken.
  • "**Bron:**" — mens of AI (optioneel; standaard mens).
  • "**Gevalideerd:**" — ja of nee (optioneel; standaard ja). Zet "nee" als er nog
    geen zeker juist antwoord is: de vraag krijgt dan de tag "Niet gevalideerd" en de
    gebruikers bepalen het beste antwoord via opmerkingen en flags. Laat je álle [ ]
    onaangevinkt, dan wordt de vraag sowieso als niet-gevalideerd ingeladen. Ook als
    J en D verschillen wordt de vraag standaard niet-gevalideerd bewaard.
  • Scheid vragen met een lege regel. Laat de labels exact zoals hier geschreven.

Verwijder de twee VOORBEELDVRAGEN voor je uploadt (of laat de AI ze vervangen).
Alles tussen deze <!-- --> haakjes is commentaar en wordt genegeerd.
============================================================
-->

# Titel: Naam van je quiz hier
Beschrijving: Korte omschrijving van waar deze quiz over gaat.


## Vraag 1
Welke huiszoeking dient te gebeuren tussen 5 uur 's morgens en 21 uur 's avonds?

- [ ] Huiszoeking met toestemming.
- [ ] Huiszoeking op basis van heterdaadsituatie.
- [x] Huiszoeking op basis van mandaat (bevel tot huiszoeking).
- [ ] Huiszoeking op basis van hulpgeroep.

**Wettelijke basis:** Art. 1 Wet 7 juni 1969; Art. 87-90 Sv.
**Uitleg:** Antwoord {C} is juist: de huiszoeking op basis van een onderzoeksrechterlijk
mandaat is gebonden aan het wettelijke tijdsvenster (5u–21u). De andere types zijn daar
niet aan onderworpen.
**Bron:** mens


## Vraag 2
Binnen welke termijn kan je verzet aantekenen na de betekening van het vonnis?

- [ ] Tien dagen.
- [x] Vijftien dagen.
- [ ] Twintig dagen.
- [ ] Eén maand.

**Wettelijke basis:** Art. 187 Sv.
**Uitleg:** Antwoord {B} klopt: verzet tegen een verstekvonnis moet binnen de vijftien
dagen na de betekening.
**Bron:** mens


## Vraag 3 (voorbeeld met docent-verschil)
Wat is de maximale duur van een gerechtelijke arrestatie (art. 1 WVH)?

- [ ] [ ] 24 uur.
- [x] [d] 48 uur.
- [ ] [ ] 72 uur.

**Wettelijke basis:** Art. 1 WVH.
**Uitleg:** Juridisch is dat antwoord {B} — 48 uur — sinds de grondwetswijziging van 2017.
**Docent:** Onze docent bevestigt {B} als juist, in overeenstemming met de wet.
**Bron:** mens


<!--
============================================================
  Vanaf hier je eigen vragen. Kopieer het blok hieronder zo
  vaak als nodig.
============================================================

## Vraag 3
Typ hier de vraagtekst.

- [ ] Eerste antwoordoptie.
- [ ] Tweede antwoordoptie.
- [ ] Derde antwoordoptie.
- [ ] Vierde antwoordoptie.

**Wettelijke basis:** ...
**Uitleg:** ...
**Bron:** AI

-->

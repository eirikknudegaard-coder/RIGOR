# Terrasse: beregnet spenn og 2D-plan

Tidligere krevde skjemaet maksimale, ferdig kontrollerte spenn som innspill.
Brukeren spurte hvor langt det kunne spennes. Skjemaet beregner nå største
bjelkespenn og lager en støtteplan fra dimensjoner, oppbygning og lastgrunnlag.

Egenlasten inkluderer bord, alle bjelker og alle dragerplanker én gang.
EN 1990-kombinasjoner og EN 1995-1-1-kontroller brukes for rektangulært
C24/GL30c. Bjelkesøket omfatter bøyning, skjær, kontakttrykk og momentan/
sluttnedbøyning med skjærdeformasjon og kryp. Konsentrert nyttelast er et
alternativ til fordelt nyttelast. Oppgitt snølast inngår med egne ψ-faktorer.

Dragerfeltene kontrolleres med faktiske punktreaksjoner fra hvert bjelkeopplegg.
Punktene i samme variable last får samme kombinasjonsfaktor. Fysisk reaksjon ved
en stolpe inkluderer begge tilstøtende dragerfelt. Dobbel drager gir ikke et
massivt dobbelt tverrsnitt; lik deling brukes bare ved eksplisitt bekreftet
lastdeling. Ellers kontrolleres hver planke for hele lasten. Største dragerspenn
i resultatet gjelder den lengste beståtte planen med like støtteavstander på
den oppgitte terrassen, ikke en generell spennvidde for andre lastbredder.

2D-verktøyet viser rektangulær plan med bjelker, dragerlinjer og støttepunkter.
Linjer kan flyttes ved dragging eller tilgjengelig linjevalg/koordinatfelt,
legges til eller fjernes. Endring invaliderer resultat og beregningsnedlasting.
Røde felt viser overskredet bjelke-/dragerkontroll. SVG-skisse og JSON med
beregningsgrunnlag kan lastes ned. Kantene er faste, og utkraging/polygoner
er ikke modellert.

## Standardgrunnlag

Det er fortsatt ikke et lisensiert, automatisk verifisert norsk NA-oppsett.
Forhåndsvalg for boligterrasse er øvre EN 1991-1-1:2002 tabell 6.2-verdier
for kategori A balkong: qk 4 kN/m² og Qk 3 kN. Tabellen er lest visuelt i
original-PDF. Moelvens veiledning bekrefter bruk av qk 4 med bestemte klima- og
andre forutsetninger; disse kopieres ikke til en generell terrassegodkjenning.
Bergene Holms tabell har dimensjonerende snølast 4,5 som forutsetning; tallet
brukes ikke som karakteristisk snølast. Daterte kilder, dokumenthash og omfang
er registrert i `tests/fixtures/evidence/terrace-design-sources-2026-10-09.json`.

Ukjent snølast, ubekreftet standardgrunnlag, opplegg og avstivning gir foreløpig
status. Manglende kontroller av stolper, forbindelser, fundament, rekkverk og
global stabilitet oppgis særskilt. Beregnede bjelkefelt er ikke godkjenning av
hele terrassen. L/300 er en redigerbar prosjektgrense.

## Kontroll

- 237 Node-prøver passerer. Syv nye prøver kontrollerer uavhengige lukkede
  bjelkeformler, maksimalspennets grense, felles faktorisering av punktlastgruppe,
  lastlikevekt, lastdeling og fysisk sum av reaksjonene ved en felles stolpe.
- PC og 390 × 844 mobil kontrollerer faktisk dragging, tilgjengelig 2D-redigering,
  avvisning av uavklarte/overskredne planer, invalidert resultat, SVG/JSON og
  snølastens påvirkning. Ingen AI-kall er brukt til beregning eller test.
- Et numerisk eksempel med 5 × 4 m, C24 48 × 198, maksimalt c/c 600, klimaklasse
  3 og angitte EN-/materialforutsetninger gir 2,745 m bjelkespenn, styrt av
  sluttnedbøyning. Dette er et benchmarkresultat, ikke et generelt tillatt spenn.
  Ukjent snølast og ubekreftet NA gjør eksemplet foreløpig.
- Tidligere manuell bjelke-/søylekontroll og konstruksjonsdialog passerer,
  inkludert overføring av terrassegeometri fra den opprinnelige AI-spørsmålsflyten.

```sh
node --test --test-isolation=none tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python tests/construction-terrace-browser.py
PYTHONDONTWRITEBYTECODE=1 python tests/construction-manual-browser.py
PYTHONDONTWRITEBYTECODE=1 python tests/construction-browser.py
```

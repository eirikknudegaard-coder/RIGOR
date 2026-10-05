# RIGOR website

Nettside for **RIGOR – Rådgivende ingeniører**.

## Innhold

- Responsiv én-sides nettside
- RIGOR-profil med kullgrått, varm bronse og lys bakgrunn
- Fagområder: Tegning/BIM, byggesaksunderlag, konstruksjon, tilstand/skade og materialer/betong
- Mobilmeny og diskrete scroll-animasjoner
- Klar for GitHub Pages

## Lokal forhåndsvisning

```bash
python -m http.server 8080
```

Åpne deretter `http://localhost:8080`.

## Før publisering

Bytt kontaktinformasjon og organisasjonsnummer i `index.html` når dette er klart.

## GitHub Pages

1. Gå til **Settings → Pages**.
2. Velg **GitHub Actions** som kilde.
3. Push til `main` utløser publisering.

## Kalkyleverksted (prototype)

Åpne `kalkyle.html` via den lokale HTTP-serveren. Enkel veiviser og detaljert
postredigering deler samme beregningsmotor. Jobbmaler finnes for tak,
utvendig etterisolering og et grovt tilbyggsbudsjett. Arbeidstider og jobbmaler er
illustrerende eksempler og må kvalitetssikres før bruk i tilbud. Materialprisene
velges fra importert prisliste eller publisert prisregister. Demonstrasjon med
eksempelpriser må velges eksplisitt. Takgeometrien forutsetter lik takvinkel; stillas, avfall og
tekniske fag bruker forenklede avsetninger. Valgte poster er ikke en garanti
for komplett omfang. Beregninger beholder desimalpresisjon frem til visning.

Kalkyler lagres lokalt i nettleseren og kan eksporteres til CSV. Ingen AI,
skylagring eller kundedata er koblet til. Siden er en offentlig statisk
prototype, ikke et tilgangsbeskyttet portalverktøy. Portalens verktøyliste
viser prototypen for administrator dersom `kalkyle` ikke er registrert. En
eksplisitt deaktivert registrering respekteres. Andre brukere får lenken når
et aktivert verktøy med `tool_key = kalkyle` finnes og de har verktøytilgang.
Denne endringen oppretter ingen
Supabase-rader eller tilganger. Beskyttelse av fremtidige kundedata og
AI-nøkler må håndheves i en autentisert backend, ikke i GitHub Pages.

Kjør beregningstestene med `node --test tests/kalkyle-engine.test.mjs`.


### Prisgrunnlag og CSV-import

Velg **Importer prisliste**, last ned CSV-malen og fyll inn priser for jobbens
prisnøkler. Format: `prisnokkel;enhet;pris;kilde;dato;valuta;mva`.
Enhet må være `m2`, `m`, `stk` eller `rs`, valuta `NOK`, MVA `ekskl` og dato `ÅÅÅÅ-MM-DD`.
Desimalkomma og sitert CSV støttes. Import er lokal i nettleseren; Excel må
først eksporteres til CSV. Importen avvises samlet ved ugyldige rader og beholder
gjeldende prisgrunnlag. Duplikate prisnøkler avvises.

Biblioteket har kategorier, bygningselementer og oppgaver. Arbeidsmengde og
materiellmengde er separate; for eksempel kan 100 m² tak gi 167 løpemeter
sløyfer etter en foreløpig forbruksoppskrift. Prisen må ha samme enhet som
oppgavens materialenhet. Feil enhet gir ingen totalpris. Forbrukstall og
grunnarbeidstider er antakelser som må kontrolleres mot faktisk oppbygging.
Rigg, avfall og tekniske fag er fortsatt avsetninger med eget prisgrunnlag.
Ingen butikkpriser eller produktmatching er automatisk hentet inn.

**Bruk markedspriser** henter `assets/market-prices.json` med `cache: no-store`.
Ingen ekte kilde er foreløpig tilkoblet: valget viser dette og gir ingen totalpris.
Fremtidig leverandørintegrasjon må publisere `{ "prices": [...] }`, der hver
rad har samme felt som CSV-formatet (numerisk `pris`). Ikke legg leverandørens
innloggingsdata eller API-nøkler i GitHub Pages. Avtalepriser bør hentes via en
autentisert backend og ikke publiseres i det offentlige prisregisteret.

Kilde og dato vises per post og følger med CSV-eksport og lokal lagring.
Priser eldre enn 30 dager eller med fremtidig dato brukes ikke. Dersom en valgt
post mangler pris, vises arbeidstimer, men ingen samlet kostnad eller salgspris;
CSV-eksport av kalkylen venter på komplette priser. Manuelle priser merkes som
manuelle og overstyrer katalogen til brukeren velger nytt prisgrunnlag.

Kjør også `node tests/kalkyle-prices.test.mjs` for import- og datokontroller.

### Importassistent

CSV-kolonner kan kobles med forhåndsvisning og eksplisitt bekreftelse før
hele prislisten importeres. Faste regler brukes først; en valgfri AI-knapp
sender høyst åtte rader til en autentisert Supabase Edge Function.
Backend må aktiveres separat: se [AI-IMPORT.md](supabase/AI-IMPORT.md).
Nøkler lagres bare i Supabase, aldri i GitHub Pages. PDF/OCR og automatisk
produkt-til-kalkylekobling er ikke implementert.

Tester: `node tests/kalkyle-import.test.mjs` og
`node tests/import-map-backend.test.mjs` (Node 24).


### Taktyper og bygningselementbibliotek

Velg flatt tak, pulttak, saltak, valmtak eller mansardtak. Flatt tak foreslår
membran og fast underlag med fall på 0–5 grader. For pult-/saltak og valmtak
med lik vinkel er areal = projisert areal / cos(vinkel). Mansard bruker øvre
og nedre vinkel og øvre delens andel av projisert areal. Målt takflate kan
alltid oppgis direkte. For mansard med målt areal brukes den høyeste vinkelen
som tidsforutsetning, siden fordelingen mellom flatene er ukjent.

Møne, valmer, knekkbeslag, kantbeslag og sluk kan inkluderes med egne lengder
eller antall. Disse utledes ikke fra takarealet. Valgte detaljer med ukjent
mengde blokkerer totalpris. Takform er ikke i seg selv en kvalitetssikret
prisfaktor; komplisert geometri må vurderes i oppgaver og tidsgrunnlag.

Detaljert kalkyle grupperer oppgaver etter bygningselement og kategori med
subtotaler. Endring av elementmengden oppdaterer oppgavenes arbeidsmengde og
materiellmengde ut fra forbruksoppskriften. Oppgavene kan også redigeres
individuelt. Biblioteket har søk, fagfilter og Nybygg/Rehab, og lar brukeren
velge enkeltoppgaver før de legges inn. RIGOR-malene er egne antakelser, ikke
en kopi av Svenns kommersielle pris-/tidsbibliotek.

«Lagre kalkylen i mitt bibliotek» lagrer inkluderte oppgaver, arbeidstider og
forbruksoppskrifter som navngitte elementmaler i denne nettleseren. Prisene
følger ikke malen: de kommer fra valgt prisgrunnlag ved gjenbruk. Manuelle
priser må registreres igjen. Egne bibliotek er lokale og ikke delt med andre
brukere. Eksisterende lagrede kalkyler beholdes; nye detaljer lagres med dem.

AI-knappen er deaktivert mens aktivering er utsatt. CSV-import og bibliotek
krever ingen AI-kall. Kjør `node tests/kalkyle-library.test.mjs` for takgeometri,
oppgavemengder, enhetskontroll og bibliotekfiltre.


Biblioteket er utvidet til 160 elementer og 347 oppgaver. Hvert standardelement
har beskrivelser av inkludert arbeid, mengdegrunnlag og avgrensninger. Søk
omfatter også disse beskrivelsene. Nye material- og utførelsesalternativer
har ingen oppdiktede priser eller tidsnormer: materialpris må importeres eller
registreres, og grunntid må angis eksplisitt etter at oppgaven er lagt til.
Totalsum og CSV-eksport venter på nødvendig pris og tid. Eksplisitt registrert
null timer tillates for rent innkjøp eller eksterne leveranser.

Nettleserregresjon: med Python Playwright og Chromium installert, start
`python -m http.server 8080 --bind 127.0.0.1` fra repository-roten og kjør
`python tests/kalkyle-browser.py`. Testen bruker bare lokale demonstrasjonsdata
og sjekker blant annet at flere feltendringer på samme oppgave beholdes.

Biblioteket viser sammenleggbare kategorier med elementer og avkryssbare
oppgaver. Søk åpner relevante kategorier. Rehabvariantene dekker blant annet
yttervegger, vinduer/dører, takriving, terrasser, innervegger, gulv, himling,
listverk og kjøkken. Innholdet er egne RIGOR-maler; Svenns priser og tidsnormer
er ikke kopiert.

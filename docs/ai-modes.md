# Forenklet AI og Detaljert Copilot

Arbeidet er gjort på `feat/ai-estimator-copilot`, med `d7e16cf` som utgangspunkt.
Hovedstruktur, fire kalkylefaner, prosjektoversikt og eksisterende funksjoner er
beholdt. Integrasjonen i `kalkyle.js` er begrenset til AI-start, mengder fra
forslaget, materialspesifikasjoner og lagring av vanlig prosjektmetadata.

## Flyt og beregning

- `simple_estimator`: beskrivelse → ett prioritert spørsmål om gangen → første
  budsjett. Maks tre avklaringer før første resultat. Et foreløpig resultat kan
  også hentes uten å svare. Oppgitte mål og materialvalg spørres ikke om igjen.
- `detailed_copilot`: beskrivelse → nødvendig mengde/bibliotekvalg → eksisterende
  preview og godkjenning. Bibliotek-ID-er valideres på server og klient. Den
  eksisterende kontrollen av dobbeltposter og bevaring av manuelle endringer brukes.
- CRITICAL spørres først; IMPORTANT brukes ved nødvendig bibliotekvalg i
  Detaljert. OPTIONAL vises som presiseringer og tillegg som ikke stopper budsjettet.
- AI velger oppgaver og forklarer. Den returnerer ikke beregnede priser eller
  grunntider. Den eksisterende `calculate`-motoren beregner lønn, påslag og MVA.
- Ukjente priser, mengder og grunntider gir kjent delsum, ikke en oppdiktet total.
  Eksempelpriser brukes ikke i AI-budsjett som markedsgrunnlag.
- Eksisterende manuelle mengder, priser, tider og bortvalgte oppgaver brukes videre.
  AI-budsjettet beskriver sitt eget synlige arbeidsomfang; det erstatter ingen poster.

## Erfaringstall

Ingen erfaringstall er forhåndsutfylt. Registreringen ligger under AI-budsjettet
og lagres med prosjektet, i eksisterende kontoavgrenset lokal lagring.

Støttede grunnlag: komplett salgspris per arbeidsenhet ekskl. MVA og inkl. påslag,
samlet materialkost per arbeidsenhet før påslag, timer per arbeidsenhet og en fast
kostnadsavsetning. Timepris og påslag kommer fortsatt fra prosjektets eksisterende
satser. Komplett salgspris får ikke påslag to ganger. Et dokumentert min/max-
intervall brukes direkte; systemet finner ikke på et prosentvis prisintervall.

Hver post har permanent id, element-/oppgavekobling, type, enhet, min/max, kilde,
kildekategori, dato, region, sikkerhet, spesifikasjon og avgrensning. Kategorier
for historiske jobber, gjennomførte prosjekter, offentlige kilder og markedsdata
er tilgjengelige. Tallene registreres med referanse; kalkulerte prosjektpriser
blir ikke automatisk presentert som gjennomførte jobber eller historiske normer.

Tre manglende terrassepakker er lagt til: nye terrassebord, nytt bjelkelag og nytt
rekkverk. De har ingen oppdiktede grunntider eller materialpriser. Kodene
`RG-E-0161`–`RG-E-0163` er reservert i den nye datamodulen; eksisterende koder er
ikke renummerert. Ved senere utvidelse av koderegisteret må disse reservasjonene
beholdes. Kodekonflikter stoppes eksplisitt.

## Faggrunnlag og materialvalg

Små fagmoduler dekker terrasse, tak og yttervegg. De beskriver arbeidssekvens,
normalforutsetninger og prosjekteringsforbehold. Flere fag kan legges til i
modulregisteret. Fagmodulene er ikke pris- eller tidsnormer og dimensjonerer ikke
konstruksjoner. Oppgitte dimensjoner behandles som brukeropplysninger.

Hunton/trefiber, isolasjonstykkelse, utlektingsdimensjon, kledningsprofil og
terrassebordspesifikasjoner lagres på AI-postene og begrenser materialvarevalg.
Byggmax-/Obs-regler for lager, butikk, ferskhet, enhet, MVA og pakningsavrunding
er beholdt. Uspesifiserte eksisterende poster får samme varevalg som før.

## Felles arkitektur

`EstimateContext` inneholder beskrivelse, fakta, mål, arbeidsomfang, besvarte
spørsmål, synlige forutsetninger, prisgrunnlag, usikkerheter og valgfrie
presiseringer. «Gjør denne detaljert» bruker dette grunnlaget og den samme
åpne kalkylen. Serveren validerer tidligere bibliotekreferanser før de brukes.

`estimateAI.run({mode, context})` er transportgrensen. OpenAI-format, modellnavn
og endpoint ligger i én serveradapter. En annen provider kan implementere samme
grense, uten å endre beregningsmotoren. Faktiske erfaringstall beregnes lokalt;
de sendes ikke til modellen. Auth, tildelt verktøy, kvote og forbrukslogging
beholdes på serveren. Ukjent modus, ugyldig context og ukjente referanser avvises.

`estimateInput` støtter både tekst og en senere tale-til-tekst-adapter. Mikrofon,
transkripsjon og taleavspilling er ikke implementert.

## PDF/eksport og utsatte koblinger

PDF-moduler, PDF-dialog, eksportknapper, PDF-integrasjonen i `kalkyle.js`,
CSV-modulen og beregningsmotoren er uendret sammenlignet med `d7e16cf`.
Den eneste endringen i `kalkyle.html` er cacheversjonen til appens bootstrap.

AI-budsjettets erfaringstall og forutsetninger er bevisst ikke koblet til PDF,
tilbud, rapporter eller CSV. Det er et senere integrasjonspunkt for prosessen som
eier eksporten. Detaljkalkylens eksisterende eksport bruker fortsatt sine
egne validerte kalkyledata. Ingen eksportdataformat eller eksport-ID er endret.

Automatisk innlesing av faktiske historiske jobbkostnader og flere fagmoduler kan
utvides senere; denne versjonen har registrering av kildebelagte erfaringstall.

## Verifikasjon

- `node --test tests/*.test.mjs`: alle 22 testfiler bestått.
- Nettleser: `kalkyle-ai-modes`, `kalkyle-clarifications`, `kalkyle-assistant`,
  `kalkyle-ai-costs`, `kalkyle-work-hours`, `kalkyle-simple-price`,
  `portal-user-storage` og `kalkyle-pdf`: bestått.
- Nye scenarier: sekvensielle dropdowns, kjent område uten gjentatte spørsmål,
  kilder og intervaller, manglende prisgrunnlag, riktige produktspesifikasjoner,
  overgang til Detaljert, gjenåpning, manuelle endringer og mobil.
- Eksisterende PDF-filer lastes ned og leses i regresjonstesten; priser, MVA,
  logo, kontoseparasjon, sideskift og intern informasjon kontrolleres.
- Nettlesertestene bruker isolert lagring og simulerte AI-/auth-svar. Ingen
  betalte modellkall eller reelle kundedata brukes i testene.

## Publisering av feature-grenen

Produksjon er ikke endret av dette arbeidet. Deploy først Edge Function
`rigor-ai-estimate` fra denne grenen med eksisterende secrets og innstillinger.
Backend beholder støtte for `{brief}` fra gamle klienter og tilbyr bare gamle
bibliotekpakker til disse. Deretter kan PR-en merges for publisering av klienten.
Ingen databasemigrasjon, providerskifte eller nye secrets er nødvendig.

## Nøyaktig endringsliste

Listen nedenfor omfatter denne feature-grenen; PDF-/eksportfiler er ikke med.

```text
README.md
ai-estimate-client.js
docs/ai-modes.md
kalkyle-ai-library.js
kalkyle-ai-material.js
kalkyle-ai-modes.js
kalkyle-ai-ui.css
kalkyle-ai-ui.js
kalkyle-assistant.js
kalkyle-detailed-copilot.js
kalkyle-estimate-ai.js
kalkyle-estimate-context.js
kalkyle-library.js
kalkyle-simple-estimator.js
kalkyle-time.js
kalkyle.html
kalkyle.js
market-public-core.js
portal-tool.js
supabase/functions/rigor-ai-estimate/catalog.js
supabase/functions/rigor-ai-estimate/handler.ts
supabase/functions/rigor-ai-estimate/knowledge/exterior-wall.js
supabase/functions/rigor-ai-estimate/knowledge/index.js
supabase/functions/rigor-ai-estimate/knowledge/roof.js
supabase/functions/rigor-ai-estimate/knowledge/terrace.js
supabase/functions/rigor-ai-estimate/legacy-prompt.js
supabase/functions/rigor-ai-estimate/modes.js
supabase/functions/rigor-ai-estimate/provider.ts
tests/ai-estimate-backend.test.mjs
tests/kalkyle-ai-modes-browser.py
tests/kalkyle-ai-modes.test.mjs
tests/kalkyle-clarifications-browser.py
```

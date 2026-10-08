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

Kalkyler lagres lokalt per verifisert Supabase-bruker-ID og kan eksporteres til CSV og PDF.
Prosjekter, sist lagret kalkyle, eget bibliotek, beskrivelsesutkast og standardsatser
bruker én kontoavgrenset lagringspost. Kontoene får separate prosjektlister på samme
nettleser. Lokal lagring er ikke kryptert eller skysynkronisert; den som har tilgang
til nettleseren og utviklerverktøyene kan fortsatt lese den.

Eldre globale lagringsnøkler åpnes ikke automatisk. Bare serververifisert administrator
får et eksplisitt overføringsvalg på prosjektoversikten. Prosjekter og bibliotek
slås sammen etter ID, med kontodata prioritert; kalkyle, utkast og satser kopieres
bare når kontoverdien mangler. Overføring og markering skjer i én atomisk skriveoperasjon,
og originalene beholdes. Vanlige medlemmer får aldri dette overføringsvalget.

Kalkyle og
Materialpriser krever verifisert Supabase-innlogging, aktiv portalkonto og
kalkyletilgang før appen starter. Administrator har fortsatt tilgang når
`kalkyle` ikke er registrert; en eksplisitt deaktivert registrering respekteres.
Andre brukere trenger et aktivert verktøy med `tool_key = kalkyle` og egen
verktøytildeling. Direkte lenker sender til portalen med en kontrollert lokal
returadresse. Utlogging skjuler appen; gjenopprettede faner kontrolleres på nytt.

GitHub Pages leverer fortsatt HTML, JavaScript og offentlige markedspriser
uten HTTP-autentisering. Innloggingskontrollen styrer appstart og erstatter
ikke serverbeskyttelse av konfidensielle data. AI- og administrator-API-ene
kontrollerer token og rettigheter på serveren. Prosjekter er fortsatt lokale;
ingen skysynkronisering eller nye konto-/tilgangsrader opprettes her.

Tester: `node tests/portal-access.test.mjs`, `node tests/portal-user-storage.test.mjs`,
`python3 tests/portal-tool-browser.py` og `python3 tests/portal-user-storage-browser.py`
(lokal server på port 8090). Nettlesertestene
simulerer verifiserte Supabase-svar via `tests/portal_test_support.py`; det finnes
ingen testomgåelse i produksjonskoden.

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

Kalkyleverkstedet åpner med en forside for Forenklet eller Detaljert.
Opprett prosjekt med navn, kunde, adresse, kalkulasjonsnummer og status.
Detaljert starter tomt med biblioteket; Forenklet starter med veiviseren.
Hvert prosjekt har eget lagret prisgrunnlag, egne satser og poster.
«Lagre prosjekt» og retur til prosjektoversikten lagrer lokalt. Prosjekter
kan søkes frem, gjenåpnes og få endrede detaljer. Nye prosjekter starter med
standardinnstillinger. Ingen Supabase-/skysynkronisering er aktivert.
Nettlesertest: `python tests/kalkyle-projects.py`.

Markedsprissynk: se [supabase/MARKET-PRICES.md](supabase/MARKET-PRICES.md).
Serverkode, migrasjon, adminvisning og deaktivert planlagt jobb er lagt til.
Ingen reelle Obs BYGG-/Byggmax-produkter er verifisert, og Supabase-funksjonen
er ikke deployet. Nettverksproxy blokkerte kildeundersøkelsen.

Prissortimentet støtter 16 varetyper, inkludert sløyfer/lekter, plater, duker,
festemidler, kledning, listverk, gulv, vinduer og dører. Kildeprodukter må fortsatt
registreres og verifiseres. Køen behandler forfalte varer hvert kvarter etter
aktivering, med separat kontrollintervall per kilde. Takveiviseren har egne
felt for sløyfeavstand, lekteavstand og svinn.

Arbeidsflaten har nå egne faner for Forenklet, Detaljert, Prisgrunnlag og
Timepris & påslag. Beskrivelsesfeltet øverst lagrer en lokal kladd på forsiden
og en egen beskrivelse per prosjekt. AI-knappen er deaktivert; ingen oppgaver
genereres fra teksten ennå. Designgrunnlag og fremtidig forslagflyt er
dokumentert i [docs/KALKYLE-DESIGN-RESEARCH.md](docs/KALKYLE-DESIGN-RESEARCH.md).
Konkurrentenes nettsider kunne ikke leses på grunn av nettverksproxyens 403;
Svenn-bildene er den verifiserte visuelle referansen.
Nettlesertest: `python tests/kalkyle-workspace.py`.


### Pris og tid etter AI-forslag

AI velger oppgaver fra biblioteket. Kalkylen beholder bibliotekets registrerte
grunntider og bruker prosjektets timekostnad og påslag. Takvinkel og adkomst
bruker samme faktorberegning som veiviseren og biblioteket; faktoren kan
overstyres per post. Ved gjenåpning repareres tidligere AI-poster som fikk
nullstilt en kjent grunntid, uten å erstatte manuelt registrerte tider/faktorer.
RIGOR-malenes tider er foreløpige. Svenn er ikke koblet til: dokumenterte
grunntider kan importeres under «Timepris & påslag» med oppgavenøkkel eller
identisk navn og enhet, timer/enhet, valgfri tidsfaktor og kilde.

Velg markedsvare direkte på materialposten. Produkt, butikk, dato og pris
per materialenhet vises sammen med omregnet materialkostnad per arbeidsenhet.
Lagret produktvalg oppdateres fra det offentlige prisregisteret; ukjent
produkt, feil enhet, annen varetype eller utløpt pris kan ikke prises som
en gyldig materialpost. Takstein og metall kan ikke bruke en shingelpris.
Kjente arbeids- og materialpriser vises med påslag som «Kjent delsum» mens
komplett prisanslag/CSV venter på komplett grunnlag. Timesatser kan lagres som lokale standarder for nye
prosjekter; eksisterende prosjekter beholder sine satser.

Verifikasjon: `node tests/kalkyle-time.test.mjs` og
`python3 tests/kalkyle-ai-costs-browser.py` (server på port 8090) dekker
AI-poster, faktisk utslag av timesatser, vare-/butikkvalg, pakningsavrunding,
importerte grunntider, overstyringer, prosjektseparasjon og mobil.

## Forenklet prisavklaring og eksportgrunnlag

Forenkletvisningen har materialposter med markedsvarevalg og registrering av
leverandørpris, kilde og dato. Manglende arbeidsmengde og grunntid kan fylles
inn samme sted. Kjent delsum utelater uavklarte pris-/tidsdeler og merkes som
ufullstendig; alle nødvendige poster må avklares før komplett prisanslag og
salgsgrunnlag kan eksporteres. Manuelle priser med dato utløper etter 30 dager;
markedsobservasjoner utløper fortsatt etter 24 timer. Produktvalg er eksplisitt:
en pris fra feil varetype/dimensjon skal ikke erstatte en manglende pris.

«AI: kontroller arbeidslisten» sender gjeldende veiviservalg, beskrivelse og
valgte oppgaver til den eksisterende AI-tjenesten etter et klikk. Merkede
takdata har forrang over eldre mål i friteksten. Horisontalt areal omregnes
én gang til takflate; lengder og antall etterspørres. Forslaget vises før
oppgaver legges inn. Eksisterende oppgaver beholdes og er avvalgt i forslaget.
AI finner oppgaver i biblioteket; priser og grunntider kommer fra det
kontrollerte prisgrunnlaget, import eller brukerens registrering.

Biblioteket åpnes i et sidepanel med søk, fag, arbeidstype, numerisk sorterte
kategorier og oppgaver. `kalkyle-code-register.js` inneholder permanente
interne elementidentifikatorer. Nye elementer må få nye identifikatorer;
eksisterende identifikatorer skal aldri nummereres om. Arbeids-, innkjøps- og
salgskoder følger malens oppgavenøkkel, også for kopier og AI-poster. Dette
er egne RIGOR-koder, ikke Svenn-/NS-koder, regnskapskontoer eller lønnsarter.
Brukeren kan lagre egne kodekoblinger per prosjektpost via «Koder».

Tre generelle UTF-8 CSV-grunnlag eksporteres separat: arbeidsplan med planlagte
timer og valgfri lønnsart, innkjøp med faktisk valgt leverandørvarenummer og
pakningsavrunding, og salg med separate arbeid-/materiallinjer og påslag.
Arbeidsplanen krever gyldige mengder/tider, innkjøp krever gyldige mengder/priser,
og salg krever komplett grunnlag. Lønnsart står tom inntil system og kobling er
valgt. Beregnede timer er ikke faktisk timeregistrering og kan ikke alene brukes
til lønnskjøring. Ingen av eksportene sender ordre, lønn eller faktura til et
eksternt system. Salgsgrunnlaget avstemmes mot samme kalkylemotor som anslaget.

Verifikasjon: `node tests/kalkyle-codes.test.mjs` og
`python3 tests/kalkyle-simple-price-browser.py` (server på port 8090) kontrollerer
kodebestandighet, avstemte eksportbeløp, mangler, prisavklaring, lagring, AI-kontroll,
sidepanel og mobil. Nettlesertesten bruker kontrollerte lokale produktdata og
et simulert AI-svar; den gjør ingen betalte AI-kall.

## Prisvalg og avklaringer på kalkyleforsiden

Forsiden forklarer Forenklet, Detaljert og AI, og hva som må avklares før et
prisanslag blir komplett. AI-spørsmål gjenkjennes også når modellen bruker en
annen formulering: taktype, tekking og kledningsretning får nedtrekksvalg;
mål får tallfelt med enhet. Sammensatte spesifikasjoner og åpne spørsmål
beholder tekstfelt. Svarene tas med i neste forslag før noen poster legges til.

Obs-undertak med dokumenterte rullmål i det eksakte SKU-navnet omregnes fra
stykkpris til m². Brutto rullareal brukes til kjøp av hele ruller; overlapp og
svinn må legges til i materiellmengden. Enhetsretting av eksisterende
observasjoner beholder den opprinnelige kontrolltiden og eventuelle kildefeil.
Prisjobben sammenligner gamle og nye priser i samme enhet, og beholder tidligere
enhetshistorikk. Gamle priser og feil fra kilden sperres fortsatt.

Markedsvarevinduet kan oppdatere prisregisteret eller åpne registrering av
leverandørpris på den aktuelle posten. Valgt Byggmax-butikk gjelder bare lokale
Byggmax-priser; offentlige Obs-priser vises uavhengig av butikkvalget.

Verifikasjon: `node tests/market-public.test.mjs`,
`node tests/kalkyle-questions.test.mjs` og
`python3 tests/kalkyle-market-questions-browser.py` (lokal server på port 8090).
Rulltestene bruker faktiske produktdata lagret fra Obs. AI-svarene i
nettlesertesten er simulert og utløser ingen betalte kall.

### Arbeidstimer og rivingsanslag

Terrasseavklaringer bruker et delt faglig spørsmålsregister i
`supabase/functions/rigor-ai-estimate/terrace-questions.js`: materiale, overflate,
rekkverkstype og kjente valg blir nedtrekksmenyer; mål har tall og enhet;
prosjekterte dimensjoner og særlige ønsker har tekst. Sammensatte spørsmål
deles. Spørsmål om stående/liggende terrassebord fjernes på server og klient.
Bekreftede svar beholdes, og terrasseareal lagres med riktig navn. Spørsmål
om nye bordmaterialer fjernes ved kun riving. [Kildekontrollen](docs/terrasse-avklaringer.md)
beskriver faglige avklaringer og lenker til Montér, Byggmakker og TEK17.
Test: `node tests/kalkyle-terrace-questions.test.mjs` og
`python3 tests/kalkyle-terrace-questions-browser.py` (lokal server på port 8090).

AI-forhåndsvisningen kontrollerer oppgavenøkler, ikke bare hele elementer.
`kalkyle-task-overlap.js` har eksplisitte koblinger for terrassebord i rivingspakker,
lekter i takrivingspakker og vindsperre i etterisolerings-/kledningspakker. Samme
oppgave velges én gang, mens tillegg som bjelkelag og rensk beholdes. Valg som tas
bort frigjør oppgaven i andre foreslåtte elementer. Ønsket arbeid prioriteres
foran tilhørende og valgfrie tillegg. Ulike produkter, enheter og arbeidsflater
slås ikke sammen bare fordi oppgavenavnene er like.

En ny kontroll ved innlegging hindrer gjentatte AI-kjøringer i å legge inn de
samme oppgavene igjen, også når eksisterende oppgaver er valgt bort. Manglende
oppgaver i et delvis utfylt element kan fortsatt legges til. Eksisterende mengder,
priser, tider og manuelle tilpasninger endres ikke. For en separat flate brukes
biblioteket; AI tolker et nytt areal som noe som må avklares på eksisterende post.

Lagrede oppgaver med lik oppgavenøkkel og mengde får «Kontroller dobbeltposter»
i både Forenklet og Detaljert. Brukeren bekrefter samme arbeid og velger posten
som skal beholdes. Øvrige velges bort fra pris, timer og eksport, men radene og
deres registrerte verdier beholdes. Ingen automatisk sletting av eldre poster.
Kontroll: `node tests/kalkyle-task-overlap.test.mjs` og
`python3 tests/kalkyle-task-overlap-browser.py` (lokal server på port 8090).

Mengde × grunntid × tidsfaktor gir personarbeidstimer. Timer og arbeidspris vises
på hver post, i elementsummen og i Forenklet. Arbeidsprisen bruker prosjektets
timekostnad og arbeidspåslag én gang, også når materialprisgrunnlaget er ufullstendig.

`kalkyle-time-estimates.js` har gjennomgåtte, **egne RIGOR-planleggingsanslag**,
ikke offisielle normer, for terrassebord, bjelkelag, håndløper, rekkverk og utvendige
trapper samt spesifisert riving av tekking, sløyfer, lekter og undertak. Profilene
forutsetter normal tilkomst, ingen bevaring/gjenbruk, og ekskluderer stillas,
borttransport, avfallsavgift og sanering. Terrassebord: 0,20 t/m², rensk: 0,05 t/m²,
bjelkelag: 0,15 t/m². Dette er redigerbare planverdier, ikke målte produksjonsdata.

Kildekontroll 07.10.2026: [Fellesforbundets tømrerakkordtariff fra 01.10.2023](https://www.fellesforbundet.no/globalassets/lonn-og-tariffsaker/akkordtariffer/akkordtariffen-for-tomrerfaget---01.10.2023.pdf),
punkt 2.5 (trykt side 8), angir medgåtte timer for riving. Tariffens monteringsnormer
kan derfor ikke presenteres som dokumenterte rivingsnormer. Homewyse sin
[terrassekalkyle](https://www.homewyse.com/services/cost_to_install_wood_decking.html)
beskriver en separat rivingspost, men publiserer ikke en kontrollerbar grunntid i
den leste tabellen; ingen timeverdier er hentet fra den.

Lagrede poster med manglende tid får disse anslagene når de åpnes, både fra AI og
bibliotek. Manuelle tider, importerte normer, ikke-null tider og egne faktorer beholdes.
Umappet/spesialisert arbeid krever fortsatt en oppgitt tid. Like terrassebordposter i
flere elementer varsles, slik at samme areal ikke prises to ganger ved et uhell.

AI fyller arbeidsmengde på arealbaserte terrasseposter fra ett entydig oppgitt
terrasseareal. Flere arealer, blandet tak-/veggarbeid, meter og stykk må avklares.
Tester: `node tests/kalkyle-work-hours.test.mjs` og
`python3 tests/kalkyle-work-hours-browser.py` (lokal server port 8090).

### PDF-tilbud, beregning og egen logo

«Tilbud / PDF» i prosjektet og «Eksporter PDF» i sammendraget åpner dokumentvalgene.
Kundetilbudet viser valgte poster, salgskoder, mengder, enhetspriser, MVA og totalsum;
interne kostnader og fortjeneste følger bare beregningsdokumentet. Beregningen
inkluderer grunntider, tidsfaktorer, arbeidstimer, innkjøpskostnader, påslag,
kodekoblinger og kilder. PDF-ene bruker de samme uavrundede beregningene som appen;
eventuelle øredifferanser vises eksplisitt slik at de avrundede beløpene avstemmes.
Manglende pris, mengde eller grunntid må avklares før eksport.
Eksempelpriser kan eksporteres som merket beregning, men brukes ikke i kundetilbud.
Full lokal lagringsplass hindrer ikke en gyldig PDF-nedlasting; lagringsfeil varsles.

Bedriftsnavn, kontaktopplysninger og logo lagres lokalt for den verifiserte kontoen.
PNG/JPG/WebP-logoer (maks. 5 MB) normaliseres til en avgrenset PNG i nettleseren.
Logoen beholder proporsjonene og ligger øverst til høyre på hver side. Kunde,
dokumentnummer, beskrivelse, gyldighetsdato og vilkår lagres med prosjektet.
Dokumentdato bruker norsk tid. Ingen dokumenter eller logoer sendes til AI eller
andre servere; jsPDF og Unicode-skrifter leveres lokalt fra `vendor/pdf` med lisenser.

Tester: `node tests/kalkyle-pdf.test.mjs`, `node tests/portal-user-storage.test.mjs`
og `python3 tests/kalkyle-pdf-browser.py` (lokal server på port 8090).
Nettlesertesten leser faktiske nedlastede PDF-er og kontrollerer beløp, interne
opplysninger, norske tegn, logo, sideskift, mobil og separasjon mellom kontoer.

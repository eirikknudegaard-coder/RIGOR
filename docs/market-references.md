# Markedsreferanse i Detaljert kalkyle

Markedsreferansen er et eget prislag over det eksisterende offentlige produktregisteret.
Den gir en materialpris per forbruksenhet når spesifikasjonen og datagrunnlaget er
tilstrekkelig tydelig. Ingen nettpriser, mengder eller totalsummer lages av AI.
Ingen nye leverandører, prisjobber, Supabase-funksjoner eller prisimportformater
publiseres av denne endringen.

Utgangspunkt: `main` ved `d7e16cf` ble hentet og kontrollert. Arbeidsområdet var
rent ved `f0f5164`, med AI-modusene fra den foregående oppgaven. Endringen er laget
på `feat/market-reference` over denne AI-grenen. Den skal vurderes som en separat
endring; AI-grenen må følge med før publisering.

## Valg og prioritet

Det automatiske prisvalget i Detaljert er:

1. Eksplisitt manuell prosjektpris.
2. Gyldig importert pris med eksakt prisnøkkel og materialenhet.
3. Et allerede lagret, gyldig markedsreferanse-snapshot.
4. En ny, brukbar markedsreferanse for en avklart materialspesifikasjon.
5. Manglende pris.

Import må oppfylle eksisterende regler for NOK, ekskl. MVA og dato (30 dager).
Feil enhet eller gammel import kan ikke overstyre en referanse. En ny import i
Detaljert beholder manuelle priser. Formatet for CSV og den bekreftede AI-importen
er uendret.

«Se prisgrunnlag» viser gjeldende pris, lagret referanse og ferske observasjoner.
Brukeren kan uttrykkelig velge import, konkret produkt, markedsreferanse eller
registrere manuell pris. Et slikt valg kan bytte prisgrunnlaget for posten;
automatisk oppdatering kan ikke gjøre dette. Et eksplisitt SKU-valg bruker den
eksisterende produkt- og pakningslogikken. «Bruk markedsreferanse» velger
referansen selv om en import er tilgjengelig. En senere ny prisimport gjeninnfører
importprioriteten, med unntak for manuelle priser og eksplisitte SKU-valg.

«Oppdater prisgrunnlag» erstatter snapshot når referansen er aktiv. Hvis manuell,
importert eller konkret produktpris er aktiv, oppdateres bare den lagrede
referansen; det aktive prisvalget beholdes. For å bytte prisgrunnlag brukes den
egne «Bruk markedsreferanse»-handlingen.

Forenklet bygger ikke nye markedsreferanser. Et eksisterende snapshot beholdes
når brukeren bytter visning i samme kalkyle. Erfaringstall og enkel AI-budsjettering
er ikke gjort om til produktreferanser.

## Produktmatching

`market-reference.js` mottar en strukturert `requirement`, tilbud og klokkeslett.
Første versjon har konservative regler for terrassebord, sløyfer/lekter,
konstruksjonsvirke, trekledning og bygningsisolasjon. Andre varetyper bruker
fortsatt konkret produktvalg, import eller manuell registrering.

For trevarer kreves tykkelse, bredde, materiale og behandling. Konstruksjonsvirke
krever styrkeklasse, og kledning krever profil. Isolasjon krever tykkelse,
materialtype og bruksområde. Oppgitt merke, profil, lambda eller klasse må også
stemme. Trefiber, glassull og steinull blandes ikke. Standard trykkimpregnert tre
blandes ikke med royalbehandlet, varmebehandlet, kompositt, premium eller andre
sortering. En spesifisert profil blandes ikke med andre profiler.

Eksisterende data har hovedsakelig produktnavn. Bare eksplisitte, entydige
attributter i navnet brukes. «48x48 Lekt» dokumenterer dimensjon, men **ikke**
ubehandlet status. Ukjent behandling fylles ikke inn. «Trefiberisolasjon» er
bygningsisolasjon; vindsperre-/mark-/lydplater og blåseisolasjon inngår ikke som
samme vare. Fremtidige strukturerte data kan leveres i `offer.specification` med
feltene `thicknessMm`, `widthMm`, `material`, `treatment`, `grade`, `profile`,
`application`, `lambda` og `brand`. Motstrid mellom erklærte data og kjente
navneattributter avviser produktet.

Postens materialbehov hentes fra eksplisitt `materialRequirement`, ellers fra
postnavnet og eksisterende AI-spesifikasjon. Generiske poster får ingen tilfeldig
dimensjon eller behandling. Brukeren kan velge en dokumentert materialgruppe
eller fylle inn spesifikasjonen. Arbeidsareal omregnes ikke automatisk til
løpemeter terrassebord. Ved bytte av materialenhet må faktisk materialmengde
oppgis. Eksisterende forbruksforhold og mengdefelt brukes videre.

## Normalisering, statistikk og sikkerhet

Bare ubetingede offentlige priser på lager, kontrollert siste 24 timer, med
dokumentert MVA og riktig enhet tas med. Feil, fremtidige, utløpte og lokale
butikkobservasjoner avvises. Byggmax-butikker er ikke nødvendig for referansen;
de finnes fortsatt for konkrete lokale SKU-valg. Obs BYGG kan brukes uten
geografisk informasjon. Samme SKU hos samme leverandør teller én gang; siste
observasjon gjelder, også når den er merket med feil.

En pakningspris omregnes fra den dokumenterte nettoprisen og pakningsinnholdet.
For eksempel gir 489 kr inkl. MVA og 2,8 m² innhold
`489 / 1,25 / 2,8` kr/m² ekskl. MVA. Produktregisterets øreavrundede enhetspris
kontrolleres mot dette beløpet. Beregningen beholder presisjonen; bare visningen
avrundes. Ukjent pakningsenhet, manglende innhold eller motstridende avgiftsbeløp
kan ikke brukes. Ingen omregning mellom m og m² gjøres uten faktisk mengdegrunnlag.

Hovedverdien er **median** av normaliserte priser. Ved to priser er medianen
midtpunktet. Ved flere priser sorteres listen og midtverdien, eventuelt midtparet,
brukes. Gjennomsnitt, observert min/maks, antall produkter og leverandører lagres
for sporbarhet. Ingen skjult uteliggerfjerning gjøres; en ekstrem pris vises i
prisområdet, mens medianen begrenser påvirkningen på kalkyleverdien.

- Ett produkt: lav sikkerhet; verdien vises, men brukes **ikke automatisk**.
- To eller flere entydige produkter: moderat sikkerhet og brukbar referanse.
- Minst fem produkter og minst to leverandører: høy sikkerhet.

Alle inngående produkter må passere de samme kravene. Mange usikre treff gir
aldri høy sikkerhet. Én leverandør alene kan maksimalt gi moderat sikkerhet.
«Sist kontrollert» viser den eldste kontrollen blant inngående produkter, slik
at ett nylig kontrollert produkt ikke gjør resten tilsynelatende ferske.

## Prisøyeblikk og beregning

Posten lagrer `materialRequirement`, faktisk `priceBasis` og `priceSnapshot`:

```js
{
  version: 1,
  price: 31.8,
  unit: 'm',
  observedAt: '…',
  referenceId: 'decking:m:…',
  confidence: 'medium',
  method: 'median',
  minPrice: 28.4,
  maxPrice: 35.9,
  meanPrice: 32.03333333333333,
  productCount: 3,
  supplierCount: 3,
  sources: [/* SKU, leverandør, navn, URL, kontrolltid og normalisert pris */]
}
```

Beløp og produkter her er illustrative, ikke publiserte markedspriser.
Snapshot følger postene i eksisterende prosjekt- og kontolagring. Det valideres
mot spesifikasjonen, statistikken og kildeantallet ved bruk. Et endret register,
gammel kontrolltid eller frakoblet kilde endrer ikke det lagrede prisøyeblikket.
Nye kildekontroller gir «Nyere markedspriser er tilgjengelige» og en uttrykkelig
oppdateringshandling. Endret enhet eller skadet snapshot gir avklaringsbehov,
ikke gjenbruk av feil pris.

Referansen settes som vanlig `material` på posten. Eksisterende motor beregner
materialmengde × materialpris og prosjektets påslag. Referansen har ingen egen
SKU eller pakningsstørrelse; derfor er kjøp av hele pakninger og frakt ikke
inkludert. Ved konkret produktvalg brukes eksisterende pakningsavrunding.
Ved bytte fra SKU til referanse fjernes den felles prisnøkkelbindingen, slik at
eksporten ikke tilskriver referansen et feil varenummer. Eksisterende konkrete
valg er fortsatt delt per prisnøkkel; uavhengige SKU-valg per kopi av samme
prisnøkkel er ikke innført i denne oppgaven.

## Faktisk registerdekning

Kontroll av den publiserte kjøringen `2026-10-08T15:56:00.424Z` viste 215 lagrede
observasjoner, hvor mange er lokale butikkvarianter eller eldre kontroller.
Ved kontrolltidspunktet kunne tre entydige lektgrupper gi moderat referanse med
to offentlige Obs-produkter hver. De kontrollerte terrassebord-, isolasjons-,
klednings- og konstruksjonsgruppene hadde bare ett offentlig produkt per gruppe.
Disse blir ikke en automatisk markedsreferanse. Flere uavhengige offentlige
leverandørprodukter med dokumenterte spesifikasjoner kreves for bredere dekning;
tilfeldige produkter, ulike butikker og syntetiske testpriser er ikke fyllmasse.

## Endrede filer og kontroll

- `market-reference.js`: datakonsept, matching, normalisering, median, sikkerhet og snapshot-validering.
- `kalkyle-market-reference.js`: prisprioritet, snapshot-anvendelse og eksplisitt referansevalg.
- `kalkyle-market-reference-ui.js`: kildevisning, spesifikasjon, mengde og prisvalg i dialog.
- `kalkyle-market-reference.css`: avgrenset styling for dette prislaget og mobil.
- `kalkyle.js`: små pris-, visnings-, import- og lagringskoblinger til de nye modulene.
- `kalkyle.html`, `portal-tool.js`: bare nye bootstrap-/app-versjoner for nettlesercache.
- `tests/market-reference.test.mjs`: målrettede pris-/snapshot-/motor-/eksporttester.
- `tests/kalkyle-market-reference-browser.py`: faktiske brukerhandlinger med syntetiske, merkede data.
- `docs/market-references.md`, `README.md`: dokumentasjon.

Tester: `node --test tests/*.test.mjs` og nettlesertestene på lokal server port
8090: `kalkyle-market-reference`, `market-public`, `kalkyle-ai-modes`,
`kalkyle-ai-costs`, `kalkyle-simple-price`, `kalkyle-pdf`, `portal-user-storage`.
De nye testene dekker median og ekstreme priser, feil dimensjon/materiale/klasse,
trefibertykkelse, pakke/MVA, alder/enhet, import/manuell prioritet, kildefeil,
immutable snapshot, uttrykkelig prisbytte, konkret vare, eksportavstemming,
gjenåpning, mengdeavklaring og mobil.

Kontrollen passerer 170 Node-tester, hvorav 17 målrettede markedsreferansetester,
og de syv oppførte nettlesersuitene. Nettleserne bruker mock-verifisert tilgang
og syntetiske leverandørdata; ingen betalte AI-kall eller produksjonsdata endres.

**PDF-/tilbuds-/eksportarbeid er ikke endret.** `kalkyle-pdf-model.js`,
`kalkyle-pdf.js`, `kalkyle-pdf-dialog.js`, `kalkyle-codes.js`, PDF-/eksportblokker
i `kalkyle.js` og all HTML-markup er kontrollert uendret mot `f0f5164`.
`kalkyle-engine.js`, `kalkyle-prices.js`, portaltilgang, kontolagring,
offentlige prisparser-/klientmoduler, prisjobber og eksisterende tester er også
uendret. Kildemetadata finnes på posten for senere PDF-integrasjon; ingen ny
PDF-mal eller eksportkolonne er laget.

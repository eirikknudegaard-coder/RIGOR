# RIGOR Konstruksjon – første versjon

**Oppdatert 9. oktober:** [Manuell medlemskontroll og terrasseplan](rib-member-design.md)
beskriver den nye inngangen for bjelker/søyler uten AI, standardgrunnlag,
utførte materialkontroller og faktiske gjenstående funksjoner. Resten av dette
dokumentet beskriver den opprinnelige orienterende samtale-/bjelkemotoren.

Eget verktøy på `konstruksjon.html`, adskilt fra kalkyle, markedspriser og PDF.
Det starter med en beskrivelse av bygget og ett oppfølgingsspørsmål om gangen.
Brukeren velger ingen analysemetode. Oppleggene beskrives med vanlig språk.

## Hva denne versjonen gjør

- Tolker beskrivelser av veggfjerning og undersøkelse av en bjelke/drager.
- Skiller søyler/stendere, sperrer, bjelkelag og den nye drageren. `2x6` og
  `2x8` er nominelle dimensjoner og blir
  ikke automatisk bekreftede dragerdimensjoner. `c/c 60` kan tolkes som 600 mm;
  enhet og hvilken konstruksjonsdel dimensjonen gjelder, er synlig.
- Bygger en foreløpig lastvei og viser den som SVG. Oppgitt sperreretning
  alene bekrefter ikke bæring. Støtte under drageren helt ned til fundamentet
  behandles separat. Oppgitt takbæring gjør ikke fundamentpilene bekreftet.
- Gir en **kvalitativ vurdering** også når mål eller laster mangler.
- Regner **orienterende** reaksjoner, moment og skjær for to opplegg eller
  en fast innspent utkrager, med jevn vertikallast og én punktlast i UI.
  Motoren kan superponere flere eksplisitte punktlaster, men samtalevisningen
  stopper ved flere punktlaster til et entydig flerlastskjema er innført.
- Regner øyeblikkelig nedbøyning når faktisk dimensjon, massivt enkelt
  rektangel og C24/GL30c/S355 er bekreftet. Doble bjelker, IPE/HE-profiler og
  hulprofiler får ikke stivheten til et massivt rektangel.
- Forklarer de beregnede tallene, prioriterer manglende støtte og overskredet
  sammenligningsgrense, og viser kilder, forutsetninger og utførte kontroller.
- Viser last-, moment-, skjær- og nedbøyningsdiagram fra solverdata. Positiv
  nedbøyning tegnes fysisk nedover. JSON-nedlasting inneholder samme modell,
  lastvei, materialkilde, forutsetninger, resultater og diagramdata.

Den leverer ikke en full konstruksjonskontroll eller godkjenning. Euler–Bernoulli
er lineær elastisk og omfatter ikke skjærdeformasjon, kryp, vipping, forbindelser,
oppleggstrykk, underliggende konstruksjon, fundament, brann eller fukt.
Ingen Eurocodekapasitet, lastkombinasjoner eller norske nasjonale tillegg er
implementert. Korte/høye bjelker får en særskilt merknad om skjærdeformasjon.

## Lastgrunnlag og avklaringer

Data følger `StructuralContext` med kilde og status. Oppgitt/bekreftet informasjon
har `KNOWN`. Synlige, foreløpige forutsetninger har `ASSUMED`. Motoren produserer
`DERIVED` som egne sporbare poster. Mangler får `REQUIRED`, ikke standardverdier.
Motstridende mål må bekreftes; de kan ikke overskrive hverandre stille.

Avklaringsspørsmålet viser den oppgitte nominelle dimensjonen. Beskrivelsen
«2x6 vertikale søyler» (også «vertikalesøyler» / stendere) registrerer rollen
ut fra ordene ved dimensjonen. Ved veggfjerning behandles dette som eksisterende
bindingsverk; verken dimensjonen eller doble stendere hver 1,2 m overføres til
en ny drager. AI-forslag med en annen nominell dimensjon enn sitatet, feil
konstruksjonsdel eller doble stendere som sammensatt drager avvises både på
server og klient. Andre uavhengig dokumenterte fakta beholdes.

Spørsmål bruker nedtrekk når svaret har kjente alternativer, tallfelt med
desimalkomma/punktum for mål og tekst for lastkilden. «Dette vet jeg ikke»
beholder mangelen og tillater fortsatt kvalitativ vurdering. Ingen tom
snølast, dimensjon, materialklasse eller oppleggsreaksjon fylles med null.
Valgfrie tekniske presiseringer etterspørres bare når de skal brukes.

Tre mål gir ikke en stedsspesifikk snølast. Denne versjonen slår ikke opp
kommune, høyde eller nasjonalt tillegg. Brukeren må oppgi snølast **på taket**
og takets samlede egenvekt med arealgrunnlag og kilde. Marksnølast kan ikke
brukes direkte som taklast. En brukeroppgitt foreløpig last er merket slik.

Den enkle takoverføringen krever at sperrene har opplegg på veggen og en
bekreftet bærende drager/vegg ved mønet, kjent side/spenn og ingen annen
etasje over som modellen utelater. Takstoler, mønebord uten bærende møne,
valmtak/flatt tak og ekstra etasjelast krever et annet dokumentert lastgrunnlag.
Last kan i stedet oppgis direkte på drageren fra en tidligere beregning.
Sperrenes diskrete oppleggslaster jevnes her ut til en linjelast. Oppgitt c/c
brukes ikke til å plassere individuelle reaksjoner; faktisk plassering og
lokal lastoverføring må kontrolleres i en senere detaljmodell.

For en enkel sperre er lastbredden halvparten av vannrett spenn fra hver
bekreftet side. Skrå spenn omregnes med `cos(vinkel)`. Egenvekt per skrå m²
omregnes til vannrett m² med divisjon på `cos(vinkel)`; snølasten er allerede
per vannrett takareal. Ingen formfaktor for snø beregnes i denne versjonen.

Ved veggfjerning er dragerspennet foreløpig satt lik åpningen hvis faktisk
oppleggsavstand ikke er oppgitt. Dette er merket `ASSUMED` og må avklares for
videre dimensjonering. En valgt dragers egenvekt legges til fra areal,
middeltetthet og g = 9,81 m/s², bare når brukeren bekrefter at den ikke allerede
er med i lastene. Uten valgt drager angis at egenvekt/stivhet ikke er kontrollert.

L/300 er en tydelig **antatt sammenligningsgrense**, ikke et forskriftskrav.
Den kan endres under beregningsgrunnlaget. En verdi under grensen gir ikke
en styrke- eller bæreevnegodkjenning. Tre/flere opplegg, rammer, løft,
horisontallast, jordtrykk og torsjon stoppes fremfor å få en feil enkel modell.

## AI-grensen

AI tolker; deterministisk kode regner; forklaringen bruker motorens resultater.

Den separate serverfunksjonen `rigor-ai-construction` har to handlinger:

1. `interpret`: strict JSON med foreslåtte fakta og ordrette sitater. Kjent
   feltnavn, verdiområde og tilstedeværelse av sitat valideres. Tall må finnes
   i sitatet eller være en dokumentert enhetsomregning. Nominelle tommemål
   regnes ikke om til en faktisk drager. Forslag er `PROPOSED`, ikke `KNOWN`,
   før brukeren bekrefter. Allerede registrerte andre verdier er avvalgt.
2. `explain`: serveren bygger analysen fra validert kontekst på nytt. AI kan
   bare velge hvilket kontrollert funn som skal forklares først. Ingen frie
   beregningsresultater, kapasitetstall eller godkjenninger er tillatt i
   svaret. Klienten bruker valgt funn-ID til sin egen `ResultInterpreter`
   og ignorerer eventuell innsendt fritekst fra API-et.

Providergrensen er `ConstructionProvider.run`. Bare adapteren i `provider.ts`
kjenner OpenAI-endepunktet/modellformatet. En annen provider kan kobles inn
uten endring i lastmodell, materialregister, solver eller resultatvisning.
Spørreflyten og motoren virker også hvis AI-status/kall feiler. Et gammelt
AI-svar brukes ikke etter at beskrivelsen er endret. Manuelle svar og gjeldende
beregning beholdes ved API-/kvotefeil.

Tekstboksen er kun én inngang. En senere tale-til-tekst-kilde kan sende samme
beskrivelse/fakta til domenefunksjonene; domenelogikken importerer ikke DOM.

## Moduler

| Konsept | Fil |
| --- | --- |
| StructuralContext / datakontrakt | `construction/context.js` |
| Conversation / begrenset lokal tolkning | `construction/language.js`, `conversation.js` |
| LoadPathModel | `construction/load-path.js` |
| StructuralModel / LoadEngine | `construction/load-engine.js` |
| MaterialDatabase | `construction/materials.js` |
| SectionDatabase | `construction/sections.js` |
| AnalyticalBeamSolver | `construction/beam-solver.js` |
| StructuralChecks | `construction/checks.js` |
| ResultInterpreter / analysepipeline | `construction/analysis.js` |
| DiagramRenderer | `construction/diagram-renderer.js` |
| Providerkontrakt / klient | `construction/ai-contract.js`, `ai-client.js` |
| UI | `construction/ui.js`, `construction.css`, `konstruksjon.html` |
| Server/provider | `supabase/functions/rigor-ai-construction/` |

En fremtidig kontinuerlig bjelke-/rammesolver skal bruke samme sporbare
modell- og resultatkontrakt. Det finnes ingen skjult FEM-stub som gir tall
for systemer denne versjonen ikke støtter.

## Fagkilder kontrollert 8. oktober 2026

- [Svenskt Trä, Design of timber structures, vol. 2 (2022)](https://www.swedishwood.com/siteassets/5-publikationer/pdfer/sw-design-of-timber-structures-vol2-2022.pdf),
  tabell 3.3 s. 10: C24 E₀,mean = 11 000 MPa, ρmean = 420 kg/m³;
  tabell 3.4 s. 12: GL30c E₀,mean = 13 000 MPa, ρmean = 430 kg/m³.
  Kildetabellene henviser til EN 338:2016 og EN 14080:2013. PDF-en er lest;
  verktøyet bruker bare disse stivhets-/tetthetsverdiene, ikke styrkeverdier.
- [SteelConstruction.info – Steel material properties](https://www.steelconstruction.info/Steel_material_properties):
  E = 210 000 N/mm², «Other mechanical properties».
- [Engineering ToolBox – Metals and Alloys, Densities](https://www.engineeringtoolbox.com/metal-alloys-densities-d_50.html):
  steel 7 850 kg/m³. Ingen tykkelsesavhengig S355-flytegrense brukes.
- [Engineering ToolBox – Beams Supported at Both Ends](https://www.engineeringtoolbox.com/beam-stress-deflection-d_1312.html):
  kontroll av grunnformler for jevn last og punktlast. Motoren integrerer
  momentet analytisk, håndhever randbetingelser og finner eksakte ekstrema.
- [DiBK, TEK17 § 10-2 Konstruksjonssikkerhet](https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/10/10-2/):
  rammen for dokumentert konstruksjonssikkerhet. Ikke brukt som om en enkel
  øyeblikkelig nedbøyningsberegning var en full forskriftskontroll.

## Tilgang og lagring

Verktøynøkkelen er `konstruksjon`, med egen aktivering og tildeling. Aktiv,
serververifisert portalkonto kreves før appen importeres. Kalkyletildeling
gir ikke konstruksjonstilgang. En eksplisitt deaktivert registrering gjelder
også administrator. Administrator kan forhåndsvise før registrering, slik
som for kalkyle. Direkte lenker bruker tillatt lokal returadresse.

Serveren gjentar kontroll av JWT, aktiv konto, verktøyaktivering og separat
tildeling før AI/forbruksreservasjon. Kostnadsgrensen er 10 AI-kall per bruker
og 100 totalt per UTC-døgn, minst 45 sekunder mellom kall. Bare bruker-ID,
tid og tokenantall logges. Beskrivelser/fakta sendes ved eksplisitt AI-start
eller AI-forklaring; ingen kalkyleprosjekter sendes automatisk.

Samtale/modell ligger i sidens minne og kan lastes ned som beregningsgrunnlag.
Den skrives ikke til felles lokal lagring, prosjektregister eller Supabase.
Ingen ny PDF- eller tilbudsfunksjon er koblet til konstruksjon. GitHub Pages
beskytter appstart, ikke distribusjonen av offentlig HTML/JavaScript.

## Tester og publisering

`node --test tests/*.test.mjs` kjører også de tre nye konstruksjonssuitene.
De kontrollerer lukkede formler, enheter, randbetingelser, likevekt, eksakte
ekstrema, superposisjon over varierte spenn, rene punktlaster ved opplegg,
avklaringer, manglende grunnlag, material/tverrsnitt, unsupported systemer,
AI-sitater, providergrense, servertilgang og token-/kvotefeil.

Med lokal server på port 8090:

```sh
python3 tests/construction-browser.py
python3 tests/construction-interpretation-browser.py
python3 tests/portal-tool-browser.py
python3 tests/portal-user-storage-browser.py
python3 tests/kalkyle-pdf-browser.py
```

Nettlesertestene bruker isolerte, simulerte Supabase-/AI-svar. Ingen betalte
OpenAI-kall eller kundeprosjekter er brukt. De kontrollerer også at et API-svar
med oppdiktet forklaring ikke kan erstatte motorens tall eller tekst.

Publiseringsrekkefølge og nye backendkrav: [CONSTRUCTION.md](../supabase/CONSTRUCTION.md).
Kalkylemotor, prisinnhenting/-import/-referanser, eksisterende AI-funksjon,
PDF og CSV er ikke endret. Portalutvidelsen er bakoverkompatibel med
`checkToolAccess(client)` som fortsatt gjelder `kalkyle`.

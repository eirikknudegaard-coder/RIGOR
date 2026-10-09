# RIGOR Konstruksjon: direkte innlegging og medlemskontroll

Utvidelse 9. oktober 2026. To innganger deler siden: «Beskriv med AI» og
«Bjelke / søyle uten AI». Den manuelle inngangen bruker bare deterministisk
kode. Den sender ingen opplysninger til AI og skriver ikke til kalkyleprosjekter.

Dette er en medlemsmodul og terrassegeometri, **ikke et ferdig fullverdig RIB-
verktøy eller verifisert norsk Eurocodeprodukt**. Manglende kontroller er en del
av resultatkontrakten og kan ikke skjules av AI, brukerbekreftelse eller et tall
under 100 %. Betongsøyler og stålmedlemmer med kombinert trykk og moment får
alltid ufullstendig medlemsstatus i denne utgaven.

## Standardgrunnlag

Metodene følger første generasjon EN 1990, EN 1995-1-1:2004,
EN 1993-1-1:2005 og EN 1992-1-1:2004. Andre generasjon støttes ikke.
Norske nasjonale tillegg er ikke automatisk validert, slått opp eller lisensiert.
Standard Norge bekrefter at nasjonale valg er en nødvendig del av prosjekteringen.
Prosjektets aktuelle standardutgaver og nasjonale tillegg må identifiseres og
faktorene må kontrolleres av ansvarlig prosjekterende.

Faktorprofilen er et synlig, redigerbart innspill, med dokumentkilde og eksplisitt
brukerbekreftelse. Forhåndsutfylte faktorer er **EN-eksempler**, ikke «norsk NA».
Bekreftelsen blir fjernet ved enhver endring av last, dimensjon, materiale eller
faktor. Resultatet blir skjult når innspill endres. Ingen maskinell eller ekstern
verifikasjon av standarddokumentet påstås.

Vedvarende ULS: 6.10 eller omsluttende 6.10a/6.10b, hver variabel last som
ledende. Permanent last alene tas med (relevant for treets kmod). SLS:
karakteristisk 6.14b, hyppig 6.15b og tilnærmet permanent 6.16b.
ψ0/ψ1/ψ2 registreres per variabel last, uten skjult «snø = nyttelast»-valg.
γ-faktorene skal inkludere prosjektets nødvendige nasjonale/reliabilitetsvalg.

Denne kombinasjonsmodulen støtter bare positive nedoverrettede/trykk-laster
og konservativ sammenlegging av momentbeløp. Gunstige lastvirkninger,
oppløft, fortegnsskifter, lastmønstre på kontinuerlige bjelker, EQU, GEO,
ulykkes-, brann- og seismiske kombinasjoner er ikke implementert. Det er derfor
ikke en generell kombinasjonsgenerator for en hel konstruksjon.

## Utførte kontroller

| Materiale / medlem | Kontrollert | Avgrenset / gjenstår |
| --- | --- | --- |
| C24 / GL30c, rektangulær bjelke | ULS-bøyning, skjær med kcr, kontakttrykk på oppgitt oppleggsflate; SLS øyeblikkelig og sluttdeformasjon med kdef | Trykksiden må være dokumentert fastholdt. Ingen vippingsolver, notcher, hull, forbindelser, samvirkning eller kontinuerlig bjelke |
| C24 / GL30c, søyle | Axialtrykk, knekking begge akser med E0,05, toakset N–M-interaksjon og skjær fra eksplisitt H | Globale rammeeffekter, sideveis SLS, innfesting, brann og fundament er egne oppgaver |
| Stål, massivt rektangel, fastholdt bjelke | Elastisk bøyning, skjær, konservativ elastisk M–V-kontroll, elastisk deformasjon | Ingen I/H/RHS-profiler, lokal lastinnføring eller vipping; fy må dokumenteres for faktisk tykkelse |
| Stål, massivt rektangel, rent trykk | Tverrsnittstrykk og bøyeknekking begge akser med eksplisitt knekkurve | 6.3.3-interaksjon ved moment er ikke implementert; svært flate rektangler får særskilt torsjonsbegrensning |
| Armert betong, enkel rektangulær bjelke | Enkel strekkarmert ULS-bøyning for fck ≤ 50 MPa og x/d ≤ 0,45; Vrd,c uten skjærreduksjon; minimum strekkarmering | Bøyler/detaljering, forankring, rissvidde, risset SLS, kryp og langtid gjenstår. Bruttonedbøyning er bare referanse |
| Armert betongsøyle | Øvre sentrisk tverrsnittsgrense, min. eksentrisitetsreferanse og brutto Eulerreferanse | Ingen dimensjonerende søylekapasitet: N–M-interaksjon, effektiv stivhet, kryp og andreordensanalyse mangler |

Treets kmod velges fra korteste tilstedeværende lastvarighet i hver kombinasjon,
og kdef fra eksplisitt klimaklasse. k_h = 1 gir ingen økning av bøyningsstyrken.
Store trefelt over 600 mm får ufullstendig status før størrelsesvirkning er avklart.
Kontakttrykk bruker fysisk flate og kc,90 = 1 uten gunstige flateøkninger.

Nedbøyning inkluderer Euler–Bernoulli-bøyning og en konservativ øvre grense for
skjærdeformasjon (κ = 5/6 for massivt rektangel). Sluttdeformasjon for tre regnes
med karakteristisk last + kdef × tilnærmet permanent last. Kombinerte punktlaster
samles ved samme koordinat. L/300 er en redigerbar prosjektgrense, ikke et krav
som automatisk gjelder alle byggverk.

Global skjevstilling er et eksplisitt brukerinnspill θ. Himp = θ·NEd oppgis for
avstivningssystemet. Hvis brukeren legger kraften på medlemmet, legges et
konservativt H·h til My i kritisk tverrsnitt. Dette er ikke en global rammeanalyse.
Lokale stavimperfeksjoner inngår i EC5/EC3-knekkurvene og legges ikke til igjen
som lokal bue. Effektive knekkelengder kan ikke gjettes fra stolpehøyden.

## Terrasse og AI

Den innmeldte teksten «Hvor mange søyler trenger jeg på min terrasse … dobbel
langsgående bjelke … enkle cc60 … hvor plasseres de» behandles som
`plan_terrace`, ikke som kontroll av én drager. Spørsmål om lengde, dybde,
høyde og bæring ved huset stilles først. c/c 60 er 600 mm for bjelkelaget;
det er ikke en stolpeavstand. Ingen doble bjelker gis et massivt dobbelt tverrsnitt.

Terrasseplanen trenger dokumenterte maksimale spenn for bjelkelag og drager.
Den deler rektangelet i enkle felt, gir dragerlinjer/støttekoordinater og Gk/Qk-
reaksjoner fra flatebelastning. Summen av reaksjonene bevarer areallasten.
Innfesting, hver planke i dobbel drager, stolper og fundament må kontrolleres
separat. Planstatus er alltid `layout_only`, aldri dimensjonert terrasse.

AI-fakta valideres hver for seg. Et ugyldig eller udokumentert felt utelates og
blir et spørsmål; øvrige dokumenterte fakta beholdes som brukerforslag. Ugyldig
rotkontrakt, kapasitets-/godkjenningsfelt eller overstor respons avvises fortsatt.
Ingen AI-genererte tall brukes som beregningsresultat. Ingen ekstra betalte
retry-kall utføres for å reparere et felt.

## Verifikasjon og kilder

- [Standard Norge – Eurokoder](https://standard.no/fagomrader/bygg-anlegg-og-eiendom/eurokoder1/):
  norske standardfamilier og nødvendige nasjonale valg.
- [Svenskt Trä, Design of timber structures vol.2 (2022)](https://www.swedishwood.com/siteassets/5-publikationer/pdfer/sw-design-of-timber-structures-vol2-2022.pdf):
  tabell 3.2 s.8 (kmod), tabell 3.3 s.10 (C24), tabell 3.4 s.12 (GL30c),
  s.21–27 (bøyning, trykk, skjær, interaksjon), tabell 9.1 s.32 og s.34 (kdef/SLS).
  Fasthets- og stivhetstabellene er visuelt lest fra original-PDF.
- [SteelConstruction.info – Design codes and standards](https://www.steelconstruction.info/Design_codes_and_standards):
  EN 1990 6.10/6.10a/b og forklaring av NA-valg. UK-valg er ikke kopiert som norske.
- [SteelConstruction.info – Member design](https://www.steelconstruction.info/Member_design):
  elastisk tverrsnitt, knekkurver og avgrensningen mot 6.3.3.
- [Concrete Centre – Columns](https://www.concretecentre.com/Codes/Eurocode-2/Columns.aspx)
  og [Shear](https://www.concretecentre.com/Codes/Eurocode-2/Shear.aspx):
  oversikt over nødvendig søyle-/skjærdesign. De erstatter ikke NS-EN/NA eller
  uavhengig kontroll av betongimplementasjonen.

204 Node-prøver passerte, inkludert uavhengige lastkombinasjoner, lukkede
bjelkeformler, femte-percentil-knekking, materialfaktorer, eksentrisitetskraft,
betong-stressblokk, omsluttende kontroller og areallikevekt for terrasse.
Nettlesertester bruker simulerte konto-/AI-svar, ikke produksjonskonto eller
betalte AI-kall. Ny manuell flyt, tidligere konstruksjon og portaltilgang testes.

```sh
node --test --test-isolation=none tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 tests/construction-manual-browser.py
PYTHONDONTWRITEBYTECODE=1 python3 tests/construction-browser.py
PYTHONDONTWRITEBYTECODE=1 python3 tests/portal-tool-browser.py
```

## Hva som kreves før «fullverdig enkelt RIB-verktøy»

1. Lisensiert og kontrollert NS-EN-/NA-grunnlag, utgaver, pålitelighetsvalg og
   prosjektparametere; uavhengige benchmark-beregninger signert faglig.
2. Dokumentert stålprofilregister, klassifisering, vipping, torsjonsknekking
   og 6.3.3-medlemsinteraksjon for aktuelle profiltyper.
3. Armert betong: N–M, slankhet/andreorden, kryp, riss/SLS, bøyledetaljering,
   forankring og armeringsplassering; ikke bruk sentrisk kapasitet som erstatning.
4. Globale stabilitets-/rammeeffekter, sammenhengende lastvei, forbindelser,
   fundament og lastmønstre; relevante flere lastretninger/kombinasjonstilfeller.
5. Beregningsrapport med kontrollomfang, sporbar revisjon, signatur og faglig
   kontroll. JSON i denne modulen er beregningsgrunnlag, ikke signert RIB-rapport.

Disse gjenstående punktene er faktiske manglende funksjoner, ikke en generell
advarsel. Verktøyet merkes ikke som full dimensjonering før de er implementert
og kontrollert.

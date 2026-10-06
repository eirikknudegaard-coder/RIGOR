# Kalkylearbeidsflate: referanser og designvalg

Dato: 6. oktober 2026 (Europe/Oslo).

## Hva som faktisk er undersøkt

Svenns arbeidsflyt er vurdert fra brukerens skjermbilder: prosjekt-/kalkylekort,
opprettelsesdialog med kunde og tittel, kalkylefaner, faktor-/timeprisinnstillinger
og kategorisert bibliotek med avkryssbare enkeltoppgaver. Dette er verifisert
bildegrunnlag, ikke en test av Svenns funksjoner eller kildekode.

Offentlige produktsider ble forsøkt lest for følgende kandidater:

| Kandidat | Offentlig side | Resultat i dette miljøet |
| --- | --- | --- |
| Svenn | https://www.svenn.com/ | HTTPS-proxy avviste forbindelsen med 403 |
| Buildxact | https://www.buildxact.com/us/estimating-software/ | HTTPS-proxy avviste forbindelsen med 403 |
| Jobber | https://www.getjobber.com/features/quotes/ | HTTPS-proxy avviste forbindelsen med 403 |
| Houzz Pro | https://www.houzz.com/pro/estimating-software | HTTPS-proxy avviste forbindelsen med 403 |

Dette er **ikke en fullført, oppdatert markedsundersøkelse** av disse produktene.
Ingen nåværende funksjoner, priser, skjermbilder eller AI-egenskaper hos dem
påstås verifisert. Sidene er kandidater for videre sammenligning når nettverket
åpnes. Det krever tillegg av deres domener i miljøets eksisterende tillatelser;
ingen ukjent nettverksliste er erstattet.

## Vurderingsramme og funn fra skjermbildene

1. Prosjekter må være første nivå: tittel, kunde, status og en tydelig åpnehandling.
   Brukerens Svenn-bilder viser dette som et eget oversiktsnivå.
2. Arbeid og innstillinger bør skilles. Svenn viser egne kalkylefaner og egne
   dialoger for satser; RIGORs tidligere prisimport og satser tok plass foran
   oppgavene. RIGOR beholder de samme funksjonene i egne faner.
3. Et bibliotek må støtte kategori → element → avkryssbare oppgaver, med tydelige
   mengder og enheter. RIGOR beholder denne strukturen, med egne beskrivelser.
4. En synlig oppsummering gjør det mulig å forstå hva valgene betyr. RIGOR viser
   pris, arbeidstimer og prisgrunnlagsstatus ved siden av arbeidsflaten.
5. Tydelig plass for prosjektbeskrivelsen er et designvalg ut fra brukerens
   AI-mål, ikke en påstått konkurrentfunksjon.

Neste markedsrunde bør kontrollere navigasjon, prosjektoversikt, redigering av
kalkyleposter, mobilbruk, tilbudsvisning, materialkoblinger, import og faktisk
AI-støtte i de fire kandidatene. Sammenlign observerte arbeidsflyter, ikke bare
markedsføringspåstander. Ingen produkt må få en rangering uten dette grunnlaget.

## Gjennomført i RIGOR

- Egen, avgrenset CSS for kalkyleappen: mer konsistent typografi, mellomrom,
  knapper, formfelt og kort. Nettsiden og prisadministrasjonen er ikke redesignet.
- Forenklet, Detaljert, Prisgrunnlag og Timepris & påslag er egne arbeidsfaner.
  Kalkylemodusen beholdes selv når innstillingsfanene er åpne.
- Prosjektoversikt og dialog beholdes; kort og navigasjon er gjort mer konsistente.
- Samlet beskrivelsesfelt øverst på forsiden og i prosjektet. Eksempelknapper
  for saltak, etterisolering og terrasse; eksisterende tekst erstattes bare etter
  eksplisitt bekreftelse. Beskrivelser lagres lokalt, adskilt per prosjekt.
- AI-knappen er deaktivert og tydelig merket. Ingen backend, AI-kall, generert
  oppgaveliste eller automatisk prising er aktivert som del av designendringen.
- Kolonneforklaringer i (?) og eksisterende pris-/mengdekontroll beholdes.

## Senere AI-flyt: beskrivelse → forslag → kontroll → kalkyle

Eksempel: «Saltak, 30 grader, 100 m² takflate. Takstein, sløyfer, sutak,
vindskier, beslag og vannrenner.»

En fremtidig agent skal koble «sutak»/«undertak» og skrivevarianter til
bibliotekets konkrete element-ID-er. Den må skille mellom uttrykkelig ønsket
arbeid, nødvendige tilhørende oppgaver og valgfrie tillegg.

Forslaget bør inneholde undertak, sløyfer, lekter til valgt stein, takstein og
innfesting, vindskier, relevante beslag og takrenner; nedløp, møne, lufting,
fallsikring/stillas og avfall må vurderes og spørres om der oppgaven krever det.
Agenten skal ikke stille dette opp som en universelt komplett takløsning.
Utførelse og systemkrav avhenger av produkter og eksisterende konstruksjon.

100 m² og takvinkel alene bestemmer ikke lengde på møne, vindskier, takfot,
renner, nedløp eller antall gjennomføringer. Manglende mål, taksteinmodell,
lekt-/sperreavstand, undertakstype, dimensjoner, tilstand og om riving skal inngå
må vises som spørsmål eller manglende mengder. Fukt-/bæreevneforhold kan kreve
prosjektering. AI skal ikke fylle dette med oppdiktede tall eller priser.

Teknisk kontrakt for neste steg: bruk beskrivelsen, prosjektets innstillinger og
bibliotekets ID-er/enheter/avgrensninger som kontekst. Returner et strukturert
forslag med element-ID, oppgave-ID, valgt mengde eller `null`, begrunnelse,
materialspesifikasjon og spørsmål. Valider mot biblioteket på serveren.
Vis avkryssbar forhåndsvisning før brukeren legger oppgavene inn. Priser kommer
utelukkende fra import eller verifisert prisregister, aldri fra språkmodellen.
En ny AI-generering må ikke automatisk overskrive egne kalkyleendringer.

Dette beskriver neste implementasjon. Dagens felt lagrer kun beskrivelsen.

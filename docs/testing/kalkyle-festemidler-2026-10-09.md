# Festemidler og tilbehør – 9. oktober 2026

Materiallisten viste hovedvarene, men installasjonsoppgavene manglet festemidler og nødvendig systemtilbehør. I tillegg var noen skruepakker registrert som én stykkvare, slik at pakkepris kunne bli oppfattet som pris per skrue.

Valgt arbeid med terrassebord, kledning, undertak, sløyfer, lekter og taktekking får nå egne tilbehørsposter. Disse har null arbeidstid; montering inngår i hovedoppgaven. Postene følger arbeidsmengde og bortvalg, lagres med prosjektet og blir ikke duplisert ved ny AI-kontroll. Riving får ingen nye innkjøpsposter. Utvidede pakker med en eksisterende samlet innfestingskostnad får ikke ekstra innfestingsavsetning.

Tilbehør omfatter terrasseskruer, kledningsspiker/skruer, festemidler til sløyfer/lekter, undertaks- og vindsperretape, sløyfebånd, taksteinfester, takplateskruer og musebånd. Brukeren avklarer riktig produkt og mengde, eller velger bort poster som ikke trengs. Lengder og vindavhengig innfesting utledes ikke av arealet. For 28 × 120 mm terrassebord på c/c 600 mm finnes et eksplisitt valgbart mengdegrunnlag på 27 skruer/m² fra Bergene Holms byggeguide. Andre dimensjoner og innfestingssystemer må registreres etter aktuell anvisning. Produsentlenker og daterte utdrag ligger i `tests/fixtures/evidence/accessory-guidance-*`.

Regelmotoren leser antall fra den eksakte SKU-ens navn/størrelse, normaliserer pakkeprisen og priser hele pakninger. Ubekreftet eller motstridende antall brukes ikke som stykkpris. Tape og bånd med oppgitt lengde i SKU-navnet kan prises per meter. Tapet behandles ikke som tettingstape. Oppdateringen flytter ikke observasjonsdatoen til eldre priser og fjerner ikke eksisterende kildefeil.

## Verifikasjon

- 230 Node-tester passerer. Nye tester dekker avhengigheter, bortvalg, mengdeendring, lagring, null ekstra arbeidstid, ukjente mengder, eksportblokkering, stabile innkjøps-/salgskoder og AI-budsjett uten festemidler i leverandørsvaret.
- Desktop og 390 × 844 mobil: 50 m² terrasse, 415 m bordbehov / 99 hele bord, og valgt mengdegrunnlag gir 1 350 skruer. Faktisk Obs BYGG SKU `ObsBygg-7025180675483` har 1 000 skruer og 239,20 kr ekskl. MVA per pakke. To pakker koster 478,40 kr. Tilbudssummen øker fra 50 575,78 til 51 149,86 kr ekskl. MVA med prosjektets 20 % materialpåslag. Arbeidstiden forblir 32,5 timer. Arbeidstid og avfallsavsetning er eksplisitte benchmarkforutsetninger, ikke offentlig norm.
- Fire faktiske PDF-er og to innkjøps-CSV-er inneholder produkt, behov, kjøpsmengde og to pakninger. Tilbuds-PDF viser 2 000 stk på materialposten og har ingen intern innkjøpskostnad. PDF-er er lest med PyMuPDF; manuelle mengdeendringer gir tre pakker ved behov for 2 001 skruer. Bortvalg fjerner kostnaden og materialet. Gjenåpning beholder SKU og valgt mengdegrunnlag.
- Seks historiske prosjektkontroller for tak, vegg og terrasse passerer på desktop/mobil. De opprinnelige benchmarkene dekker hovedvarer, og nye tilbehørsposter er eksplisitt valgt bort der for å kontrollere uendrede historiske beløp. Den separate festemiddeltesten dekker reelle skruepakker inkludert i tilbudet.
- Eksisterende kontroller for PDF/logo/sideskift, AI-modus, timekostnader, arbeidstimer og markedsproduktvalg passerer.

Innlogging og AI-transport er simulert i nettlesertestene; priser for bord og skruer er daterte, faktisk innhentede norske produktobservasjoner. Ingen ny OpenAI-kostnad eller hemmelig API-nøkkel brukes. Tilbehørslisten følger de valgte monteringsoppgavene også når AI ikke nevner tilbehøret.

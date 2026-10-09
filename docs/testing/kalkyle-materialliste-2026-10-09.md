# Materialliste i kalkyle og eksport – 9. oktober 2026

Arbeidsoppgaver som «Montere terrassebord» hadde mengder og prisgrunnlag, men tilbudet manglet en egen materialliste med produktidentitet. Produktnavn og varenummer var heller ikke med i den generelle kalkyle-CSV-en.

Materiallisten vises nå i Forenklet og Detaljert, i foreløpig AI-budsjett, ved kontroll av AI-oppgaver og i både tilbuds-PDF og intern beregning. CSV for prisanslag, arbeidsplan, innkjøp og salg tar med materialbeskrivelse. Arbeidsnavn og eksisterende prisberegning beholdes.

- Konkret produktvalg viser faktisk produktnavn, dimensjon og leverandørens varenummer i intern oversikt og innkjøp. Produktmetadata lagres med prosjektet og bevares når registeret er utilgjengelig.
- Beregnet behov og kjøpsmengde vises separat: 415 m terrassebord mot kjøp av 99 hele 4,2 m-bord / 415,8 m; 100 m² isolasjon mot 36 pakker / 100,8 m².
- Markedsreferanse og avtalepris bruker materialspesifikasjon og vises som uvalgt konkret produkt. De tar ikke med varenummeret til en tidligere valgt SKU. Manuelt registrert produktnavn kan oppgis med leverandørprisen.
- Bortvalgte poster, riving uten materialkostnad og avsetninger til rigg/avfall blir ikke varer i materiallisten. Fysiske materialer til fundament beholdes.
- Materialene inngår allerede i postprisene. Materiallisten gir ingen ekstra prislinjer eller påslag. Tilbuds-PDF viser materialnavn og mengder; leverandørens varenummer og interne kostnader vises bare internt.

## Kontroller

222 Node-tester passerer. Terrasse, yttervegg og tak er kjørt på desktop og 390 × 844 mobil med daterte norske produktbevis. 12 faktiske PDF-er kontrolleres med PyMuPDF: materialnavn, behovsmengde, kjøpsmengde, alle oppgaver, totalsummer, norske tegn, marger, sidetall og tilbudets interne personvern. Seks CSV-er inneholder valgte produktnavn. Ingen endring i benchmarkenes totalsummer: 50 575,78 / 250 349,00 / 190 725,04 kr ekskl. MVA.

PDF/logo/sideskift, forenklet prisflyt, markedsreferanse, AI-modus og AI-kostnader har i tillegg separate nettleserregresjoner. Innlogging og AI-transport simuleres i testene; ingen ny tilgang til hemmelige API-nøkler brukes.

Arbeidsplanens nye materialkolonner er lagt til etter de eksisterende kolonnene. To eldre tester er endret til å finne «Status» via kolonneoverskriften i stedet for å anta at status alltid er siste kolonne. Selve kravet om faktiske timeregistreringer for lønn beholdes.

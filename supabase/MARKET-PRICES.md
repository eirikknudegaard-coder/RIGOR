# Materialpriser og synkronisering

## Status og avgrensninger

Kode, migrasjon, adminvisning og tidsstyrt jobb er skrevet. **Ikke aktivert i
Supabase eller produksjon. Ingen reelle leverandørprodukter eller priser er
verifisert.** Miljøets HTTPS-proxy avviste både Obs BYGG og Byggmax med
`CONNECT tunnel failed, response 403`, også for robots.txt. Dette er en
nettverksbegrensning her, ikke dokumentasjon på at kjedene avviser integrasjon.
Ingen produkt-URL-er, produkt-ID-er eller prisobservasjoner er fabrikkert.

Datakildenes vilkår/API-er/feeds og 10–20 konkrete sammenlignbare produkter
må verifiseres før aktivering. Implementerte adaptere er konservative
JSON-LD-lesere med egne kjedeinnganger, ikke verifiserte butikk-API-er.
De krever ett konkret Product med eksakt registrert kilde-ID og ett Offer.
Flere tilbud, ukjent valuta, omdirigering eller blokkering gir feil.
Lokale butikker/Birkeland/Grimstad er konfigurerbare felt, men hentes **ikke**
uten en separat verifisert butikkadapter; slike tilbud brukes ikke automatisk.
Dette dokumentet beskriver ikke en ferdig leverandørintegrasjon.

## Aktivering

1. Bruk et miljø med tillatt nettverk for å undersøke vilkår, robots.txt,
   tilgjengelige API-er/feeds og produkter hos begge kjedene. Foretrekk avtalte
   feeds. Tilpass adapterne til verifiserte data; kjør kildeverifiseringene
   nedenfor. Ikke omgå innlogging, CAPTCHA eller andre sperrer.
2. Kjør `supabase db push` mot riktig prosjekt. Migrasjonen er
   `migrations/202610050002_market_prices.sql` og
   `migrations/202610050003_price_assortment.sql`.
3. Sett et tilfeldig dedikert `RIGOR_PRICE_JOB_KEY` som Edge Function-secret.
   `SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` leveres av Supabase-runtime.
   Ingen OpenAI-nøkkel eller AI-kall er nødvendig.
4. Deploy `supabase functions deploy rigor-market-prices --no-verify-jwt`.
   Gatewayens JWT-verifisering må slås av **bare for denne funksjonen** fordi
   scheduler bruker en egen hemmelighet. Funksjonen verifiserer selv brukerens
   JWT gjennom Auth, aktiv portalbruker og adminrolle ved administrative kall.
   Databasens service role ligger bare på serveren.
5. Logg inn som administrator og åpne `priser.html`. Registrer produktgrupper,
   dokumenterte spesifikasjoner, kilde-ID/URL, original prisenhet, pakningsinnhold,
   MVA og pristype. Godkjenning krever like relevante spesifikasjoner og notat.
   Produktgruppens prisnøkkel må stemme med materialoppgavens nøkkel i kalkylen.
6. Dokumenter tillatelse og aktiver kildene etter verifikasjon. Kjør manuelt én
   kontroll og en ny kontroll etter minst fem minutter. Bekreft hver kjede,
   priser, enheter, MVA og at uendret pris ikke gir duplikater innen samme jobb.
7. I GitHub Actions: legg `RIGOR_PRICE_JOB_KEY` i repository secrets (samme
   verdi som Supabase), `RIGOR_PRICE_FUNCTION_URL` i repository variables til
   funksjonens HTTPS-adresse og `RIGOR_PRICE_SYNC_ENABLED=true` som variable.
   GitHub Actions må være aktivert. Workflow `.github/workflows/market-prices.yml`
   behandler forfalte varer ca. hvert kvarter og kan startes manuelt. Actions-schedules kan
   forsinkes og kan deaktiveres ved lang inaktivitet i offentlige repoer.

Aktivering krever Supabase prosjekt-/deploytilgang, GitHub konfigurasjonstilgang
og verifisert leverandørtilgang. Disse bindingene finnes ikke i nåværende miljø.
Ikke legg hemmeligheter i frontend, repository eller chat.

## Drift og prisbruk

Datamodellen skiller grupper, produkter, pristilbud/observasjoner og jobber.
Penger lagres i øre. Observasjoner bevarer originalpris, omregning, lagerstatus,
pristype via kildeprodukt, kilde og kontrolltid. Pakningsinnhold og spesifikasjoner
må kontrolleres på nytt ved endret produkt; de gjettes ikke fra navn.

RPC med transaksjonslås forhindrer overlapp og nye jobber innen fem minutter.
Jobber har tidsbegrenset lease for å tåle avbrutt runtime. Kildene kjøres
sekvensielt, med maks 20 produkter per kilde og en begrenset tidsramme.
Hver vare har neste kontrolltid; vellykket kontroll forskyver den med
kildeintervallet (normalt seks timer), feil forsøkes tidligst igjen etter én
time. Eldste forsøk prioriteres og kjedene roterer etter sist startet. Nye/endrede
produkter blir forfalt umiddelbart. Hele sortimentet er ikke garantert å bli
kontrollert hver sjette time; faktisk kapasitet må måles mot tilgjengelige kilder.
Ved mange tusen varer må batchstørrelse/runtime og API-/feedtilgang dimensjoneres.
Timeout, 429/502/503/504 gir én begrenset retry. Lang Retry-After respekteres ved
å avbryte fremfor å prøve for tidlig. robots.txt kontrolleres før kildens batch.
En robots-feil stopper kilden, ikke de andre kjedene. Siste gyldige pris og
siste vellykkede kontrolltid bevares ved feil. Endringer over 50 % flagges og
holdes utenfor til kilden/produktet er kontrollert; ingen falsk prisendring lages.

Kalkylen leser bare lagrede, godkjente, ubetingede InStock-tilbud yngre enn
24 timer. Medlemspriser og lokale/uklare tilbud rangeres ikke automatisk.
Hver gruppe velger billigste sammenlignbare nettilbud, **ikke** bekreftet lokal
butikkpris. Sammenligning på tvers av forskjellige grupper gjøres ikke.
Kjøpsmengden runder opp til hele pakker/bord/plater; frakt er ukjent og separat.
Importpriser beholder eksisterende 30-dagersgrense. Lagret prosjekt beholder
prisgrunnlaget til brukeren henter nytt; gamle markedspriser blokkerer total.
Nye produktgrupper og kildeprodukter legges til i adminvisningen. Kildeprodukter
kan redigeres, godkjennes/avvises og deaktiveres. Automatiske produktfunn fra
sitemap/kategorier er ikke implementert.

## Verifikasjon

Lokale regler: `node tests/market-price-core.test.mjs`.
Backend med isolerte HTTP-/database-fixtures: `node tests/market-price-backend.test.mjs`.
Disse er ikke bevis på innhenting av ekte leverandørdata.
UI med lokale fixtures: `python tests/market-prices-browser.py`.
Migrasjon og planlagt drift må testes mot Supabase etter oppsett.
Reell kildeverifikasjon må dokumentere minst én vellykket pris fra hver kjede,
to kjøringer, riktig produkt/variant, enhet/MVA, pakningsavrunding, prisbetingelser,
feilbevaring og databasens duplikat-/overlappsvern. Ingen slike reelle kjøringer
kunne utføres her.

Ingen betalte AI-kall. Supabase og GitHub Actions kan medføre kostnader eller
kvotegrenser avhengig av konto/plan; leverandøravtaler kan ha egne kostnader.

Deploytilgang er lagt som krav i Codex-miljøets konfigurasjonsutkast:
`RIGOR_SUPABASE_MANAGEMENT_TOKEN` mappes til `SUPABASE_ACCESS_TOKEN`, kun mot
`api.supabase.com`. Utkastet må fylles inn sikkert, lagres og publiseres før
tilgangen finnes i runtime. Det aktiverer ikke Supabase-funksjonen eller
GitHub-jobben automatisk. Legg også til `www.obsbygg.no` og `www.byggmax.no`
i miljøets eksisterende nettverkstillatelser uten å fjerne andre domener.

Sortiment: 16 typer med obligatoriske, typeavhengige spesifikasjoner. Sløyfer
og lekter er en egen type. Ingen «alle varer»-oppdagelse eller reelle produkter
er lagt inn uten kildeverifisering. Takveiviseren beregner sløyfer og lekter
fra takflate, valgt avstand i mm og svinn. Kantlekter, skjøter og forsterkninger
registreres separat; dette erstatter ikke produktets monteringsanvisning.

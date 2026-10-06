# Aktiver AI-forslag i kalkylen

OpenAI-nøkkelen leses bare på serveren fra `RIGOR_OPENAI_KEY`, som allerede er lagt inn som Supabase-secret. Nøkkelen skal aldri legges i GitHub eller nettleseren.

## Publisering

1. Kjør innholdet i `supabase/migrations/202610060001_ai_estimate_limits.sql` i Supabase SQL Editor. Dette oppretter forbruksregisteret og serverfunksjonen som reserverer forespørsler. Krever eksisterende portaloppsett.
2. Med Supabase CLI installert og innlogget på riktig organisasjon, kjør fra rotmappen:

   ```sh
   supabase functions deploy rigor-ai-estimate --project-ref hyqiqjuycivihsgjongj --no-verify-jwt
   ```

   Funksjonen har offentlig GET for tilkoblingsstatus. POST validerer brukerens token, aktiv portalkonto og administratorstatus eller tildelt kalkyleverktøy i funksjonen før OpenAI kontaktes. Derfor brukes `--no-verify-jwt` på gatewayen.
3. Åpne kalkylen på nytt. Knappen skal aktiveres når serveren bekrefter at secrets er tilgjengelige. Logg inn via portalen og prøv ett forslag i et tomt detaljert prosjekt. Kontroller oppgaver og mengder før du legger dem til.

For publisering fra Codex trengs separat Supabase-deploytilgang (`SUPABASE_ACCESS_TOKEN`, fra Supabase-kontoens access tokens). OpenAI-secreten gir ingen deploytilgang. Legg deploytilgang i sikre miljøinnstillinger, aldri i chatten eller repoet.

## Atferd og forbruk

Modell: `gpt-4.1-mini`, kan overstyres med `RIGOR_ESTIMATE_MODEL` til en modell med støtte for strict structured outputs. Maks 3000 outputtokens per forespørsel, 10 forespørsler per bruker og 100 totalt per UTC-døgn, minst 45 sekunder mellom brukerens forespørsler. Feilede forespørsler bruker også en reservasjon. Dette er antallsgrenser, ikke en garantert kostnadsgrense; sett også budsjettvarsler hos API-leverandøren.

Kun den skrevne beskrivelsen og et serverstyrt bibliotekutvalg sendes til OpenAI. Beskrivelsen kan inneholde det brukeren selv skriver. Andre prosjektfelt og eksisterende kalkyleposter sendes ikke automatisk. Forbruksregisteret lagrer bruker-ID, tidspunkt og tokenantall, ikke beskrivelsen.

AI velger eksisterende element- og oppgave-ID-er. Forslaget endrer ikke kalkylen før brukeren velger oppgaver og legger dem til. Priser kommer fra valgt prisgrunnlag; arbeidstid må registreres. Bare entydig oppgitte arealer, takvinkler og arealgrunnlag brukes; lengder og antall gjettes ikke. Biblioteket oppdateres med `node scripts/update-ai-catalog.mjs` når standardbiblioteket endres, og funksjonen må deployes igjen.

Tillatte produksjonsoriginer er rigor.no, www.rigor.no og eirikknudegaard-coder.github.io. Andre domener kan settes med `RIGOR_ALLOWED_ORIGINS` (kommaseparert).

## Verifisert i utviklingsmiljøet

Backendtester bruker simulerte Supabase/OpenAI-svar. Nettlesertest bruker simulert AI-modul og sjekker forhåndsvisning, eksplisitte og manglende mengder, fravalg, eksisterende poster, endret tekst, API-feil og mobil. Ingen betalt API-test eller produksjonsdeploy er utført fra dette miljøet uten deploytilgang.

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

### Klargjort publisering fra Codex

Miljøet har et eksisterende secret-felt **`RIGOR_SUPABASE_MANAGEMENT_TOKEN`** som bindes til `SUPABASE_ACCESS_TOKEN` for `api.supabase.com`. Ved kontroll 6. oktober 2026 var feltet uten lagret verdi, og produksjonsfunksjonen svarte HTTP 404 «Requested function was not found». En [Supabase Access Token](https://supabase.com/dashboard/account/tokens) må legges i dette feltet i Codex-miljøets sikre innstillinger. `RIGOR_OPENAI_KEY` skal fortsatt være i Supabase.

CLI 2.119.0 er klargjort uten Docker. Fra repository-roten, med deploytilgangen tilgjengelig:

```sh
node scripts/prepare-ai-estimate.mjs
DO_NOT_TRACK=1 SUPABASE_TELEMETRY_DISABLED=true SUPABASE_NO_UPDATE_NOTIFIER=1 npm exec --offline --cache /tmp/rigor-npm-cache --package=supabase@2.119.0 -- supabase functions deploy rigor-ai-estimate --project-ref hyqiqjuycivihsgjongj --use-api --no-verify-jwt
```

Første kommando kontrollerer eksisterende portalfunksjoner og oppretter bare AI-forslagenes forbruksregister og reservasjon. SQL-oppsettet kan kjøres igjen uten å slette tidligere forbruk. Andre migrations og Edge Functions berøres ikke. Databasekommandoen stopper før nettverkskall når tokenet mangler. CLI-versjon og deploy-flagg er kontrollert; databaseoppsett og produksjonsdeploy venter fortsatt på tilgang.

Etter publisering skal offentlig GET returnere `ready: true`, og POST uten innlogging returnere 401. Ingen av disse kontrollene skal sende et OpenAI-kall. GET bekrefter serverkonfigurasjon, mens et autentisert forslag også krever portaltilgang, fungerende forbruksregister og OpenAI-modelltilgang.

Statusfeltet i appen skiller nå mellom manglende funksjon (404), ufullstendig serveroppsett (`ready: false`), gateway-/origin-tilgang (401/403) og midlertidige nettverksfeil. Klikk statusfeltet for å sjekke på nytt; prosjektbeskrivelse og kalkyleposter beholdes. Feil eller ukjent status aktiverer ikke AI-knappen.

## Atferd og forbruk

Modell: `gpt-4.1-mini`, kan overstyres med `RIGOR_ESTIMATE_MODEL` til en modell med støtte for strict structured outputs. Maks 3000 outputtokens per forespørsel, 10 forespørsler per bruker og 100 totalt per UTC-døgn, minst 45 sekunder mellom brukerens forespørsler. Feilede forespørsler bruker også en reservasjon. Dette er antallsgrenser, ikke en garantert kostnadsgrense; sett også budsjettvarsler hos API-leverandøren.

Kun den skrevne beskrivelsen og et serverstyrt bibliotekutvalg sendes til OpenAI. Beskrivelsen kan inneholde det brukeren selv skriver. Andre prosjektfelt og eksisterende kalkyleposter sendes ikke automatisk. Forbruksregisteret lagrer bruker-ID, tidspunkt og tokenantall, ikke beskrivelsen.

AI velger eksisterende element- og oppgave-ID-er. Forslaget endrer ikke kalkylen før brukeren velger oppgaver og legger dem til. Priser kommer fra valgt prisgrunnlag; arbeidstid må registreres. Bare entydig oppgitte arealer, takvinkler og arealgrunnlag brukes; lengder og antall gjettes ikke. Biblioteket oppdateres med `node scripts/update-ai-catalog.mjs` når standardbiblioteket endres, og funksjonen må deployes igjen.

Tillatte produksjonsoriginer er rigor.no, www.rigor.no og eirikknudegaard-coder.github.io. Andre domener kan settes med `RIGOR_ALLOWED_ORIGINS` (kommaseparert).

## Verifisert i utviklingsmiljøet

Backendtester bruker simulerte Supabase/OpenAI-svar. Nettlesertest bruker simulert AI-modul og sjekker forhåndsvisning, eksplisitte og manglende mengder, fravalg, eksisterende poster, endret tekst, API-feil og mobil. `node tests/ai-estimate-client.test.mjs` og `python tests/ai-estimate-status-browser.py` kontrollerer faktiske klient-/UI-koden med simulerte statusresponser, inkludert ny kontroll uten tapt beskrivelse og uten AI-kall. Ingen betalt API-test eller produksjonsdeploy er utført fra dette miljøet uten deploytilgang.

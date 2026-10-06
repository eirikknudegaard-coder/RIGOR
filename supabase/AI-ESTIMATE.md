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

### Publisering fra Codex

Den fungerende Codex-hemmeligheten heter **`RIGOR_SUPABASE_ACCESS_TOKEN`**, eksponeres med samme miljøvariabelnavn og er begrenset til `api.supabase.com`. Dette er en proxykobling; tokenverdien skal ikke kopieres til repo, logger eller chat. OpenAI-nøkkelen ligger fortsatt bare i Supabase som `RIGOR_OPENAI_KEY`.

Fra repository-roten:

```sh
SUPABASE_ACCESS_TOKEN="$RIGOR_SUPABASE_ACCESS_TOKEN" NODE_USE_ENV_PROXY=1 node scripts/prepare-ai-estimate.mjs
NODE_USE_ENV_PROXY=1 node /workspace/scratch/rigor-cloud/deploy-ai-estimate.mjs
```

Publiseringshjelperen opprettes av Codex-miljøets lagrede installasjonsskript utenfor repositoryet. Den bruker Supabase sitt dokumenterte multipart-API for å publisere kun `rigor-ai-estimate`, med `index.ts`, `handler.ts`, `proposal.js` og `catalog.js`. CLI 2.119.0 avviser proxyens tokenformat før nettverkskallet, så denne miljøtypen skal bruke Management API. Andre migrations og Edge Functions berøres ikke. SQL-oppsettet kan kjøres igjen uten å slette tidligere forbruk.

Funksjonen ble publisert 6. oktober 2026. Offentlig GET svarte `ready: true`, POST uten innlogging svarte 401, og CORS-preflight svarte 204. RLS og serverrollens tillatelser til forbruksregisteret ble kontrollert i databasen. Dette bekrefter publisering og tilgang, men en GET-status alene bekrefter ikke at et reelt AI-forslag lykkes.

Statusfeltet i appen skiller nå mellom manglende funksjon (404), ufullstendig serveroppsett (`ready: false`), gateway-/origin-tilgang (401/403) og midlertidige nettverksfeil. Klikk statusfeltet for å sjekke på nytt; prosjektbeskrivelse og kalkyleposter beholdes. Feil eller ukjent status aktiverer ikke AI-knappen.

## Atferd og forbruk

Modell: `gpt-4.1-mini`, kan overstyres med `RIGOR_ESTIMATE_MODEL` til en modell med støtte for strict structured outputs. Maks 3000 outputtokens per forespørsel, 10 forespørsler per bruker og 100 totalt per UTC-døgn, minst 45 sekunder mellom brukerens forespørsler. Feilede forespørsler bruker også en reservasjon. Dette er antallsgrenser, ikke en garantert kostnadsgrense; sett også budsjettvarsler hos API-leverandøren.

Kun den skrevne beskrivelsen og et serverstyrt bibliotekutvalg sendes til OpenAI. Beskrivelsen kan inneholde det brukeren selv skriver. Andre prosjektfelt og eksisterende kalkyleposter sendes ikke automatisk. Forbruksregisteret lagrer bruker-ID, tidspunkt og tokenantall, ikke beskrivelsen.

AI velger eksisterende element- og oppgave-ID-er. Forslaget endrer ikke kalkylen før brukeren velger oppgaver og legger dem til. Priser kommer fra valgt prisgrunnlag; arbeidstid må registreres. Bare entydig oppgitte arealer, takvinkler og arealgrunnlag brukes; lengder og antall gjettes ikke. Biblioteket oppdateres med `node scripts/update-ai-catalog.mjs` når standardbiblioteket endres, og funksjonen må deployes igjen.

Tillatte produksjonsoriginer er rigor.no, www.rigor.no og eirikknudegaard-coder.github.io. Andre domener kan settes med `RIGOR_ALLOWED_ORIGINS` (kommaseparert).

## Verifisert i utviklingsmiljøet

Backendtester bruker simulerte Supabase/OpenAI-svar. Nettlesertest bruker simulert AI-modul og sjekker forhåndsvisning, eksplisitte og manglende mengder, fravalg, eksisterende poster, endret tekst, API-feil og mobil. `node tests/ai-estimate-client.test.mjs` og `python tests/ai-estimate-status-browser.py` kontrollerer faktiske klient-/UI-koden med simulerte statusresponser, inkludert ny kontroll uten tapt beskrivelse og uten AI-kall. Produksjonsdeploy og de offentlige tilgangskontrollene er utført. Reelle brukerforespørsler har registrert tokenforbruk, men de korrigerte AI-svarene må også kontrolleres i en autentisert brukersesjon.


## Oppfølgingsspørsmål

Før API-kallet viser klienten konkrete felter for manglende taktype, vinkel, areal, arealgrunnlag og taktekking. Kledning avklarer materiale, profil/dimensjon, liggende/stående utførelse, netto veggareal og etterisolering. Allerede entydig oppgitte data etterspørres ikke igjen. Mansardtak har to vinkelfelt. Svarene lagres i prosjektbeskrivelsen og sendes med neste forespørsel. Et foreløpig forslag kan bestilles når opplysninger fortsatt er uavklarte; mengder gjettes ikke.

Spørsmål i AI-forslaget har også svarfelt og en knapp for å oppdatere forslaget. Kalkyleposter legges fortsatt bare til ved eksplisitt godkjenning. AI-skjemaet begrenser element-ID og oppgave-ID per element; gjentatte gyldige oppgaver samles uten å godta ukjente oppgaver eller prisfelt.

Ventetiden på 45 sekunder, dagsgrensene, utilgjengelig forbrukskontroll og feil hos OpenAI har ulike feilmeldinger. De skal ikke omtales som samme forbruksgrense.

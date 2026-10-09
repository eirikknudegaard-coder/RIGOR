# Aktivering av RIGOR Konstruksjon

Ny Edge Function: `rigor-ai-construction`. Eksisterende `RIGOR_OPENAI_KEY`
brukes på serveren. Ingen ny API-nøkkel i nettleseren eller nye secrets kreves.
Funksjonen leser Supabase sine vanlige URL-/anon-/service-role-variabler.
Valgfri modellvariabel: `RIGOR_CONSTRUCTION_MODEL` (standard `gpt-4.1-mini`).

Utvidelsen 9. oktober krever ny deploy av samme funksjon (delvis validering av
AI-fakta, terrasse-/søyle-intent og nye kontekstfelt), men ingen ny migrasjon,
secret eller verktøytildeling. Den manuelle medlemsmotoren er en ren klientmodul
og lastes ikke opp som backendavhengighet. Publiser funksjonen før klienten.

Importkartet i `konstruksjon.html` gir alle nettlesermodulene samme eksplisitte
versjon. Dette hindrer at en ny skjemaklient bruker et gammelt, cachet
konstruksjonskontrakt fra forrige publisering.

## Publiseringsrekkefølge

1. Kontroller de nye domenetestene og nettleserflyten.
2. Kjør `supabase/migrations/202610080001_construction_assistant.sql` i riktig
   prosjekt. Migrasjonen oppretter verktøyregistrering og separat AI-forbruk.
   Den gir ingen medlemmer tilgang og overskriver ikke en eksisterende
   deaktivert verktøyregistrering. Andre tabeller/prosjekter endres ikke.
3. Publiser funksjonen, med **alle delte domenemoduler**:

   ```sh
   supabase functions deploy rigor-ai-construction --project-ref hyqiqjuycivihsgjongj --no-verify-jwt
   ```

   Gatewayen har offentlig GET-status og OPTIONS. POST kontrollerer JWT,
   aktiv portalkonto, verktøyaktivering og administrator/verktøytildeling i
   handleren. Gateway-flagget er derfor ikke en omgåelse av POST-tilgangen.
4. Kontroller GET `ready: true`, uautentisert POST 401 og CORS 204. En ekte
   AI-forespørsel krever en innlogget, aktiv konto; GET er ikke bevis for
   tilstrekkelig OpenAI-saldo eller et vellykket genereringskall.
5. Publiser klient/portal til `main`. Tildel `konstruksjon` til ønskede
   medlemmer gjennom eksisterende portal-/Supabase-administrasjon. Ingen
   `kalkyle`-tildelinger gjenbrukes automatisk.

Hvis backend ikke er aktiv, kan administrator bruke den faglige spørreflyten
og den deterministiske motoren; UI viser at AI er utilgjengelig. Vanlige
brukere trenger likevel aktivert verktøy og egen tildeling.

## Management API / Codex-proxy

Miljøets `RIGOR_SUPABASE_ACCESS_TOKEN` er en proxykobling begrenset til
`api.supabase.com`. Bruk støttet HTTPS-rute med `NODE_USE_ENV_PROXY=1`; ikke
skriv tokenet til filer, logger, repo eller chat. Den eksisterende
`deploy-ai-estimate.mjs`-hjelperen publiserer **ikke** denne nye funksjonen.

For multipart-API-et må filnavnene beholde prosjektets relative struktur:

- `entrypoint_path`: `supabase/functions/rigor-ai-construction/index.ts`
- `name`: `rigor-ai-construction`
- `verify_jwt`: `false`
- Opplastede `file`-deler: `index.ts`, `handler.ts`, `provider.ts` under samme
  fulle `supabase/functions/rigor-ai-construction/`-prefiks, og de delte
  modulene under `construction/` med samme relative filnavn som i repoet.

Handlerens `../../../construction/…`-import må ikke få en flattet mappe.
Nødvendige delte moduler er `ai-contract.js`, `context.js`, `analysis.js`,
`load-path.js`, `load-engine.js`, `sections.js`, `materials.js`,
`beam-solver.js` og `checks.js`. Browser-UI, CSS og `ai-client.js` er ikke
backendavhengigheter. Deploy-endepunktet er
`POST /v1/projects/{project-ref}/functions/deploy?slug=rigor-ai-construction`.

## Forskjell fra full dimensjonering

Ingen sertifisert Eurocodekontroll, snølastoppslag, kontinuerlig bjelke,
ramme/FEM, stålprofildimensjonering eller dokumentgodkjenning aktiveres av
denne migrasjonen. Dette er kvalitative og orienterende analyser med synlig
grunnlag. Faglig gjennomgang og utvidede kontroller må legges til før produktet
kan tilby en full dokumentert konstruksjonskontroll.

Se [domenemodeller, kilder og tester](../docs/construction-assistant.md).

Utviklingskontroll: migrasjonen er kjørt i en transaksjon med `ROLLBACK`.
SQL-syntaks, RLS og serverens eksklusive forbruksrettigheter bestod.
Verktøyregistrering, forbrukstabell og reservefunksjon var fraværende både
før og etter kontrollen; dette aktiverte ikke backend i produksjon.

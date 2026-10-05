# Aktivere AI-import i RIGOR

Frontenden og backend-koden er klare. API-kall er ikke aktivert før SQL,
Edge Function og OpenAI-nøkkel er konfigurert i Supabase-prosjektet
`hyqiqjuycivihsgjongj`. GitHub Pages publiserer bare frontenden.

## Aktivering

1. Kjør innholdet i `migrations/202610050001_ai_import_limits.sql` i
   Supabase SQL Editor. SQL oppretter en RLS-beskyttet forbrukstabell og en
   atomisk reserveringsfunksjon som bare `service_role` kan bruke.
2. Opprett en prosjektavgrenset OpenAI API-nøkkel med tilgang til modellen
   som brukes. Legg nøkkelen inn sikkert i **Supabase → Edge Functions →
   Secrets** som `RIGOR_OPENAI_KEY`. Ikke legg den i GitHub eller i chatten.
3. Valgfri hemmelighet/innstilling: `RIGOR_IMPORT_MODEL=gpt-4.1-mini`.
   Dette er standardmodellen. Bekreft modelltilgang og gjeldende API-priser
   i OpenAI-prosjektet før aktivering. Backend trenger også Supabases
   standardvariabler `SUPABASE_URL`, `SUPABASE_ANON_KEY` og
   `SUPABASE_SERVICE_ROLE_KEY`; disse skal ikke legges i frontenden.
4. Med Supabase CLI installert og autentisert, kjør fra repository-roten:

   ```sh
   supabase functions deploy rigor-import-map --project-ref hyqiqjuycivihsgjongj
   ```

   Behold JWT-verifisering aktivert. Ikke bruk `--no-verify-jwt`.
   Funksjonen kontrollerer også tokenet og krever både `portal_has_access`
   og `portal_is_admin` fra den eksisterende portalen.
5. Standard tillatte origins er `https://rigor.no` og `https://www.rigor.no`.
   Ved behov sett `RIGOR_ALLOWED_ORIGINS` til en kommaseparert liste med
   nøyaktige origins. Ikke bruk wildcard.
6. Logg inn som administrator, åpne Kalkyleverksted → Importer prisliste →
   Importassistent, last opp CSV og be om AI-forslag. Bekreft at forbruk vises
   og registreres i `rigor_ai_import_usage`, men at prisene ikke endres før
   du bekrefter koblingen. Test også med en ikke-administrator: AI-kallet
   skal avvises uten OpenAI-kall.

## Funksjon og grenser

- Kolonner gjenkjennes med faste regler først. AI brukes bare når brukeren
  ber om det og bekrefter sendingen.
- Hele CSV-filen importeres av lokal kode etter eksplisitt bekreftelse.
  CSV er støttet; Excel må eksporteres til CSV. PDF/OCR er ikke implementert.
- OpenAI mottar maks åtte rader og 16 000 tegn; output er begrenset til
  1 000 tokens. Ingen samtalehistorikk eller full prisliste sendes.
- API-nøkkel og service-role-nøkkel er kun på backend. Opplastede rader
  logges ikke av applikasjonen. Tokenantall og bruker-ID registreres.
- Høyst 20 reserverte kall per bruker og 100 totalt per UTC-døgn. Grenser
  håndheves atomisk i PostgreSQL før fakturerbare kall. Feilede forsøk teller
  også, slik at gjentatte forsøk ikke omgår grensen. Dette er kallgrenser,
  ikke en garantert kronegrense. OpenAI-prosjektets budsjettvarsler og faktisk
  modellpris må følges opp separat. Bruk en egen prosjektnøkkel for RIGOR.
- AI foreslår kolonner, ikke priser eller produktkonverteringer. Usikre felt
  skal være `null`. Prisnøkkel er en RIGOR-post, ikke et varenummer.
- Pakningspriser, stykkpriser, priser inkl. MVA og rå produktpriser kan ikke
  automatisk brukes i dagens m²-samleposter. Brukeren må omregne og angi
  riktige prisnøkler. Produktbibliotek/mengdeoppskrifter gjenstår.

## Validering

`node tests/import-map-backend.test.mjs` tester backend med simulerte
Supabase/OpenAI-responser, inkludert autentisering, administratorrettighet,
kvote og ugyldige forslag. `node tests/kalkyle-import.test.mjs` tester lokal
kolonnekobling. Node 24 støtter TypeScript-filen brukt av backend-testen.

SQL og ekte API-kall er ikke validert mot produksjonsprosjektet i denne
arbeidsøkten; deploy-tilgang, OpenAI-nøkkel og Supabase-runtime manglet.
Gjennomfør funksjonskontrollen over etter aktivering.

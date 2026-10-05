# RIGOR website

Nettside for **RIGOR – Rådgivende ingeniører**.

## Innhold

- Responsiv én-sides nettside
- RIGOR-profil med kullgrått, varm bronse og lys bakgrunn
- Fagområder: Tegning/BIM, byggesaksunderlag, konstruksjon, tilstand/skade og materialer/betong
- Mobilmeny og diskrete scroll-animasjoner
- Klar for GitHub Pages

## Lokal forhåndsvisning

```bash
python -m http.server 8080
```

Åpne deretter `http://localhost:8080`.

## Før publisering

Bytt kontaktinformasjon og organisasjonsnummer i `index.html` når dette er klart.

## GitHub Pages

1. Gå til **Settings → Pages**.
2. Velg **GitHub Actions** som kilde.
3. Push til `main` utløser publisering.

## Kalkyleverksted (prototype)

Åpne `kalkyle.html` via den lokale HTTP-serveren. Enkel veiviser og detaljert
postredigering deler samme beregningsmotor. Jobbmaler finnes for tak,
utvendig etterisolering og et grovt tilbyggsbudsjett. Arbeidstider og jobbmaler er
illustrerende eksempler og må kvalitetssikres før bruk i tilbud. Materialprisene
velges fra importert prisliste eller publisert prisregister. Demonstrasjon med
eksempelpriser må velges eksplisitt. Takgeometrien forutsetter lik takvinkel; stillas, avfall og
tekniske fag bruker forenklede avsetninger. Valgte poster er ikke en garanti
for komplett omfang. Beregninger beholder desimalpresisjon frem til visning.

Kalkyler lagres lokalt i nettleseren og kan eksporteres til CSV. Ingen AI,
skylagring eller kundedata er koblet til. Siden er en offentlig statisk
prototype, ikke et tilgangsbeskyttet portalverktøy. Portalens verktøyliste
viser prototypen for administrator dersom `kalkyle` ikke er registrert. En
eksplisitt deaktivert registrering respekteres. Andre brukere får lenken når
et aktivert verktøy med `tool_key = kalkyle` finnes og de har verktøytilgang.
Denne endringen oppretter ingen
Supabase-rader eller tilganger. Beskyttelse av fremtidige kundedata og
AI-nøkler må håndheves i en autentisert backend, ikke i GitHub Pages.

Kjør beregningstestene med `node --test tests/kalkyle-engine.test.mjs`.


### Prisgrunnlag og CSV-import

Velg **Importer prisliste**, last ned CSV-malen og fyll inn priser for jobbens
prisnøkler. Format: `prisnokkel;enhet;pris;kilde;dato;valuta;mva`.
Enhet må være `m2`, valuta `NOK`, MVA `ekskl` og dato `ÅÅÅÅ-MM-DD`.
Desimalkomma og sitert CSV støttes. Import er lokal i nettleseren; Excel må
først eksporteres til CSV. Importen avvises samlet ved ugyldige rader og beholder
gjeldende prisgrunnlag. Duplikate prisnøkler avvises.

Dagens jobbmaler er samleposter. Prisene må derfor være samlet innkjøpskostnad
per m² for posten, ikke rå butikkpriser per pakke, løpemeter eller stykk. Det
kreves en produkt- og mengdeoppskrift før individuelle leverandørvarer kan
omregnes automatisk. Rigg, avfall og tekniske fag er kostnadsavsetninger og må
også ha dokumentert grunnlag eller en eksplisitt manuelt satt pris.

**Bruk markedspriser** henter `assets/market-prices.json` med `cache: no-store`.
Ingen ekte kilde er foreløpig tilkoblet: valget viser dette og gir ingen totalpris.
Fremtidig leverandørintegrasjon må publisere `{ "prices": [...] }`, der hver
rad har samme felt som CSV-formatet (numerisk `pris`). Ikke legg leverandørens
innloggingsdata eller API-nøkler i GitHub Pages. Avtalepriser bør hentes via en
autentisert backend og ikke publiseres i det offentlige prisregisteret.

Kilde og dato vises per post og følger med CSV-eksport og lokal lagring.
Priser eldre enn 30 dager eller med fremtidig dato brukes ikke. Dersom en valgt
post mangler pris, vises arbeidstimer, men ingen samlet kostnad eller salgspris;
CSV-eksport av kalkylen venter på komplette priser. Manuelle priser merkes som
manuelle og overstyrer katalogen til brukeren velger nytt prisgrunnlag.

Kjør også `node tests/kalkyle-prices.test.mjs` for import- og datokontroller.

### Importassistent

CSV-kolonner kan kobles med forhåndsvisning og eksplisitt bekreftelse før
hele prislisten importeres. Faste regler brukes først; en valgfri AI-knapp
sender høyst åtte rader til en autentisert Supabase Edge Function.
Backend må aktiveres separat: se [AI-IMPORT.md](supabase/AI-IMPORT.md).
Nøkler lagres bare i Supabase, aldri i GitHub Pages. PDF/OCR og automatisk
produkt-til-kalkylekobling er ikke implementert.

Tester: `node tests/kalkyle-import.test.mjs` og
`node tests/import-map-backend.test.mjs` (Node 24).

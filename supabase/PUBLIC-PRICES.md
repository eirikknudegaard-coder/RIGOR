# Automatisk offentlig priskontroll uten AI

Denne innhentingen kjøres i `.github/workflows/public-prices.yml` hver sjette time og ved endringer i innhentingskoden. GitHub Actions leverer det genererte registeret til GitHub Pages. Supabase eller en OpenAI-nøkkel er ikke nødvendig for denne løsningen.

`data/market-prices.json` inneholder prisobservasjoner og kjørestatus. `data/market-queue.json` viderefører oppdagede produktadresser og kontrolltider mellom kjøringer. En vanlig nettstedspublisering viderefører registeret med `scripts/retain-price-register.mjs`.

Priskontrollen leser leverandørenes robots.txt og publiserte sitemaps. Den prioriterer isolasjon, sløyfer/lekter, konstruksjonsvirke, plater, membraner, takvarer, kledning, terrassebord, gips og innfesting. Den følger en kø gjennom sortimentet i avgrensede puljer, foreløpig maks 120 sider per kjøring. Dette gir ikke full dekning av alle varer hvert døgn. Bare prisobservasjoner under 24 timer brukes.

En pris krever entydig produkt, produkt-ID, offentlig NOK-tilbud, dokumentert prisenhet, MVA-status og bekreftet lager. Den normaliseres til NOK ekskl. MVA per m, m² eller stk. Dokumenterte prisreferanser omregnes til enhetspris. Prisreferansen behandles ikke som dokumentasjon på fysisk pakningsinnhold, og slike priser rundes ikke opp til hele pakninger; udokumentert pakningsinnhold, medlemsvilkår, lokale priser og fra-priser brukes ikke. Manglende data er feil, ikke en antakelse om pris.

I kalkylen velges konkret produkt og dimensjon til hver materialpost. Valget lagres per prosjekt og følger samme produkt ved neste registeroppdatering. Motoren bytter ikke automatisk spesifikasjon eller dimensjon for å velge den billigste varen. Priser med kildefeil, utløpt kontrolltid, endret produkt/enhet eller prisendring over 50 % sperres. Manuelle priser beholdes ved henting av registeret; et eksplisitt produktvalg erstatter bare prisen til den aktuelle prisnøkkelen. Frakt inngår ikke.

Kjør lokalt med `node scripts/sync-public-prices.mjs` og test med `node tests/market-public.test.mjs`. Nettlesertesten `tests/market-public-browser.py` sjekker prosjektvalg, prisoppdatering og sperring av feil. Oppgi `RIGOR_CATALOG_BASE_URL=https://rigor.no` for å videreføre det publiserte registeret. Uten denne variabelen brukes filene fra arbeidsmappen.

Første produksjonskontroll 6. oktober 2026 oppdaget 7 207 adresser og kontrollerte 120 sider, men godkjente ingen priser fordi produktformatet ikke samsvarte med parseren. Leverandørformatene undersøkes med `scripts/probe-material-pages.mjs`; kjørestatus og diagnostikk må kontrolleres før man hevder at prisinnhenting fungerer. Fixturetester bekrefter regelmotoren, ikke faktisk leverandørdekning.

Supabase-varianten og administrasjon av egne registrerte produktgrupper er fortsatt separat, beskrevet i `MARKET-PRICES.md`. Denne er ikke aktivert av GitHub-løsningen.

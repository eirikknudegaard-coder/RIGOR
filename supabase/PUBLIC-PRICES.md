# Automatisk offentlig priskontroll uten AI

Denne innhentingen kjøres i `.github/workflows/public-prices.yml` hver sjette time og ved endringer i innhentingskoden. GitHub Actions leverer det genererte registeret til GitHub Pages. Supabase eller en OpenAI-nøkkel er ikke nødvendig for denne løsningen.

`data/market-prices.json` inneholder prisobservasjoner, de siste 40 jobbene og inntil 4 000 historiske prisendringer. Uendret pris gir ingen duplikat i prishistorikken. `data/market-queue.json` viderefører oppdagede produktadresser og kontrolltider mellom kjøringer. En vanlig nettstedspublisering viderefører registeret med `scripts/retain-price-register.mjs`.

Priskontrollen leser leverandørenes robots.txt og publiserte sitemaps. Den prioriterer isolasjon, sløyfer/lekter, konstruksjonsvirke, plater, membraner, takvarer, kledning, terrassebord, gips og innfesting. Bekreftede produkter prioriteres ved fornyet kontroll. Nye kontroller fordeles mellom materialfamilier, slik at trevirke, lekter og plater sjekkes sammen med isolasjon. Den følger en kø gjennom sortimentet i avgrensede puljer, foreløpig maks 120 sider per kjøring. Dette gir ikke full dekning av alle varer hvert døgn. Bare prisobservasjoner under 24 timer brukes.

En pris krever entydig produkt, produkt-ID, offentlig NOK-tilbud, dokumentert prisenhet, MVA-status og bekreftet lager. Den normaliseres til NOK ekskl. MVA per m, m² eller stk. Dokumenterte prisreferanser omregnes til enhetspris. Prisreferansen behandles ikke som dokumentasjon på fysisk pakningsinnhold, og slike priser rundes ikke opp til hele pakninger; udokumentert pakningsinnhold, medlemsvilkår, lokale priser og fra-priser brukes ikke. Manglende data er feil, ikke en antakelse om pris.

I kalkylen velges konkret produkt og dimensjon til hver materialpost. Valget lagres per prosjekt og følger samme produkt ved neste registeroppdatering. Motoren bytter ikke automatisk spesifikasjon eller dimensjon for å velge den billigste varen. Priser med kildefeil, utløpt kontrolltid, endret produkt/enhet eller prisendring over 50 % sperres. Manuelle priser beholdes ved henting av registeret; et eksplisitt produktvalg erstatter bare prisen til den aktuelle prisnøkkelen. Frakt inngår ikke.

Kjør lokalt med `node scripts/sync-public-prices.mjs` og test med `node tests/market-public.test.mjs`. Nettlesertesten `tests/market-public-browser.py` sjekker prosjektvalg, prisoppdatering og sperring av feil. Oppgi `RIGOR_CATALOG_BASE_URL=https://rigor.no` for å videreføre det publiserte registeret. Uten denne variabelen brukes filene fra arbeidsmappen.

Produksjonskontrollen 6. oktober 2026 kl. 14:00 UTC publiserte de første reelle prisene. Obs sin Hunton Nativo-serie har fire bekreftede tykkelser: 50, 100, 150 og 200 mm. For 100 mm er tilbudet 489 kr inkl. MVA per pakke med 2,8 m². Dette gir 391,20 kr ekskl. MVA per pakke og 139,71 kr/m². MVA er bekreftet fra Obs sine kjøpsvilkår, som hentes og kontrolleres ved hver kjøring. Varianten på 70 mm avvises fordi pakningsarealet ikke er dokumentert i den hentede beskrivelsen.

Obs sin primære prisdel har et eget `data-test-id="product-price-section"` med `aria-description`. Den inneholder full pris med kroner/øre og eksplisitt enhet. Parseren krever at beløpet stemmer med samme SKU sitt strukturerte tilbud. Dette støtter løpemeter på sløyfer/lekter og trevirke. Enkeltplater med dokumenterte mål omregnes fra stykk til m²; antall plater rundes opp i kalkylen. Et priset «stk» som i virkeligheten er en 100-pakning behandles ikke som én skrue eller plugg.

Byggmax sine kontrollerte sider bruker dynamisk pris- og lagerstatus med butikkvalg. Siden opplyser uttrykkelig at prisene varierer mellom butikker. Den har også betingede «Fra»-felt og Microdata-priser, men den aktuelle kjøringens HTML gir ikke et entydig offentlig tilbud med bekreftet butikk, pris, prisenhet, MVA og lager. Slike observasjoner holdes utenfor kalkylen. Automatisk sammenligning mellom kjedene er derfor ikke aktiv. Produkt-ID alene erstatter ikke krav om dokumenterte spesifikasjoner eller EAN/NOBB.

Leverandørformatene undersøkes med `scripts/probe-material-pages.mjs`. Faktisk innhentede dokumentutdrag ligger i `tests/fixtures/obs-public-evidence-20261006.json` og brukes til regresjonstester. Vanlige fixturetester bekrefter regelmotoren, ikke leverandørdekning. Kjørestatus og ferske publiserte tilbud må alltid kontrolleres separat.

Supabase-varianten og administrasjon av egne registrerte produktgrupper er fortsatt separat, beskrevet i `MARKET-PRICES.md`. Denne er ikke aktivert av GitHub-løsningen.

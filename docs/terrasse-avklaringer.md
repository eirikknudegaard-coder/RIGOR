# Faglige avklaringer for terrasse

Kildekontroll: 7. oktober 2026. Disse åpne norske veiledningene er lest for å
kontrollere hvilke opplysninger som normalt påvirker en terrasses omfang,
materialvalg og pris. De er ikke en prosjektering av en bestemt konstruksjon.

| Opplysning | Hvorfor den er relevant | Kontroll i appen |
| --- | --- | --- |
| Hva som skal bygges, skiftes eller rives; hva som beholdes | Nytt dekke, nytt bjelkelag og nye fundamenter er ulike arbeider | AI skal spørre ut fra faktisk omfang; ved kun riving fjernes spørsmål om nye bordmaterialer |
| Areal, lengde og bredde | Mengder, tilpasninger og rammeverk krever riktige mål | Tall med m² eller m; terrasseareal lagres ikke som takareal |
| Høyde over terreng og adkomst | Fundamentering, utførelse og fallsikring avhenger av høyde | Tall i m; avklart høyde gjentas ikke som ubesvart spørsmål |
| Grunnforhold og fundamenter | Drenering, tele og grunnens bæreevne påvirker fundamentering | Grunnforhold som valg; ukjente forhold får «Ikke avklart» |
| Understøttelse, fri spennlengde, bjelkedimensjon og senteravstand | Konstruksjon og valgt terrassedekke må passe sammen | Spenn i m, senteravstand i mm, oppgitt/prosjektert bjelkedimensjon som tekst; ingen universell godkjent c/c-avstand |
| Terrassebordmateriale, dimensjon og overflate | Pris, holdbarhet, vedlikehold og monteringsanvisning varierer | Egne nedtrekksvalg for materiale og glatt/rillet/ru; vanlige treborddimensjoner som valg, andre ønsker i tekst |
| Synlig eller skjult innfesting | System og skruer må passe til produkt og bruksmiljø | Valg med påminnelse om produktets monteringsanvisning |
| Rekkverkstype, lengde og oppgitt/prosjektert høyde | Omfang og utforming må sikre mot fall og klatring | Type som valg; mål som tall; prosjektert utførelse og øvrige detaljer som tekst |
| Trapp, avslutninger, tilkomst, riving og avfall | Tillegg prises bare hvis de inngår i arbeidet | AI avklarer behov ut fra beskrivelsen og bibliotekets faktiske oppgaver |

«Stående eller liggende terrassebord» er et feilaktig kledningsspørsmål og
fjernes både på serveren og i klienten. Et eventuelt rett eller diagonalt
leggemønster er et annet spørsmål. Retning på faktisk kledning beholdes når
prosjektet også inneholder kledningsarbeid.

Liggende rekkverksspiler kan gi klatremulighet. De tilbys derfor ikke som et
ubetinget standardvalg. TEK17 § 12-15 må legges til grunn for den faktiske
utformingen; kundens materialvalg eller oppgitte høyde er ikke en godkjenning.

## Kilder som er lest

- [Montér: Slik bygger du terrasse](https://www.monter.no/byggeprosjekter/slik-bygger-du-terrasse).
  Omfang fra fundamentering til ramme, dekke, innfesting, trapp og skjerming.
  Grunnforhold, plassering og ekstra belastning inngår i planleggingen.
- [Montér: Hvordan lage fundament til terrasse?](https://www.monter.no/byggeprosjekter/slik-bygger-du-terrasse/hvordan-lage-fundament-til-terrasse).
  Grunnforhold, frost, snø og bæreevne må vurderes. Nettstedet oppgir ikke en
  universell godkjent dimensjon eller c/c-avstand for alle terrasser.
- [Montér: Velg riktig terrassebord](https://www.monter.no/tips-og-inspirasjon/terrasse/hvilke-terrassebord-skal-jeg-velge-her-far-du-oversikten).
  Trykkimpregnert furu, royalimpregnert tre, termofuru, Kebony, Accoya og
  kompositt er ulike alternativer. Glatt, ru og rillet overflate omtales.
  Vedlikehold og monteringsdetaljer varierer med materiale og produkt.
- [Byggmakker: Bygge terrasse? Dette må du vite](https://www.byggmakker.no/rad-og-guider/terrasse-og-uterom/alt-du-trenger-a-vite-for-a-bygge-terrasse).
  Materialvalg, vedlikehold, klima/tele og synlig/skjult innfesting omtales.
  28 × 120 og 28 × 145 mm er konkrete treborddimensjoner vist i veiledningen.
  Disse er valg i skjemaet, ikke en påstand om kompatibilitet med alle produkter.
- [Direktoratet for byggkvalitet: TEK17 § 12-15, Utforming av rekkverk](https://www.dibk.no/regelverk/byggteknisk-forskrift-tek17/12/iii/12-15).
  Offisiell bestemmelse og veiledning om høyde, åpninger, glass og klatring.
  Veiledningen sier at liggende spiler som gjør klatring lett må unngås med
  mindre rekkverket utformes slik at det blir umulig å klatre over.

Spørsmålene er deterministisk klassifisert i `terrace-questions.js`, delt av
serveren og klienten. AI får også instruksjoner om faglig relevant omfang og å
bruke allerede oppgitte svar. Ukjente mål, priser, timer og godkjenninger gjettes
ikke. Kildelenkene vises under «Hvorfor spør vi om dette?» i terrasseforslaget.

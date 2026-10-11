# Byggested, snø og vind

11. oktober 2026: stedlige spørsmål og et eget lastgrunnlag i RIGOR Konstruksjon.
«Byggested, snø og vind» åpner samme deterministiske skjema fra AI-/manuell
inngang. AI registrerer bare sitert byggested og geometri, aldri normverdier.

## Datagrunnlag

Kommunelisten har 357 kommuner hentet 11. oktober fra
[Kartverkets kommuneinfo](https://ws.geonorge.no/kommuneinfo/v1/kommuner).
Den inneholder navn/nummer og **ingen lastverdier**. Våler og Herøy finnes i
to kommuner hver; navn alene blir derfor ikke valgt automatisk.

Lastverdier er visuelt transkribert fra brukerens ZIP `NS-EN-1991-1-1-4 Vind'`:

- Snø: «Karakteristisk snølast VEST 1», «VESTAUST 2» og tabellhode
  «Karakteristisk snølast». Formfaktorbildet angir
  NS-EN 1991-1-3:2003+A1:2015+NA:2018.
- Vind: «Referansevindhastighet» og norsk «Terrengruhetskategori».
  Vindutdraget «c0 3» angir NS-EN 1991-1-4:2005+NA:2009.
- Formler: «Formler og symboler», «Formfaktor Snølast», «Saltak 1/2»,
  «Pulttak», «Forskjellige Topografier», «Stedvindshastighet»,
  «Vindhastighetstrykk» og «Bassisvindhastighet og Grunnverdier».

Dette er **vedleggsutgaver**, ikke et automatisk oppdatert eller verifisert
gjeldende norsk NA-register. Originalbildene publiseres ikke i repoet.
Lastregisteret dekker de avbildede områdene i Agder og tre vindområder i
Telemark. Andre kommuner trenger dokumenterte prosjektverdier; ingen
nabokommunes last, gjennomsnittsverdi eller AI-verdi fylles inn.

Kristiansand spør etter tidligere Kristiansand/Søgne/Songdalen, Lindesnes etter
Lindesnes/Mandal/Marnardal og Lyngdal etter Lyngdal/Audnedal. Bykle, Sirdal og
Flekkefjord spør om delområdet nær Rogaland. Det brukes aldri en tilfeldig verdi
for hele den moderne kommunen. Registerreferanser og manuelle overstyringer
beholder hver sin kilde i JSON-grunnlaget.

## Spørsmål og beregninger

Kommune og høyde **over havet** spørres først ved stedlige laster. Vind trenger
også referansehøyde **over terrenget**, terreng på vindsiden, ås-/skrentvirkning
og terrengoverganger. Takform, vinkel, eksponering, snøfangere, lokale snødriver
og varmeavgivende tak avklares i lastskjemaet. Kommune alene er ikke nok.

Snø: marklast sk, taklast s = μ × Ce × Ct × sk og tre lastmønstre for saltak
med lik vinkel. Oppgitt snøfanger/hindring hindrer reduksjon av μ under 0,8.
Et enkelt tak uten lokale snødriver støttes; parapet, sprang, høyere nabobygg,
sammensatte og varmeavgivende tak krever andre lasttilfeller. Ce-valgene følger
den avbildede EN-tabellen og Ct=1 for vanlig tak; prosjektets NA må kontrolleres.

Marklasten hentes automatisk **bare opp til tabellens Hg**. Δsk og maksimum er
bevart i registeret, men vedlegget mangler den tilhørende høydeformelen. Over
grensen må en dokumentert marklast ved faktisk høyde oppgis. Dette er en reell
datamangel; det antas ikke at Δsk skal legges til lineært eller trinnvis.

Vind: norsk ruhetstabell bruker kr/z0/zmin = 0,16/0,003/2;
0,17/0,01/2; 0,19/0,05/4; 0,22/0,3/8; 0,24/1/16 for 0/I/II/III/IV.
Disse minimumshøydene er forskjellige fra EN-tabellen. For bekreftet enkelt,
flatt terreng uten ruhetsovergang brukes cr = kr ln(max(z,zmin)/z0),
vm = cr × vb og qp = (1+7Iv) × ρ × vm²/2. Hele året og alle retninger brukes,
uten gunstige reduksjoner av cdir/cseason.

NA-regelen for høydekorreksjon og turbulens er ikke med i utsnittene. Vindens
høydefaktor og Iv ved referansehøyden må derfor oppgis med dokumentert kilde.
Ås, skrent, traktvirkning og terrengoverganger blir egne avklaringer og gir
ingen gjettet qp. 1,25 kg/m³ er en synlig EN-anbefaling, ikke en automatisk
stedlig tetthetsbestemmelse.

qp er **vindkasttrykk**, ikke ferdig vindlast på tak/vegg eller kapasitet.
cpe/cpi, soner, referanseareal, vindretning, sug, innfesting og global stabilitet
gjenstår. Vind overføres aldri som positiv tyngdelast til bjelke-/terrassemodellen.

## Overføring og kontroll

Brukeren kontrollerer prosjektets normutgaver og forutsetninger før snølast kan
overføres. Dette er en brukerbekreftelse; den påstår ingen maskinell kontroll av
standarddokumentet. Snøverdien og kilde/formel kan brukes i taksamtalen eller
terrasseskjemaet. Lastbredde, egenvekt, bæring og øvrige laster avklares videre.
En bjelkemodell kontrollerer ikke hele takets asymmetriske lastmønstre.

Endring av byggested, høyde, takvinkel eller takform fjerner overført stedlig
snølast. Endringer i lastskjemaet fjerner normbekreftelsen og resultatet.
Ingen prosjektdata skrives eksternt; JSON kan lastes ned separat.

AI-kontrakt versjon 4 inkluderer bare de nye sitatbaserte stedlige feltene.
Backend filtrerer dem bort for eldre klienter og publiseres før klienten.
Backendens nye delte avhengigheter er `municipalities.js`, `weather-context.js`
og `weather-register.js`. Browserens `site-load-ui.js` importeres ikke på serveren.

Tester omfatter kommunegrenser, høydegrenser, snøfangere, skjev snølast,
NA-ruhet, uavhengig vindtrykkeksempel, manglende normdata, kildeoverstyring,
backendens versjonsfilter og nettleserflyt med etterfølgende høydeendring.

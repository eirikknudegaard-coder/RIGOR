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
utvendig etterisolering og et grovt tilbyggsbudsjett. Satser og grunntider er
illustrerende eksempler og må erstattes med kvalitetssikrede RIGOR-data før
bruk i tilbud. Takgeometrien forutsetter lik takvinkel; stillas, avfall og
tekniske fag bruker forenklede avsetninger. Valgte poster er ikke en garanti
for komplett omfang. Beregninger beholder desimalpresisjon frem til visning.

Kalkyler lagres lokalt i nettleseren og kan eksporteres til CSV. Ingen AI,
skylagring eller kundedata er koblet til. Siden er en offentlig statisk
prototype, ikke et tilgangsbeskyttet portalverktøy. Portalens verktøyliste
lenker til siden når et aktivert verktøy med `tool_key = kalkyle` finnes og
brukeren har eksisterende verktøytilgang; denne endringen oppretter ingen
Supabase-rader eller tilganger. Beskyttelse av fremtidige kundedata og
AI-nøkler må håndheves i en autentisert backend, ikke i GitHub Pages.

Kjør beregningstestene med `node --test tests/kalkyle-engine.test.mjs`.

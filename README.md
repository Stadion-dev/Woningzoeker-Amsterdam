# Woningzoeker Amsterdam

Een Nederlandstalige PWA voor koopwoningen in Amsterdam-West, Amsterdam-Zuid en de Rivierenbuurt. De buurtgids bevat drie buurtpareltjes. Per buurt kun je een prijsberekening bekijken. Bij aangesloten aanbod toont de app de vraagprijs en vraagprijs per vierkante meter per woning. Zoekvoorkeuren en favorieten worden lokaal in de browser bewaard.

## Zoekinstellingen

Combineer buurten, viercijferige postcodegebieden, woningtypen, maximale vraagprijs en minimale woonoppervlakte. Meerdere postcodes of woningtypen binnen één filter zijn alternatieven. De filters worden samen toegepast op het woningaanbod. Sorteer op publicatiedatum, vraagprijs, woonoppervlakte of vraagprijs per m². Bij sortering op nieuwste eerst staan woningen zonder publicatiedatum onderaan.

## Lokaal gebruiken

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. Op localhost en HTTPS werkt de service worker. Zodra de eerste laadbeurt is afgerond, zijn de buurtgids en laatst opgehaalde gegevens ook offline beschikbaar. Installeren kan via een browser die PWA-installatie ondersteunt.

## Bronnen en dagelijkse update

- [CBS StatLine](https://www.cbs.nl/nl-nl/cijfers/detail/83625NED) levert de gemiddelde verkoopprijs van bestaande koopwoningen in de gemeente Amsterdam. Deze stadsbrede jaarwaarde is marktcontext. De app berekent de vraagprijs per m² met gegevens van de betreffende woning.
- Voor actueel koopaanbod ondersteunt de app een HTTPS-JSON-feed waarvoor de aanbieder herpublicatie van de gebruikte velden toestaat. Er is standaard geen aanbieder geconfigureerd. De buurtpagina's gebruiken herkenbaar gemarkeerde rekenvoorbeelden. De sfeerbeelden zijn gegenereerd en dienen als buurtimpressie.

De workflow **Dagelijkse woningupdate** draait dagelijks rond 05.17 UTC (06.17 of 07.17 in Amsterdam) en kan handmatig worden gestart via **Actions**. De workflow schrijft een gewijzigde momentopname naar `data/aanbod.json` op de standaardbranch. Die branch moet pushes van GitHub Actions toestaan. Bij een bronfout blijft de vorige succesvolle momentopname van die bron beschikbaar.

Voor lokaal verversen is alleen Python nodig.

```sh
python3 scripts/update_data.py
```

Voeg voor een toegestane feed in GitHub Actions het secret `LISTINGS_FEED_URL` en de repositoryvariabele `LISTINGS_SOURCE_NAME` toe. Publiceer alleen gegevens waarvoor je de benodigde toestemming hebt. De feed moet het volledige actuele aanbod voor de ondersteunde buurten leveren, met stabiele unieke ID's, prijzen in euro en woonoppervlaktes in vierkante meter. De ID mag letters, cijfers, punten, streepjes en underscores bevatten. `description` is optioneel. Geef voor postcodefilters `postcode` op als Nederlandse postcode of viercijferig postcodegebied. De openbare momentopname bewaart alleen de eerste vier cijfers. Gebruik voor `type` een van `appartement`, `woonhuis`, `studio`, `maisonnette` of `overig`. Geef voor sortering op nieuwste eerst `publishedAt` op als ISO-datum of ISO-tijdstip met tijdzone. Oudere feeds mogen deze velden weglaten. Aanbod zonder postcode of type blijft zichtbaar zolang het overeenkomstige filter leeg is.

```json
{
  "homes": [
    {
      "id": "12345",
      "area": "west",
      "title": "Voorbeeldwoning",
      "description": "Appartement met balkon",
      "postcode": "1056",
      "type": "appartement",
      "publishedAt": "2026-11-22T09:00:00+01:00",
      "price": 485000,
      "size": 66,
      "url": "https://aanbieder.example/woningen/12345"
    }
  ]
}
```

Gebruik `west`, `zuid` of `rivierenbuurt` voor `area`. Wijs woningen in de Rivierenbuurt toe aan `rivierenbuurt`, zodat elk aanboditem één gebied heeft.

## Publiceren via GitHub Pages

Kies **GitHub Actions** als bron onder **Settings → Pages** en stel de repositoryvariabele `ENABLE_PAGES` in op `true`. Start daarna **Publiceer de PWA** handmatig. Die workflow draait vervolgens na pushes naar `main` en na de dagelijkse woningupdate.

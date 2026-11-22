"""Refresh CBS context and, if configured, a permitted housing feed."""

import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode, urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "aanbod.json"
TABLE = "83625NED"
CBS_API = f"https://opendata.cbs.nl/ODataApi/odata/{TABLE}"
AREAS = {"west", "zuid", "rivierenbuurt"}
HOME_TYPES = {"appartement", "woonhuis", "studio", "maisonnette", "overig"}
MAX_BYTES = 5_000_000


def https_url(value):
    parsed = urlsplit(value)
    if (
        parsed.scheme != "https" or not parsed.hostname
        or parsed.username is not None or parsed.password is not None
        or any(char.isspace() or char == "\\" for char in value)
    ):
        raise ValueError("Een bron-URL moet HTTPS gebruiken, zonder inloggegevens.")
    return value


def fetch_json(url):
    with urlopen(https_url(url), timeout=25) as response:
        https_url(response.geturl())
        payload = response.read(MAX_BYTES + 1)
    if len(payload) > MAX_BYTES:
        raise ValueError("De bron overschrijdt de limiet van 5 MB.")
    return json.loads(payload)


def cbs_benchmark():
    properties = fetch_json(f"{CBS_API}/DataProperties")["value"]
    metric = next(
        row["Key"] for row in properties
        if row.get("Type") == "Topic" and "gemiddelde verkoopprijs" in row["Title"].lower()
    )
    regions = [row["Key"] for row in properties if row.get("Type") == "Dimension"
               and ("regio" in row["Key"].lower() or "regio" in row["Title"].lower())]
    if len(regions) != 1:
        raise ValueError("De CBS-regiodimensie is gewijzigd.")
    region = regions[0]
    query = urlencode({
        "$filter": f"startswith({region},'GM0363')",
        "$select": f"Perioden,{metric}",
        "$orderby": "Perioden desc",
        "$top": 30,
    })
    rows = fetch_json(f"{CBS_API}/TypedDataSet?{query}")["value"]
    for row in sorted(rows, key=lambda item: item["Perioden"], reverse=True):
        period = row["Perioden"]
        if re.fullmatch(r"\d{4}JJ00", period) and positive(row[metric]):
            return {
                "period": period[:4],
                "price": row[metric],
                "url": f"https://www.cbs.nl/nl-nl/cijfers/detail/{TABLE}",
            }
    raise ValueError("Geen jaarcijfer gevonden voor de gemeente Amsterdam.")


def positive(value):
    return type(value) in (int, float) and 0 < value < 1_000_000_000 and math.isfinite(value)


def text_field(value, limit):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError("Verplicht tekstveld is leeg of te lang.")
    return value.strip()


def search_metadata(row):
    fields = {}
    if row.get("postcode") is not None:
        postcode = text_field(row["postcode"], 12)
        if not re.fullmatch(r"[1-9][0-9]{3}(?: ?[A-Za-z]{2})?", postcode):
            raise ValueError("Ongeldig Nederlands postcodegebied.")
        fields["postcode"] = postcode[:4]
    if row.get("type") is not None:
        home_type = text_field(row["type"], 24).lower()
        if home_type not in HOME_TYPES:
            raise ValueError("Onbekend woningtype in de feed.")
        fields["type"] = home_type
    if row.get("publishedAt") is not None:
        published_at = text_field(row["publishedAt"], 45)
        if re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", published_at):
            published_at += "T00:00:00Z"
        published = datetime.fromisoformat(published_at)
        if published.tzinfo is None:
            raise ValueError("Een publicatietijd moet een tijdzone bevatten.")
        fields["publishedAt"] = published.astimezone(timezone.utc).isoformat()
    return fields


def allowed_feed(payload, source):
    items = payload["homes"]
    if not isinstance(items, list):
        raise ValueError("Het veld homes moet een lijst zijn.")
    homes = []
    seen = set()
    for row in items:
        area = row["area"]
        if area not in AREAS:
            raise ValueError("Onbekend gebied in de feed.")
        raw_id = text_field(row["id"], 100)
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", raw_id) or raw_id in seen:
            raise ValueError("Woning-ID ontbreekt, bevat ongeldige tekens of komt dubbel voor.")
        seen.add(raw_id)
        if not positive(row["price"]) or not positive(row["size"]):
            raise ValueError("Vraagprijs en woonoppervlakte moeten positieve getallen zijn.")
        homes.append({
            "id": f"aanbod-{raw_id}",
            "area": area,
            "title": text_field(row["title"], 150),
            "description": text_field(row["description"], 1000) if row.get("description") else "",
            "price": row["price"],
            "size": row["size"],
            "url": https_url(text_field(row["url"], 2000)),
            **search_metadata(row),
        })
    return {"source": text_field(source, 120), "homes": sorted(homes, key=lambda home: home["id"])}


def main():
    data = json.loads(OUTPUT.read_text(encoding="utf-8"))
    before = dict(data)
    failures = False
    try:
        data["benchmark"] = cbs_benchmark()
    except (OSError, ValueError, KeyError, StopIteration, TypeError) as exc:
        print(f"CBS-update mislukt ({type(exc).__name__}). Vorig cijfer blijft beschikbaar.", file=sys.stderr)
        failures = True
    url = os.getenv("LISTINGS_FEED_URL")
    source = os.getenv("LISTINGS_SOURCE_NAME")
    if url or source:
        try:
            if not url or not source:
                raise ValueError("Stel beide feedvariabelen in.")
            data.update(allowed_feed(fetch_json(url), source))
            # Refresh date only when a feed was successfully checked.
            data["updatedAt"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        except (OSError, ValueError, KeyError, AttributeError, TypeError, OverflowError) as exc:
            print(f"Aanbodupdate mislukt ({type(exc).__name__}). Vorig aanbod blijft beschikbaar.", file=sys.stderr)
            failures = True
    elif data["source"] is not None:
        data.update({"source": None, "homes": [], "updatedAt": None})
    if data != before:
        temp = OUTPUT.with_suffix(".tmp")
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temp.replace(OUTPUT)
    return int(failures)


if __name__ == "__main__":
    sys.exit(main())

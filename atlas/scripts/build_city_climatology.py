"""Extract real twelve-month city normals from the atlas's exact ERA5 source.

This produces a small example-city JSON only. It never rewrites the existing
January/July grids. Data-source hashes, grid order, units, month order and
all extracted January/July cells are checked against the existing atlas.
"""
from __future__ import annotations
import gzip
import hashlib
import json
import math
import pathlib
import tempfile
import urllib.request

import numpy as np
import xarray as xr

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "cities" / "climatology.json"
BASELINE = "c54db25781a47b3067869e2adac73fcff4052928"
SOURCE_SHA = {
    "temperature": "450df4fded6bbbe63d7a73e1f6394058acdb91ce5cea1865752aba6bdc898996",
    "precipitation": "804178402ccce6231e9815df6abbf0fabda223626d396f0cc570657b07b6f09f",
}
CITIES = json.loads(r'''[
  {
    "id": "jerusalem",
    "name": "ירושלים",
    "country": "ישראל",
    "lon": 35.2,
    "lat": 31.8,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "london",
    "name": "לונדון",
    "country": "בריטניה",
    "lon": -0.1,
    "lat": 51.5,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "cairo",
    "name": "קהיר",
    "country": "מצרים",
    "lon": 31.2,
    "lat": 30,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "mumbai",
    "name": "מומבאי",
    "country": "הודו",
    "lon": 72.9,
    "lat": 19.1,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "manaus",
    "name": "מנאוס",
    "country": "ברזיל",
    "lon": -60,
    "lat": -3.1,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "sydney",
    "name": "סידני",
    "country": "אוסטרליה",
    "lon": 151.2,
    "lat": -33.9,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "new-york",
    "name": "ניו יורק",
    "country": "ארצות הברית",
    "lon": -74,
    "lat": 40.7,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "cape-town",
    "name": "קייפטאון",
    "country": "דרום אפריקה",
    "lon": 18.4,
    "lat": -33.9,
    "coordinateSource": "Existing atlas sample-location anchor, preserved unchanged"
  },
  {
    "id": "tromso",
    "name": "טרומסה",
    "country": "נורווגיה",
    "lon": 18.96,
    "lat": 69.65,
    "coordinateSource": "Requested Tromsø example anchor"
  },
  {
    "id": "reykjavik",
    "name": "רייקיאוויק",
    "country": "איסלנד",
    "lon": -21.936546,
    "lat": 64.143459,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159150587
  },
  {
    "id": "singapore",
    "name": "סינגפור",
    "country": "סינגפור",
    "lon": 103.853875,
    "lat": 1.294979,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151627
  },
  {
    "id": "bangkok",
    "name": "בנגקוק",
    "country": "תאילנד",
    "lon": 100.514699,
    "lat": 13.751945,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151509
  },
  {
    "id": "ulaanbaatar",
    "name": "אולן בטור",
    "country": "מונגוליה",
    "lon": 106.91467,
    "lat": 47.918619,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159150781
  },
  {
    "id": "yakutsk",
    "name": "יקוטסק",
    "country": "רוסיה",
    "lon": 129.735016,
    "lat": 62.034959,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159150745
  },
  {
    "id": "quito",
    "name": "קיטו",
    "country": "אקוודור",
    "lon": -78.501997,
    "lat": -0.213042,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159150847
  },
  {
    "id": "nairobi",
    "name": "ניירובי",
    "country": "קניה",
    "lon": 36.814711,
    "lat": -1.281401,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151597
  },
  {
    "id": "buenos-aires",
    "name": "בואנוס איירס",
    "country": "ארגנטינה",
    "lon": -58.432513,
    "lat": -34.610715,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151559
  },
  {
    "id": "santiago",
    "name": "סנטיאגו",
    "country": "צ׳ילה",
    "lon": -70.650504,
    "lat": -33.440205,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151615
  },
  {
    "id": "alice-springs",
    "name": "אליס ספרינגס",
    "country": "אוסטרליה",
    "lon": 133.880034,
    "lat": -23.700996,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151159
  },
  {
    "id": "phoenix",
    "name": "פיניקס",
    "country": "ארצות הברית",
    "lon": -112.067365,
    "lat": 33.448322,
    "coordinateSource": "Natural Earth 1:50m populated places",
    "coordinateSourceId": 1159151225
  }
]''')
CITY_SOURCE_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/ca96624a56bd078437bca8184e78163e5039ad19/geojson/ne_50m_populated_places_simple.geojson"

def sha256(content):
    return hashlib.sha256(content).hexdigest()

def nearest_index(lon, lat, height, width):
    # Match the nonnegative-index Math.round convention in layers.js.
    row = max(0, min(height-1, math.floor((90-lat)/.25 + .5)))
    col = math.floor((lon+180)/.25 + .5) % width
    return row, col

def main():
    old = json.loads((ROOT/"data/era5/manifest.json").read_text(encoding="utf-8"))
    assert old["period"].replace("–", "-") == "1991-2020"
    assert old["gridStepDegrees"] == .25
    assert len(CITIES) == 20 and len({c["id"] for c in CITIES}) == 20
    cities = [dict(c) for c in CITIES]
    sources = {}
    checked = 0
    with tempfile.TemporaryDirectory(prefix="atlas-city-normals-") as temp:
        for name, variable in [("temperature", "tas"), ("precipitation", "pr")]:
            layer = old["layers"][name]
            assert layer["sourceSha256"] == SOURCE_SHA[name], "Atlas source revision changed"
            url = layer["sourceUrl"]
            assert url.startswith("https://wbg-cckp.s3.us-west-2.amazonaws.com/data/era5-x0.25/")
            source_path = pathlib.Path(temp)/(variable+".nc")
            print("SOURCE_URL="+url, flush=True)
            urllib.request.urlretrieve(url, source_path)
            source_hash = sha256(source_path.read_bytes())
            assert source_hash == SOURCE_SHA[name], "Downloaded source differs from the original atlas"
            with xr.open_dataset(source_path, decode_times=False) as ds:
                assert ds.attrs.get("wb_period_label") == "1991-2020"
                assert np.array_equal(xr.decode_cf(ds).time.dt.month.values, np.arange(1, 13))
                candidates = [k for k,v in ds.data_vars.items()
                              if k.startswith(f"climatology-{variable}-monthly-") and v.ndim == 3]
                assert len(candidates) == 1, candidates
                array = ds[candidates[0]].squeeze(drop=True)
                latdim = next(d for d in array.dims if d.lower() in ("lat", "latitude"))
                londim = next(d for d in array.dims if d.lower() in ("lon", "longitude"))
                timedim = next(d for d in array.dims if d not in (latdim, londim))
                array = array.transpose(timedim, latdim, londim)
                assert array.sizes[timedim] == 12
                lat = np.asarray(array[latdim], dtype=float)
                lon = (np.asarray(array[londim], dtype=float)+180)%360-180
                lati = np.argsort(lat)[::-1]
                loni = np.argsort(lon)
                sorted_lat, sorted_lon = lat[lati], lon[loni]
                assert np.allclose(sorted_lat, layer["latitudes"])
                assert np.allclose(sorted_lon, layer["longitudes"])
                units = str(array.attrs.get("units", "")).lower().replace(" ", "")
                # These pinned CCKP products already supply Celsius and monthly mm.
                expected_units = ("degc", "c", "°c") if name == "temperature" else ("mm", "mm/month")
                assert units in expected_units, (name, units)
                height, width = len(sorted_lat), len(sorted_lon)
                old_frames = {}
                for month in (1, 7):
                    frame = layer["frames"][str(month)]
                    packed = (ROOT/frame["url"]).read_bytes()
                    assert sha256(packed) == frame["sha256"]
                    old_frames[month] = np.frombuffer(gzip.decompress(packed), dtype="<u2").reshape(height, width)
                for city in cities:
                    row, col = nearest_index(city["lon"], city["lat"], height, width)
                    values = np.asarray(array.isel({latdim:int(lati[row]), londim:int(loni[col])}), dtype=np.float64)
                    assert values.shape == (12,) and np.all(np.isfinite(values)), city["id"]
                    if name == "temperature":
                        assert np.all(values > -100) and np.all(values < 65), city["id"]
                    else:
                        assert np.all(values >= -.01) and np.all(values < 6000), city["id"]
                        values = np.maximum(values, 0)
                    encoded = np.rint((values-layer["offset"])*10).astype(np.uint16)
                    for month in (1, 7):
                        assert int(encoded[month-1]) == int(old_frames[month][row, col]), (name, city["id"], month)
                        checked += 1
                    city[name] = [round(float(int(v)/10 + layer["offset"]), 1) for v in encoded]
                    point = [float(sorted_lon[col]), float(sorted_lat[row])]
                    if "gridLon" in city:
                        assert point == [city["gridLon"], city["gridLat"]]
                    city["gridLon"], city["gridLat"] = point
                sources[name] = {
                    "variable": variable, "sourceUrl": url, "sourceSha256": source_hash,
                    "sourceVariable": candidates[0], "originalUnits": array.attrs["units"],
                    "conversion": "Source Celsius; nearest-grid extraction and 0.1-degree-Celsius quantization" if name == "temperature" else "Source monthly total millimeters; no multiplication by days; nearest-grid extraction and 0.1-mm quantization",
                }
            source_path.unlink()
    assert checked == 80
    result = {
        "schemaVersion": 1, "period": "1991-2020", "months": list(range(1, 13)),
        "gridStepDegrees": .25, "units": {"temperature": "°C", "precipitation": "mm/month"},
        "cities": cities,
        "source": {
            "provider": "World Bank CCKP / Copernicus ECMWF ERA5",
            "providerUrl": "https://climateknowledgeportal.worldbank.org/metadata",
            "baselineAtlasRevision": BASELINE,
            "layers": sources,
            "coordinateSource": {
                "name": "Natural Earth 1:50m populated places, plus preserved atlas anchors",
                "url": CITY_SOURCE_URL, "gitBlobSha": "3fad8f0038ba95c7758800f3f3c148418e7c76d1",
                "license": "Natural Earth coordinates are public domain",
                "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
                "note": "The first eight anchors are unchanged from the atlas; Tromsø uses the requested anchor. Other coordinates are point geometries, not the older latitude/longitude attributes, in the pinned Natural Earth file.",
            },
            "method": "All twelve months extracted independently from the source monthly climatology at the same nearest 0.25-degree cell used by the atlas. No temporal or spatial interpolation. Same 0.1 quantization as the existing map.",
            "validation": {"existingJanuaryJulyCellMatches": checked, "cityCount": 20, "monthsPerCity": 12},
            "limitations": [
                "Reanalysis grid-cell climate normals, not measurements at a city weather station.",
                "Nearest cells can include coast, mountain or nearby rural conditions; displayed marker identifies the city anchor, and gridLon/gridLat identify the sampled model cell.",
                "These are 1991-2020 average conditions, not a forecast or a single observed year.",
            ],
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    content = (json.dumps(result, ensure_ascii=False, separators=(",", ":"))+"\n").encode("utf-8")
    OUT.write_bytes(content)
    for city in cities:
        print("CITY_VALUES="+json.dumps({k:city[k] for k in ("id","gridLon","gridLat","temperature","precipitation")}), flush=True)
    print("CITY_DATA_BYTES="+str(len(content)), flush=True)
    print("CITY_DATA_SHA256="+sha256(content), flush=True)
    print("CITY_JANUARY_JULY_MATCHES="+str(checked), flush=True)
    print("CITY_CLIMATOLOGY_BUILD_PASSED", flush=True)

if __name__ == "__main__":
    main()

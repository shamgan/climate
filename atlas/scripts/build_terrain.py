"""Build a browser-sized, numeric ETOPO1 ice-surface terrain grid.

Source nodes are sampled every six arc-minutes (0.1 degrees), with no
interpolation, averaging or peak-height inference. Ocean bathymetry is kept
in the binary; the land renderer must clip against coastlines.
"""
from __future__ import annotations
import datetime as dt
import gzip
import hashlib
import io
import json
import pathlib
import urllib.request
import urllib.parse

import numpy as np
from scipy.io import netcdf_file

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "terrain"
QUERY = "altitude[0:6:10800][0:6:21594]"
ENDPOINTS = [
    "https://data.pmel.noaa.gov/socat/erddap/griddap/etopo180.nc",
    "https://oceanwatch.aoml.noaa.gov/erddap/griddap/etopo180.nc",
    "https://erddap.riddc.brown.edu/erddap/griddap/etopo180.nc",
    "https://spraydata.ucsd.edu/erddap/griddap/etopo180.nc",
]
SOURCE_INFO = "https://data.pmel.noaa.gov/socat/erddap/griddap/etopo180.html"
DOCUMENTATION = "https://www.ncei.noaa.gov/metadata/geoportal/rest/metadata/item/gov.noaa.ngdc.mgg.dem%3A316/html"

def digest(data):
    return hashlib.sha256(data).hexdigest()

def get_source():
    failures = []
    for endpoint in ENDPOINTS:
        url = endpoint + "?" + urllib.parse.quote(QUERY, safe=":,")
        try:
            print("Downloading " + endpoint, flush=True)
            request = urllib.request.Request(url, headers={"User-Agent": "ClimateTeachingAtlas/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                raw = response.read(32_000_000)
            if len(raw) < 12_900_000 or not raw.startswith(b"CDF"):
                raise ValueError("Response is not the complete expected NetCDF grid")
            return url, raw
        except Exception as error:
            failures.append(endpoint + ": " + str(error))
            print(failures[-1], flush=True)
    raise RuntimeError("No source download succeeded: " + "; ".join(failures))

def main():
    url, source = get_source()
    with netcdf_file(io.BytesIO(source), "r", mmap=False) as nc:
        lat = np.array(nc.variables["latitude"][:], dtype=np.float64)
        lon = np.array(nc.variables["longitude"][:], dtype=np.float64)
        altitude = np.array(nc.variables["altitude"][:], dtype=np.int16)
    assert altitude.shape == (1801, 3600), altitude.shape
    assert np.allclose(lat, np.linspace(-90, 90, 1801), atol=1e-7)
    assert np.allclose(lon, -180 + np.arange(3600)*0.1, atol=1e-7)
    assert not np.any(altitude == 32767), "Unexpected missing terrain"
    assert -11500 < int(altitude.min()) < -7000
    assert 6500 < int(altitude.max()) < 9000
    grid = np.ascontiguousarray(altitude[::-1], dtype="<i2")
    def sample(x, y):
        row = min(1800, max(0, round((90-y)/.1)))
        col = round((x+180)/.1) % 3600
        return int(grid[row, col])
    checks = []
    for name, x, y, low, high in [
        ("Tibetan plateau", 88, 33, 3500, 6000),
        ("Central Greenland ice surface", -40, 72, 1500, 3600),
        ("Denver area", -105, 39.7, 1400, 2100),
        ("Andes plateau", -68, -17, 3000, 6000),
        ("Amazon lowland", -60, -3, 0, 300),
        ("Equatorial Pacific seabed", -150, 0, -6500, -3000),
    ]:
        value = sample(x, y)
        assert low <= value <= high, (name, value, low, high)
        checks.append({"place": name, "longitude": x, "latitude": y, "elevationMeters": value,
                       "expectedRangeMeters": [low, high]})
    # Verify orientation and round-trip encoding independently.
    raw = grid.tobytes(order="C")
    compressed = gzip.compress(raw, compresslevel=9, mtime=0)
    assert np.array_equal(np.frombuffer(gzip.decompress(compressed), dtype="<i2").reshape(grid.shape), grid)
    preview = np.ascontiguousarray(grid[::10, ::10], dtype="<i2")
    preview_compressed = gzip.compress(preview.tobytes(), compresslevel=9, mtime=0)
    manifest = {
        "schemaVersion": 1,
        "title": "NOAA ETOPO1 Ice Surface, sampled at 0.1 degrees",
        "sourceYear": 2009,
        "retrievedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "kind": "data",
        "units": "m",
        "horizontalDatum": "WGS84",
        "verticalDatum": "sea level",
        "grid": {"width": 3600, "height": 1801, "longitudeStart": -180,
                 "latitudeStart": 90, "longitudeStep": .1, "latitudeStep": -.1,
                 "registration": "node", "longitudeWraps": True},
        "encoding": {"dtype": "int16", "byteOrder": "little-endian", "compression": "gzip",
                     "order": "row-major", "scale": 1, "offset": 0, "noData": 32767},
        "file": {"url": "data/terrain/elevation-01deg.bin.gz", "bytes": len(compressed),
                 "uncompressedBytes": len(raw), "sha256": digest(compressed)},
        "source": {"name": "NOAA NGDC ETOPO1 Ice Surface", "url": SOURCE_INFO,
                   "documentation": DOCUMENTATION, "downloadUrl": url,
                   "downloadSha256": digest(source), "originalGridStepDegrees": 1/60,
                   "citation": "Amante, C. and B. W. Eakins (2009). ETOPO1 1 Arc-Minute Global Relief Model. NOAA Technical Memorandum NESDIS NGDC-24. https://doi.org/10.7289/V5C8276M",
                   "license": "Data may be used and redistributed for free; see source dataset license."},
        "processing": "Every sixth ETOPO1 source node is retained. Source rows reversed to north-to-south; repeated +180 degree column omitted. No interpolation, averaging, smoothing or estimated heights.",
        "limitations": [
            "This is a sampled regional-relief model, not a survey of local peaks.",
            "The full source includes negative ocean-floor values and below-sea-level land. Clip rendering to the land geometry; do not infer land/ocean solely from the sign.",
            "Heights over Greenland and Antarctica represent ice surface.",
            "Source is ETOPO1 (2009), not the newer ETOPO 2022 model.",
        ],
        "preview": {"url": "data/terrain/preview-1deg.bin.gz", "width": 360, "height": 181,
                    "longitudeStart": -180, "latitudeStart": 90, "longitudeStep": 1, "latitudeStep": -1,
                    "bytes": len(preview_compressed), "sha256": digest(preview_compressed),
                    "purpose": "Local development preview only; production uses the 0.1-degree file."},
        "validationSamples": checks,
        "rangeMeters": [int(grid.min()), int(grid.max())],
    }
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST/"elevation-01deg.bin.gz").write_bytes(compressed)
    (DEST/"preview-1deg.bin.gz").write_bytes(preview_compressed)
    (DEST/"manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print("TERRAIN_GRID=3600x1801 step=0.1 degrees Int16LE north-to-south", flush=True)
    print("TERRAIN_BYTES="+str(len(compressed)), flush=True)
    print("TERRAIN_SHA256="+digest(compressed), flush=True)
    print("TERRAIN_SAMPLE_CHECKS="+json.dumps(checks), flush=True)
    print("TERRAIN_BUILD_PASSED", flush=True)

if __name__ == "__main__":
    main()

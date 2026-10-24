"""Extend the atlas with all 12 real ERA5 monthly normals, preserving old frames."""
import copy
import gzip
import hashlib
import json
import pathlib
import tempfile
import urllib.request

import numpy as np
import xarray as xr

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "era5"
MONTHS = tuple(range(1, 13))
BASE_MONTHS = (1, 7)
PERIOD = "1991\u20132020"
EXPECTED_SOURCES = {
    "temperature": "450df4fded6bbbe63d7a73e1f6394058acdb91ce5cea1865752aba6bdc898996",
    "precipitation": "804178402ccce6231e9815df6abbf0fabda223626d396f0cc570657b07b6f09f",
}


def sha256(content):
    return hashlib.sha256(content).hexdigest()


def encode(values, offset):
    valid = np.isfinite(values)
    assert valid.mean() > .98, "Unexpected land-only or incomplete grid"
    quantized = np.rint((values[valid] - offset) * 10)
    assert quantized.min() >= 0 and quantized.max() < 65535
    result = np.full(values.shape, 65535, dtype="<u2")
    result[valid] = quantized.astype("<u2")
    return result, int(valid.sum())


def read_existing_frame(layer, month, shape):
    frame = layer["frames"][str(month)]
    relative = pathlib.PurePosixPath(frame["url"])
    assert relative.parts[:2] == ("data", "era5") and ".." not in relative.parts
    path = ROOT.joinpath(*relative.parts)
    packed = path.read_bytes()
    assert len(packed) == frame["bytes"], f"Incomplete existing frame {path}"
    assert sha256(packed) == frame["sha256"], f"Changed existing frame {path}"
    raw = gzip.decompress(packed)
    assert len(raw) == int(np.prod(shape)) * 2
    return frame, packed, np.frombuffer(raw, dtype="<u2").reshape(shape)


def validate_city_values(encoded, layer, cities, variable, month):
    matches = 0
    for city in cities:
        assert len(city[variable]) == 12, city["id"]
        lon_index = int(round((city["gridLon"] - layer["longitudes"][0]) / .25)) % 1440
        lat_index = int(round((layer["latitudes"][0] - city["gridLat"]) / .25))
        assert abs(layer["longitudes"][lon_index] - city["gridLon"]) < 1e-8
        assert abs(layer["latitudes"][lat_index] - city["gridLat"]) < 1e-8
        actual = int(encoded[lat_index, lon_index])
        expected = int(np.rint((city[variable][month - 1] - layer["offset"]) * 10))
        assert actual == expected, (city["id"], variable, month, actual, expected)
        matches += 1
    return matches


def build():
    original = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
    assert original["schemaVersion"] == 2
    assert original["period"] == PERIOD and original["gridStepDegrees"] == .25
    assert set(original["months"]) in ({1, 7}, set(MONTHS))
    manifest = copy.deepcopy(original)
    manifest["months"] = list(MONTHS)
    city_data = json.loads((ROOT / "data/cities/climatology.json").read_text(encoding="utf-8"))
    assert city_data["period"] == "1991-2020"
    assert city_data["gridStepDegrees"] == .25
    cities = city_data["cities"]
    assert len(cities) == 20
    city_matches = 0
    published = {}
    source_bytes = {}
    with tempfile.TemporaryDirectory(prefix="atlas-era5-") as temporary:
        for name, variable in (("temperature", "tas"), ("precipitation", "pr")):
            previous = original["layers"][name]
            assert previous["sourceSha256"] == EXPECTED_SOURCES[name]
            assert previous["scale"] == .1 and previous["offset"] == (-100 if name == "temperature" else 0)
            url = previous["sourceUrl"]
            assert url.startswith("https://wbg-cckp.s3.us-west-2.amazonaws.com/data/era5-x0.25/")
            assert url.endswith("_climatology_mean_1991-2020.nc")
            source = pathlib.Path(temporary) / (variable + ".nc")
            print("SOURCE_URL", url, flush=True)
            with urllib.request.urlopen(url, timeout=180) as response, source.open("wb") as output:
                while chunk := response.read(1024 * 1024):
                    output.write(chunk)
            source_bytes[name] = source.stat().st_size
            assert sha256(source.read_bytes()) == EXPECTED_SOURCES[name], "Upstream bytes changed; review before rebuilding"
            print("SOURCE_VERIFIED", name, source_bytes[name], EXPECTED_SOURCES[name], flush=True)

            with xr.open_dataset(source, decode_times=False) as ds:
                assert ds.attrs.get("wb_period_label") == "1991-2020"
                candidates = [key for key, value in ds.data_vars.items()
                              if key.startswith(f"climatology-{variable}-monthly-") and value.ndim == 3]
                assert len(candidates) == 1, candidates
                assert np.array_equal(xr.decode_cf(ds).time.dt.month.values, np.arange(1, 13))
                a = ds[candidates[0]].squeeze(drop=True)
                latdim = next(dim for dim in a.dims if dim.lower() in ("lat", "latitude"))
                londim = next(dim for dim in a.dims if dim.lower() in ("lon", "longitude"))
                timedim = next(dim for dim in a.dims if dim not in (latdim, londim))
                assert a.sizes[timedim] == 12
                a = a.transpose(timedim, latdim, londim)
                latitudes = np.asarray(a[latdim], dtype=float)
                longitudes = (np.asarray(a[londim], dtype=float) + 180) % 360 - 180
                lati, loni = np.argsort(latitudes)[::-1], np.argsort(longitudes)
                latitudes, longitudes = latitudes[lati], longitudes[loni]
                assert len(longitudes) == 1440 and len(latitudes) == 721
                assert np.allclose(np.diff(latitudes), -.25, atol=1e-8)
                assert np.allclose(np.diff(longitudes), .25, atol=1e-8)
                assert np.array_equal(latitudes, previous["latitudes"])
                assert np.array_equal(longitudes, previous["longitudes"])
                # These pinned sources already use Celsius and monthly totals.
                # Reject different units instead of guessing a day conversion.
                units = str(a.attrs.get("units", "")).lower().replace(" ", "")
                assert units == ("degc" if name == "temperature" else "mm"), units
                assert str(a.attrs.get("units")) == previous["originalUnits"]
                layer = manifest["layers"][name]
                layer["frames"] = {}

                for month in MONTHS:
                    values = np.asarray(a.isel({timedim: month - 1}), dtype=np.float64)[np.ix_(lati, loni)]
                    low, high = float(np.nanmin(values)), float(np.nanmax(values))
                    if name == "temperature":
                        assert -100 < low <= high < 65
                    else:
                        assert -.01 <= low <= high < 6000
                        values = np.maximum(values, 0)
                    encoded, count = encode(values, layer["offset"])
                    city_matches += validate_city_values(encoded, layer, cities, name, month)
                    filename = f"{name}-{month:02}.bin.gz"
                    if month in BASE_MONTHS:
                        frame, packed, existing = read_existing_frame(previous, month, values.shape)
                        assert np.array_equal(encoded, existing), f"Original {name} month {month} data changed"
                        assert frame["validCells"] == count
                        assert frame["minimum"] == round(float(np.nanmin(values)), 2)
                        assert frame["maximum"] == round(float(np.nanmax(values)), 2)
                        # Retain gzip bytes and metadata exactly, independently of Python/zlib version.
                        layer["frames"][str(month)] = copy.deepcopy(frame)
                    else:
                        packed = gzip.compress(encoded.tobytes(), compresslevel=9, mtime=0)
                        assert gzip.decompress(packed) == encoded.tobytes()
                        layer["frames"][str(month)] = {
                            "url": "data/era5/" + filename,
                            "sha256": sha256(packed),
                            "bytes": len(packed),
                            "minimum": round(float(np.nanmin(values)), 2),
                            "maximum": round(float(np.nanmax(values)), 2),
                            "validCells": count,
                        }
                    published[filename] = packed
                    print("MONTH_VERIFIED", name, month, json.dumps(layer["frames"][str(month)]), flush=True)

    assert city_matches == 480, city_matches
    assert len(published) == 24
    # Keep every pre-existing manifest property intact except the months/frames expansion.
    preserved = copy.deepcopy(manifest)
    preserved["months"] = original["months"]
    for name in manifest["layers"]:
        preserved["layers"][name]["frames"] = original["layers"][name]["frames"]
    assert preserved == original
    for name in manifest["layers"]:
        assert list(manifest["layers"][name]["frames"]) == [str(m) for m in MONTHS]
    for filename, packed in published.items():
        if "-01." not in filename and "-07." not in filename:
            (OUT / filename).write_bytes(packed)
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("ERA5_ALL_MONTHS_PASSED: 24 genuine monthly frames; four original frames and metadata unchanged; 480 city values matched", flush=True)
    print("DOWNLOAD_BYTES", json.dumps(source_bytes), flush=True)
    print("PUBLISHED_FRAME_BYTES", sum(map(len, published.values())), flush=True)


if __name__ == "__main__":
    build()

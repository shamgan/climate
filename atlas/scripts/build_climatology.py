"""Build the atlas's January/July climatology from documented NOAA PSL files."""
from pathlib import Path
import hashlib
import json
import tempfile
import time
import urllib.request
import numpy as np
import xarray as xr

DATASETS = {
    "temperature": {
        "path": "ncep.reanalysis2/Monthlies/LTMs/gaussian_grid/air.2m.mon.ltm.1991-2020.nc",
        "variable": "air",
        "name": "NCEP/DOE Reanalysis 2: 2 m air temperature",
        "documentation": "https://psl.noaa.gov/data/gridded/data.ncep.reanalysis2.html",
        "unit": "°C",
    },
    "precipitation": {
        "path": "gpcp/precip.mon.ltm.1991-2020.nc",
        "variable": "precip",
        "name": "GPCP v2.3 monthly precipitation climatology",
        "documentation": "https://psl.noaa.gov/data/gridded/data.gpcp.html",
        "unit": "mm/month",
    },
}

def download(dataset, destination):
    urls = [
        "https://psl.noaa.gov/thredds/fileServer/Datasets/" + dataset["path"],
        "https://downloads.psl.noaa.gov/Datasets/" + dataset["path"],
    ]
    errors = []
    for url in urls:
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "ClimateAtlas/1.0 educational climatology"})
                with urllib.request.urlopen(req, timeout=60) as response:
                    body = response.read()
                assert len(body) > 10000, "Unexpectedly small NetCDF response"
                destination.write_bytes(body)
                return url, hashlib.sha256(body).hexdigest()
            except Exception as error:
                errors.append(str(error))
                if attempt < 2:
                    time.sleep(3)
    raise RuntimeError("Could not retrieve NOAA data: " + "; ".join(errors))

result = {
    "schemaVersion": 1,
    "period": "1991–2020",
    "months": [1, 7],
    "layout": "rows north to south, columns west to east",
    "provider": "Data provided by NOAA PSL, Boulder, Colorado, USA",
    "providerUrl": "https://psl.noaa.gov/",
    "layers": {},
}
with tempfile.TemporaryDirectory() as temporary:
    for kind, spec in DATASETS.items():
        filename = Path(temporary) / (kind + ".nc")
        source_url, source_hash = download(spec, filename)
        with xr.open_dataset(filename, decode_times=False) as ds:
            data = ds[spec["variable"]].squeeze(drop=True).transpose("time", "lat", "lon")
            assert data.sizes["time"] == 12, "Expected one climatology for each calendar month"
            lats = np.asarray(ds["lat"].values, dtype=float)
            lons = (np.asarray(ds["lon"].values, dtype=float) + 180) % 360 - 180
            lat_order, lon_order = np.argsort(-lats), np.argsort(lons)
            ordered_lats, ordered_lons = lats[lat_order], lons[lon_order]
            assert np.all(np.diff(ordered_lats) < 0)
            assert np.all(np.diff(ordered_lons) > 0)
            units = str(data.attrs.get("units", "")).strip().lower()
            frames = {}
            diagnostics = {}
            for month in [1, 7]:
                values = np.asarray(data.isel(time=month-1).values, dtype=float)[lat_order][:, lon_order]
                if kind == "temperature":
                    assert units in ["k", "degk", "kelvin", "degrees_k", "degree_k"], units
                    values = values - 273.15
                    assert np.nanmin(values) > -100 and np.nanmax(values) < 65
                else:
                    assert units in ["mm/day", "mm/d", "mm day-1"], units
                    # January and July both contain 31 days.
                    values = values * 31
                    assert np.nanmin(values) >= 0 and np.nanmax(values) < 4000
                finite = np.isfinite(values)
                assert finite.mean() > 0.95, "Unexpected data coverage"
                scaled = np.rint(values * 10)
                frames[str(month)] = [int(v) if ok else None for v, ok in zip(scaled.ravel(), finite.ravel())]
                diagnostics[str(month)] = {"minimum": round(float(np.nanmin(values)), 2), "maximum": round(float(np.nanmax(values)), 2)}
            result["layers"][kind] = {
                "name": spec["name"],
                "unit": spec["unit"],
                "scale": 0.1,
                "latitudes": np.round(ordered_lats, 6).tolist(),
                "longitudes": np.round(ordered_lons, 6).tolist(),
                "values": frames,
                "sourceUrl": source_url,
                "sourceSha256": source_hash,
                "documentation": spec["documentation"],
                "originalUnits": units,
                "conversion": "K minus 273.15" if kind == "temperature" else "mm/day multiplied by 31 days for January and July",
                "diagnostics": diagnostics,
            }
            print(json.dumps({"layer": kind, "shape": [len(lats), len(lons)], "sourceUnits": units, "range": diagnostics}))
output = Path("atlas/data/climatology.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False), encoding="utf-8")
print(json.dumps({"output": str(output), "bytes": output.stat().st_size, "sha256": hashlib.sha256(output.read_bytes()).hexdigest()}))

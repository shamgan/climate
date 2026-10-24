"""Prepare a compact, pinned Natural Earth country-reference overlay.

Only line geometry and label anchor properties are emitted. Existing climate
data are not read or changed. Use --source-dir for verified offline copies;
without it the exact pinned GitHub raw GeoJSON files are downloaded.
"""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
import math
import pathlib
import urllib.request

REVISION = "ca96624a56bd078437bca8184e78163e5039ad19"
BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/" + REVISION
DATASETS = [
    ("land", "ne_50m_admin_0_boundary_lines_land", "5.1.0", "f2da10de881015c7182951b59a75b1e4e27356c6", 390),
    ("disputed", "ne_50m_admin_0_boundary_lines_disputed_areas", "5.1.2", "6dadc77e401efeba7513e90a3cbd0d2f7b524be6", 34),
    ("labels", "ne_50m_admin_0_countries", "5.1.1", "9d99f26dc470fcdbd08b062c813005acbdf73ccb", 242),
]
SOLID = "International boundary (verify)"
DASHED = {
    "Disputed (please verify)", "Indefinite (please verify)",
    "Line of control (please verify)", "Indeterminant frontier",
    "Claim boundary", "Elusive frontier", "Breakaway",
}
# Natural Earth's NAME_HE for PS mistranslates "Palestine" as "Land of Israel".
# Use the Hebrew regional name returned by standard Intl.DisplayNames/CLDR.
NAME_OVERRIDES = {"PS": "השטחים הפלסטיניים"}

def read_source(name, expected_sha, source_dir):
    if source_dir:
        raw = (source_dir / (name + ".geojson")).read_bytes()
    else:
        request = urllib.request.Request(BASE + "/geojson/" + name + ".geojson",
                                         headers={"User-Agent": "ClimateTeachingAtlas/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            raw = response.read()
    git_hash = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
    assert git_hash == expected_sha, (name, "Unexpected source blob", git_hash)
    return json.loads(raw)

def rounded_geometry(geometry):
    assert geometry["type"] in ("LineString", "MultiLineString")
    def pair(point):
        assert len(point) >= 2 and all(math.isfinite(v) for v in point[:2])
        assert -180 <= point[0] <= 180 and -90 <= point[1] <= 90
        return [round(point[0], 5), round(point[1], 5)]
    coords = geometry["coordinates"]
    if geometry["type"] == "LineString":
        assert len(coords) >= 2
        out = [pair(p) for p in coords]
    else:
        assert all(len(line) >= 2 for line in coords)
        out = [[pair(p) for p in line] for line in coords]
    return {"type": geometry["type"], "coordinates": out}

def build(source_dir):
    features, labels, provenance = [], [], []
    for layer, name, version, blob, expected_count in DATASETS:
        data = read_source(name, blob, source_dir)
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == expected_count, name
        provenance.append({
            "layer": layer, "name": name, "version": version, "gitBlobSha": blob,
            "url": BASE + "/geojson/" + name + ".geojson",
            "versionUrl": BASE + "/50m_cultural/" + name + ".VERSION.txt",
        })
        for feature in data["features"]:
            p = feature["properties"]
            if layer == "labels":
                code = p.get("ISO_A2_EH") or p.get("ISO_A2") or ""
                source_name = p.get("NAME_HE") or p["NAME"]
                label = {
                    "name": NAME_OVERRIDES.get(code, source_name),
                    "lon": round(p["LABEL_X"], 5), "lat": round(p["LABEL_Y"], 5),
                    "rank": p["LABELRANK"], "scalerank": p["scalerank"],
                    "code": code, "id": p["ADM0_A3"],
                    "minLabel": p["MIN_LABEL"], "maxLabel": p["MAX_LABEL"],
                }
                assert -180 <= label["lon"] <= 180 and -90 <= label["lat"] <= 90
                assert label["name"] and isinstance(label["rank"], (int, float))
                if code in NAME_OVERRIDES:
                    label["sourceName"] = source_name
                labels.append(label)
            else:
                source_class = p["FEATURECLA"]
                assert source_class == SOLID or source_class in DASHED, source_class
                props = {
                    "kind": "boundary" if source_class == SOLID else "disputed",
                    "sourceClass": source_class, "sourceLayer": layer,
                    "minZoom": p["MIN_ZOOM"], "id": p["NE_ID"],
                }
                if p.get("BRK_NAME") or p.get("NAME"):
                    props["sourceName"] = p.get("BRK_NAME") or p["NAME"]
                features.append({"type": "Feature", "properties": props,
                                 "geometry": rounded_geometry(feature["geometry"])})
    # Python sorting is stable, preserving source order for equally ranked labels.
    labels.sort(key=lambda p: (p["rank"], p["scalerank"]))
    result = {
        "type": "FeatureCollection", "features": features, "labels": labels,
        "source": {
            "name": "Natural Earth", "scale": "1:50,000,000", "revision": REVISION,
            "license": "Public domain",
            "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
            "policyUrl": "https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-boundary-lines-2/",
            "datasets": provenance,
            "boundaryPolicy": "Natural Earth's default FEATURECLA classification is retained. De facto/reference boundaries are not a claim of legal recognition. Country-specific FCLASS_* worldviews are not selected.",
            "lineStyle": "International boundary (verify) is solid; disputed, indefinite, control, frontier, claim and breakaway categories are dashed.",
            "labelPolicy": "Countries and territories, not only sovereign states. Source LABEL_X/Y anchors; NAME_HE fallback; ISO_A2_EH preferred over ISO_A2. Valid region codes may be localized by Intl.DisplayNames at runtime.",
            "labelCorrections": [{
                "code": "PS", "sourceName": "ארץ ישראל", "displayName": NAME_OVERRIDES["PS"],
                "reason": "Correct the source Hebrew translation using the Hebrew region name supplied by Intl.DisplayNames/CLDR; no geometry or boundary changes.",
            }],
            "processing": "Keep all 390 land-boundary and 34 disputed-auxiliary features. Drop unrelated attributes and country polygons. Round line coordinates and label anchors to five decimal places, without simplification. Sort labels stably by LABELRANK then scalerank.",
            "limitations": [
                "Generalized world/regional reference data; not survey or navigation boundaries.",
                "The source revisions may not reflect later geopolitical changes.",
                "Cartographic label anchors are not capitals or geometric centroids.",
            ],
        },
    }
    assert len(features) == 424 and len(labels) == 242
    assert sum(f["properties"]["kind"] == "boundary" for f in features) == 355
    assert sum(f["properties"]["kind"] == "disputed" for f in features) == 69
    assert len({p["id"] for p in labels}) == 242
    assert all(l["name"] for l in labels)
    return result

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path,
                        default=pathlib.Path(__file__).resolve().parent.parent / "data/boundaries/countries.json")
    args = parser.parse_args()
    result = build(args.source_dir)
    content = (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(content)
    print("BOUNDARIES=424 SOLID=355 DASHED=69 LABELS=242")
    print("BYTES=" + str(len(content)))
    print("SHA256=" + hashlib.sha256(content).hexdigest())
    print("BOUNDARIES_BUILD_PASSED")

if __name__ == "__main__":
    main()

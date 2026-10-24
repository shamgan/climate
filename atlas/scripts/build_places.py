"""Build compact point-in-country polygons from the atlas's pinned Natural Earth source."""
import argparse
import base64
import hashlib
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "ca96624a56bd078437bca8184e78163e5039ad19"
SOURCE_BLOB = "9d99f26dc470fcdbd08b062c813005acbdf73ccb"
SOURCE_SHA256 = "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb"
SOURCE_URL = f"https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{SOURCE_COMMIT}/geojson/ne_50m_admin_0_countries.geojson"
SCALE = 10000


def pack_ring(ring):
    """Quantize to 1e-4 degrees, delta-code, zigzag and encode unsigned varints."""
    points = [[round(p[0] * SCALE), round(p[1] * SCALE)] for p in ring]
    assert points[0] == points[-1] and len(set(map(tuple, points))) >= 3
    output = bytearray()
    last = [0, 0]
    for point in points:
        for axis in (0, 1):
            delta = point[axis] - last[axis]
            last[axis] = point[axis]
            number = delta * 2 if delta >= 0 else -delta * 2 - 1
            while number > 127:
                output.append((number & 127) | 128)
                number >>= 7
            output.append(number)
    return base64.b64encode(output).decode("ascii"), points


def build(source_bytes):
    assert hashlib.sha1(b"blob " + str(len(source_bytes)).encode() + bytes([0]) + source_bytes).hexdigest() == SOURCE_BLOB, "Source git blob changed"
    assert hashlib.sha256(source_bytes).hexdigest() == SOURCE_SHA256, "Source SHA256 changed"
    source = json.loads(source_bytes)
    assert source["type"] == "FeatureCollection" and len(source["features"]) == 242
    features = []
    count = 0
    for feature in source["features"]:
        properties, geometry = feature["properties"], feature["geometry"]
        assert geometry["type"] in ("Polygon", "MultiPolygon")
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        encoded = []
        for polygon in polygons:
            assert polygon
            rings = []
            for ring in polygon:
                # This pinned source already splits antimeridian crossings.
                assert all(abs(b[0] - a[0]) <= 180 for a, b in zip(ring, ring[1:]))
                packed, points = pack_ring(ring)
                rings.append(packed)
                count += len(points)
            outer = polygon[0]
            bounds = [
                min(round(p[0] * SCALE) for p in outer),
                min(round(p[1] * SCALE) for p in outer),
                max(round(p[0] * SCALE) for p in outer),
                max(round(p[1] * SCALE) for p in outer),
            ]
            encoded.append([bounds, rings])
        code = str(properties.get("ISO_A2_EH", ""))
        name = properties.get("NAME_HE") or ""
        if code == "PS":
            name = "הלבנט"
        record = {
            "code": code,
            "name": name,
            "polygons": encoded,
        }
        if not name:
            record["fallback"] = properties.get("NAME_EN") or properties["NAME"]
        features.append(record)
    return {
        "schemaVersion": 1,
        "encoding": "base64 unsigned varints of zigzag longitude/latitude deltas; each ring restarts at 0,0",
        "coordinateScale": SCALE,
        "source": {
            "name": "Natural Earth admin 0 countries, 1:50m",
            "url": SOURCE_URL,
            "commit": SOURCE_COMMIT,
            "gitBlobSha": SOURCE_BLOB,
            "sha256": SOURCE_SHA256,
            "license": "Public domain",
            "licenseUrl": "https://www.naturalearthdata.com/about/terms-of-use/",
            "boundaryPolicyUrl": "https://www.naturalearthdata.com/about/disputed-boundaries-policy/",
        },
        "processing": {
            "featureCount": len(features),
            "vertexCount": count,
            "simplification": "None: every polygon, hole and source vertex is retained",
            "coordinateRoundingDegrees": 0.0001,
            "maximumRoundingPerAxisDegrees": 0.00005,
            "antimeridian": "Use source-split polygons; all source edges checked for longitude jumps <=180 degrees",
            "displayCustomization": "For this atlas only, source code PS has the regional display label הלבנט. This is a display preference, not a sovereignty determination.",
        },
        "limitations": [
            "Generalized country/area polygons, not an address geocoder or legal boundary map.",
            "A click near a generalized coast or border may have no polygon match; use a latitude-region fallback rather than the nearest country.",
            "Country/area labels follow the pinned source except the explicitly documented regional display label.",
        ],
        "features": features,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=pathlib.Path)
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "data/places/countries.json")
    args = parser.parse_args()
    if args.source:
        source_bytes = args.source.read_bytes()
    else:
        with urllib.request.urlopen(SOURCE_URL, timeout=90) as response:
            source_bytes = response.read()
    result = build(source_bytes)
    packed = (json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n").encode("utf-8")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(packed)
    print(json.dumps({"output": str(args.output), "bytes": len(packed), "features": len(result["features"]), "vertices": result["processing"]["vertexCount"], "sha256": hashlib.sha256(packed).hexdigest()}))


if __name__ == "__main__":
    main()

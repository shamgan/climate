# Canonical climate atlas and source record

This is a dated recovery aid, not a claim about the current repository head. Refresh the remote before editing. Sources listed here were read from the published candidate's code/manifests on 2026-10-24; recheck primary documentation when changing scientific claims or data processing.

## Canonical product

- Public atlas: https://shamgan.github.io/climate/atlas/
- Repository: https://github.com/shamgan/climate
- Branch: main; site subtree: atlas/.
- Last verified application checkpoint: ea5180c9cec97a33a1842226981b8c4277a76d03.
- Last verified application tree: 9412906f1de92b393d60294a4e21b128ea27060b.
- Candidate CI: https://github.com/shamgan/climate/actions/runs/40077538372
- Main CI: https://github.com/shamgan/climate/actions/runs/40077787818
- Pages: https://github.com/shamgan/climate/actions/runs/40077787511
- Public verification: https://github.com/shamgan/climate/actions/runs/40077787779
- Verified public HTML SHA256: cc25c7535fa267fdec95f8cc1754b8a48a588b3705d9d1823bce57abac1c0cbe.
- That public check returned HTTP 200 and matched all 22 separately served assets. These are historical verification facts, not proof that a future update is deployed.

## Source and module navigation

| Path | Responsibility |
|---|---|
| atlas/index.html | Base map, embedded climate source/rendering, climate class mapping, latitude labels, source dialog and shared state. Some old header markup is relocated/removed by interface.js at runtime; inspect rendered DOM. |
| atlas/interface.js / interface.css | Dock, tabs, full-viewport layout, footer controls, typography and responsive interaction. |
| atlas/layers.js / layers.css | Twelve monthly temperature/precipitation fields, playback, hover and selection. |
| atlas/places.js / data/places/countries.json | Lazy country/region polygon lookup for selected points; source retained in manifest. |
| atlas/currents.js | 29 sourced conceptual current paths and descriptions, January/July behavior. |
| atlas/navigation.js / navigation.css | Shared zoom/pan, full reset, country boundaries and persistent desert overlay. |
| atlas/cities.js / cities.css | Selected-city marker, 12-month climographs, table and expanded dialog. |
| atlas/learning-layers.js / learning-layers.css | Pressure/wind, terrain and sun/day-length additions and learning scenes. |
| atlas/solar-model.js / atmosphere-model.js | Equation-based solar model and conceptual seasonal circulation model. |
| atlas/data/era5/manifest.json | Monthly field provenance, grid, encoding and hashes. |
| atlas/data/cities/climatology.json | 20 cities, monthly values, city/sample coordinates, source and checks. |
| atlas/data/terrain/manifest.json | ETOPO1 origin, grid and sampling, limitations and file hashes. |
| atlas/data/boundaries/countries.json | Raw boundary/label dataset, retained unchanged by requested local display filter. |
| atlas/scripts/ | Existing regression suites and carefully maintained preservation baselines. |
| .github/workflows/test-atlas-layers.yml | Browser and model regression CI. |
| .github/workflows/verify-climate-atlas.yml | Public HTML and 44 asset comparisons after main publication (including 24 monthly frames). |

Use existing scripts check_interface.py, check_solar.cjs, check_atmosphere.cjs, check_learning.py, check_navigation.py, check_cities.py and check_desert.py as relevant. Run against real repository data; small local previews are not production-resolution proof.

## Data provenance and interpretive limits

### Climate classification

- Beck et al. (2023), dataset: https://www.gloh2o.org/koppen/
- Data record: https://doi.org/10.6084/m9.figshare.21789074, version 2 used in the atlas.
- Paper: https://doi.org/10.1038/s41597-023-02549-6
- Period 1991–2020; displayed source grid 0.1°, not the 1 km grid mentioned in the paper title.
- License CC BY 4.0; preserve attribution, transformation notes and no-endorsement clarification.
- Pedagogical group names intentionally differ from official Köppen groups. Preserve the source-dialog explanation.
- Definition reference for the temperature/seasonality-dependent aridity threshold: https://repository.library.noaa.gov/view/noaa/24183/noaa_24183_DS1.pdf
- Monsoon clarification source already used in the atlas: https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/wind/monsoons

### Monthly climate and cities

- ERA5 reanalysis, ECMWF/Copernicus, distributed/processed by World Bank CCKP.
- Metadata: https://climateknowledgeportal.worldbank.org/index.php/metadata
- Collection: https://worldbank.github.io/climateknowledgeportal/docs/collections/era5-x0.25.html
- Open-data registry: https://registry.opendata.aws/wbg-cckp/
- Period 1991–2020; 0.25° grid. Grid-cell means are not city-station measurements or current weather.
- Map and city file both have all 12 source months; original Jan/Jul map frames and metadata are byte-identical. Temperature °C; precipitation mm per month. The city's precipitation source is already monthly millimeters, so do not multiply it by the number of days.
- ERA5 display encoding: unsigned little-endian uint16 in gzip, no-data 65535, decoded value = encoded × scale + offset. Scale 0.1 is storage precision, not claimed measurement accuracy.
- City extraction uses the nearest compatible cell and 0.1 quantization. The validation checks 480 matches against all 12 map months; the original 80 Jan/Jul comparisons remain a subset.
- Cities: ירושלים, לונדון, קהיר, מומבאי, מנאוס, סידני, ניו יורק, קייפטאון, טרומסה (Tromsø), רייקיאוויק, סינגפור, בנגקוק, אולן בטור, יקוטסק, קיטו, ניירובי, בואנוס איירס, סנטיאגו, אליס ספרינגס, פיניקס.
- Preserve actual city anchors separately from gridLon/gridLat. The city manifest documents Natural Earth populated-place coordinates and preserved prior anchors.

### Terrain, circulation and sun

- Terrain: NOAA ETOPO1 Ice Surface (2009), sampled every sixth one-arc-minute node to 0.1°, not ETOPO 2022.
- Product: https://www.ncei.noaa.gov/products/etopo-global-relief-model
- Specific source: https://data.pmel.noaa.gov/socat/erddap/griddap/etopo180.html
- Grid 3600 × 1801, north-to-south, longitude wrap, meters, little-endian int16, no-data 32767. Ice-surface elevations are not bedrock elevations.
- Current scheme source: https://www.noaa.gov/jetstream/ocean/circulations/jetstream-max-major-ocean-currents
- Seasonal Indian Ocean sources: https://www.aoml.noaa.gov/ftp/phod/editors/murtugudde_annamalai.pdf and https://repository.library.noaa.gov/view/noaa/48280
- Circulation source: https://www.noaa.gov/jetstream/global/global-atmospheric-circulations
- Seasonal convergence: https://www.noaa.gov/jetstream/tropical/convergence-zone
- Solar equations: https://gml.noaa.gov/grad/solcalc/solareqns.PDF
- Sunrise definitions: https://aa.usno.navy.mil/faq/RST_defs
- Preserve conceptual-model labels for winds/currents. Sun/day length is calculated for the displayed date (currently the 15th of the selected month), not inferred from the climate raster.

### Coastlines and country boundaries

- Natural Earth is the documented geometry provider; terms: https://www.naturalearthdata.com/about/terms-of-use/
- Coastlines 1:110m, Natural Earth 1 projection.
- Boundaries 1:50m: https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-boundary-lines-2/
- Provider boundary policy: https://www.naturalearthdata.com/about/disputed-boundaries-policy/
- Raw checkpoint dataset: 424 line features, 242 label entries.
- Atlas-specific display filter: omit land:1746705323, land:1746709121 and disputed:1746705871; filter labels where code === 'PS' before localization.
- This yields 421 rendered source features and 241 label candidates. Preserve land:1746708629 and the other surrounding boundary segments. Do not repurpose these IDs on a different dataset version without verifying geometry.
- Keep the local-customization note in sources. This records an explicit display preference, not a legal determination or a general rule for other maps.

## Skill storage scope

This skill is versioned with the atlas under .agents/skills/build-interactive-climate-maps/. Its repository copy is a durable project skill; atlas/AGENTS.md routes atlas work to it. A repository save does not establish that the separate personal cloud Skills catalog was updated. If later given a writable personal Skills workspace, reconcile this skill there using the skill-creator workflow and verify its sync; do not silently overwrite the broader Earth-science visualization skill.

## Source-backed twelve-month build, 2026-10-24

The isolated build at commit c2fdc9c454d47bf1489cb73efa330524e5f4c638 passed workflow 40099189908: 24 genuine frames, four original frames and metadata unchanged, 480 matching city values. This is data-build evidence, not UI or publication verification. Temperature source SHA256: 450df4fded6bbbe63d7a73e1f6394058acdb91ce5cea1865752aba6bdc898996; precipitation: 804178402ccce6231e9815df6abbf0fabda223626d396f0cc570657b07b6f09f.

Country lookup uses Natural Earth 1:50m admin-0 country polygons at revision ca96624a56bd078437bca8184e78163e5039ad19, source git blob 9d99f26dc470fcdbd08b062c813005acbdf73ccb. All 242 features, polygon holes and 99,613 vertices are retained; coordinates round to 0.0001 degrees and are delta-varint encoded. It is independent of the optional border-line layer. Country membership is source geometry, not a sovereignty determination. PS is displayed as the neutral region הלבנט under this project's existing label preference. Unmatched coastal/sea points use a latitude-region fallback.

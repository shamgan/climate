# Map engineering and verification

Use these practices when they support the requested map. The named functions and files describe the atlas checkpoint, not a mandatory architecture for all projects.

## Contents

1. Data and geographic integrity
2. Layer and interaction model
3. Full-viewport layout and typography
4. Cities and climographs
5. Tests that catch real regressions
6. Delivery and recovery

## Data and geographic integrity

- Keep a source manifest per dataset: specific source/download URLs, version, license, time period, variable, original units, transformations, grid origin/spacing/order, no-data value, encoding and hashes.
- Distinguish source resolution, delivered grid resolution, renderer pixel density and numeric encoding precision. Repainting a coarse bitmap at larger dimensions adds no geographic information.
- Use nearest-neighbor sampling for categorical climate classes. Do not blur class identifiers. For continuous fields, use only justified, documented resampling and do not describe interpolated values as observations.
- Use the same documented location-to-grid function for map readout and city data. Verify longitude wrapping, latitude order, the dateline, poles, no-data values and coast-adjacent cells.
- For mixed raster/vector rendering, apply the same projection/camera to climate cells, relief, currents, country lines, city markers and hit tests. Repaint raster data from geographic samples at the current viewport when zoom changes.
- Keep measured observations, reanalysis, conceptual diagrams and equation-based readouts visibly distinguishable. Never assign real velocity meaning to decorative arrow thickness.
- Source a more detailed dataset when the user asks for greater spatial resolution. Preserve provenance and recheck units instead of merely increasing canvas dimensions.
- When sampling terrain, do not identify land solely by elevation sign: below-sea-level land exists. Respect the source's ice-surface versus bedrock definition and date.
- Keep educational class names separate from source IDs and group membership. A display rename is not an automatic geometry or classification change.

## Layer and interaction model

Maintain separate state for:

- base presentation: climate / temperature / precipitation;
- climate mode and selected class: main / detailed / all zones;
- month or date;
- independent overlays: currents, deserts, borders and teaching additions;
- selected city, selected current and inquiry point;
- camera scale/translation;
- typography and drawer/tab state.

Use a stable render order. Put source fields first, independent marks/lines next and readable labels/selected city on top as appropriate. Do not let a new overlay replace base data or erase another overlay's state. Preserve the selected city and camera on ordinary layer changes.

For the atlas desert overlay, build a separate transparent mask using BWh/BWk class IDs 4/5; exclude BSh/BSk 6/7, ocean and no-data. Fill every included pixel, not an alternating hatch. Preserve original raster values beneath the overlay. Explain alpha blending when combined colors could confuse the underlying legend.

Boundary overlays should be sourced lines with feature identifiers and documented generalization, not hand-drawn polygons used to mask inconvenient areas. When explicit project-specific customization is authorized, filter exact features/labels at display time and leave raw source data intact. Do not remove adjacent features by broad latitude/longitude heuristics.

Use one zoom implementation for buttons, wheel and touch. Keep wheel zoom anchored at the pointer, preserve pinch midpoint and distinguish dragging from clicking a location. Bound extreme transforms and disable map gestures only where needed for UI interaction. Recalculate container dimensions and projection on drawer/viewport resize.

Define reset semantics before implementing: camera-only reset is different from a full return to startup defaults. A full reset should clear the relevant selections, overlays and derived state consistently with the canonical product. Do not silently reset user's state on unrelated rendering updates.

## Full-viewport layout and typography

Use a responsive layout with the map and dock in actual sibling columns. Set min-width: 0 and min-height: 0 on grid/flex children where needed. Avoid fixed empty columns and obsolete max-width/padding that leave an unused left strip.

For a full-screen atlas, size the outer shell to 100dvh with a suitable fallback, hide document overflow, and place internal scrolling on the tools content. Keep the brand, tabs and footer actions in their intended fixed slots. Keep map legends bounded so that opening many layers does not push the canvas below the screen. Test that footer actions remain reachable.

The world projection has its own aspect ratio. Preserve the complete world at reset, even if a portrait viewport has vertical whitespace. Do not fix layout whitespace by arbitrary automatic zoom or cropping.

Scale the canvas backing store with devicePixelRatio and its actual content rectangle. Account for borders consistently; obsolete one-pixel assumptions can fail after a borderless layout change. Reuse resize/render scheduling and avoid multiple listeners or loops.

Use one text-scale state. In the atlas, atlasTextScale() returns 1 or 1.4 and the root font changes from 16 to 22.4px.

- DOM: prefer rem/em or a documented scale token. Inspect fixed-pixel labels that ignore root font size.
- Canvas: multiply actual ctx.font sizes and adjust geometry/line placement where larger text changes fit; redraw.
- SVG: adjust font sizes, viewBox, plot margins and surrounding text positions together. Preserve physical size improvement after responsive scaling.
- Do not apply both an inline multiplier and a CSS multiplier to the same text.
- Recalculate collision boxes, text widths, tick spacing and label guards in large mode.
- Measure enlargement in rendered pixels, not just source font attributes. A wider viewBox can cancel a nominal font-size increase.

Anchor latitude labels to the projected line on both sides. Keep the principal name/number and a smaller subtitle distinguishable. Compact padding/line-height and recenter two-line labels for short viewports. Do not keep obsolete top/bottom guards reserved for removed controls, which can hide polar labels. Test all ten main labels and four tropic subtitles in the full-world view.

For country/current/city labels, use measured text bounds and prioritized placement. Keep the city marker at its true coordinate while moving only its label with a leader if necessary. Do not promise that collision avoidance will display every country name at every zoom.

## Cities and climographs

Use twelve genuine monthly climatology values from a compatible source period and method. Never derive a full climograph from January and July alone or insert plausible invented values.

Store the city's display coordinate separately from the sampled grid cell. Display the marker at the city anchor and disclose grid-cell representativeness in the source note.

Use monthly precipitation bars, a temperature line, two labeled axes with units and an explicit month order. Hebrew text can be RTL while month numerals and geographic coordinates use deliberate LTR/bidi isolation. Preserve negative temperatures and dry months.

Keep the side-panel climograph accessible below the city information, with existing enlargement dialog and data table. Verify text bounds, axis labels and long city names for every city. Month labels 10, 11 and 12 can overlap even when their individual boxes remain inside the SVG; inspect their spacing as well as containment. Keep the temperature/rainfall axes distinct.

Calculate annual totals/means/ranges from the source monthly values, with documented rounding. Avoid implying that a cell mean is an exact city weather-station measurement.

## Tests that catch real regressions

Scale testing to the change; do not write tests that only repeat implementation text. Reuse the atlas's existing suites when applicable.

| Concern | Meaningful check |
|---|---|
| Existing content | Compare raw dataset hashes, class membership and state snapshots. Record authorized changes without broadly regenerating expected baselines to hide unrelated changes. |
| Overlays | Exercise both monthly fields/months and combinations; toggle each off and confirm underlying state/pixels restore. |
| Desert | Assert all BWh/BWk cells included and all non-desert cells transparent; check prominent fill on both fields. |
| Geometry | Compare parsed numeric feature geometry/membership. JSON serialization can differ for 100 and 100.0 without a geographic difference. |
| Navigation | Test button, pointer-anchored wheel, drag, pinch, reset and selection after gestures. |
| Cities | Verify all 12 values, marker projection, month/base-layer persistence and table/chart agreement. Current atlas has 20 cities and 80 Jan/Jul comparisons: 20 × 2 variables × 2 months. |
| Full viewport | Assert document scrollWidth/scrollHeight do not exceed viewport, scrolling the document leaves scrollY at zero and canvas top is at the viewport top. Check dock open and closed. |
| Typography | Compare rendered text sizes for DOM, canvas and SVG, then inspect screenshots for clipping/overlap. |
| Responsive | Include wide desktop, 1280×720, narrow 320×568 and 390×844, plus short landscape 844×390; test normal/large text and drawer states. These are test cases, not universal design breakpoints. |
| Latitude labels | Check ten visible principal labels and four subtitles at full-world fit, paired names/numbers, geographic anchoring and pairwise overlap. |
| Accessibility | Keyboard reachability, focus, tabs, Escape, modal close/focus restoration, switch state labels, contrast and meaningful non-color cues. |
| Reliability | Browser error collection, lazy data loading, failure/retry and source attribution links. |
| Teaching models | Hemisphere direction, seasonal changes, polar cases, model/data labeling, and equations independently checked against numeric expectations. |

After removing or moving controls, update stale test selectors to the new intended structure; do not remove the underlying behavior assertion. Preserve source line endings and encoding when exact-byte baseline checks are intentional.

Automated checks and screenshot review complement each other. A passing bbox test cannot establish readable month spacing. An attractive screenshot cannot establish correct data or reset behavior.

## Delivery and recovery

Use the project's existing hosting and connector capabilities. In restricted local environments, native repository APIs can read files and create immutable candidate trees/commits without requiring the user to install a new service.

Keep a known baseline, isolated candidate and expected-head nonforce update. Refresh main immediately before integration. Never force push to overcome concurrency. Scope changes to the requested map; avoid modifying an unrelated course at the site root.

Run CI on the candidate, inspect actual browser screenshots and integrate only the reviewed candidate. If screenshots cannot be downloaded as binaries with the connector, use available authorized artifact access; an isolated review branch is a project-specific fallback, not an obligation for every update. Never merge review images/workflows into the product accidentally.

Publish only when authorized, retaining the canonical link and intended public access. Confirm Pages/hosting deployment and then fetch the public URL anonymously. Verify expected HTML and changed assets, ideally exact hashes. A cached old success page is not verification of the new revision.

Leave a concise record of source/revision, changed paths, test evidence, deployment and public verification. Label any prior version as historical. Report only achieved results and an actual blocker if one remains. Do not install unrelated plugins or migrate hosting merely to avoid investigating the existing project.

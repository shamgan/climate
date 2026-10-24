---
name: build-interactive-climate-maps
description: Build, revise and verify interactive teaching maps and climate atlases with Hebrew RTL controls, source-backed spatial layers, climographs, accessible typography and public delivery. Use for geographic map UI, zoom, overlays, climate terminology or updates to Nadav Shamgar's climate atlas. Do not apply atlas-specific geography or naming choices to unrelated maps.
---

# Interactive climate and geography maps

Create a working map, not an image, mock-up or plan when execution is requested. For proposal-only requests, answer without editing. Respect the user's current scope and existing publication authorization. Preserve approved behavior while adding a requested feature.

Use this skill alongside the Earth-science visualization skill only when building a physical scene or process animation. A thematic map does not require cinematic materials, 3D or photorealism. Use the teaching-design skill when the request includes a lesson or activity; do not add a quiz or tracking to an ordinary atlas.

## Read the relevant reference

- For any change to the existing atlas, read [Nadav's atlas requirements](references/nadav-atlas-requirements.md). It records all substantive corrections from the map-building conversation, including superseded wording and scientific qualifications.
- For rendering, layers, data, typography, interaction or testing, read [Map engineering and verification](references/map-engineering.md).
- For source recovery, concrete data provenance or publication, read [Canonical atlas and source record](references/canonical-atlas.md). Its commit is a dated checkpoint, never a substitute for fetching the current head.
- For a new map, reuse the engineering principles and relevant interface preferences. Keep this atlas's classification, boundary customization, exact labels and data choices scoped to this project unless requested again.

## Start from the authoritative product

1. Retrieve the current source, canonical URL, branch/revision and applicable instructions. Inspect the rendered product when possible. Recover the original implementation before suggesting replacement tools or installation.
2. Translate the latest request into an observable change. Record existing layers, defaults, datasets, selected place, month, camera and access conditions that must remain intact.
3. Work in a recoverable candidate. Do not force overwrite a newer remote revision or overwrite another worker's files. Give independent reviewers read-only scope or disjoint files when delegation is useful and available.
4. Before integration, refresh the current source and latest user messages. Reconcile changes and rerun affected checks if either changed.

## Build from geography and evidence

Use openly licensed geometry and data with specific attribution. Treat an uploaded copyrighted map as inspiration for educational goals and layout only when that is the user's instruction. Do not embed, trace, recolor or republish the supplied original as the new map.

Keep a shared geographic projection, camera and state for every raster, line, marker, label and hit-test. Separate data selection from rendering and independent overlay visibility. Switching a base map or month must not silently disable overlays.

Show what the data supports. Document units, period, native and displayed resolution, sampling and source/model status. Better image sharpness is not better geographic resolution. Prefer source-backed monthly values. If the user authorizes estimates, label them visibly and document their method; never present interpolation or conceptual currents as observed monthly measurements. This atlas now has all 12 actual source months for temperature and precipitation; only intermediate conceptual ITCZ positions are estimated.

Treat terminology changes as a documented pedagogical mapping. Keep source class identifiers and exact membership available. Preserve the distinction between a preferred label, an accepted scientific classification term and a physical property. Resolve scientifically misleading requests transparently instead of encoding them as universal truths.

## Design the interface around the map

For this atlas, use a full-viewport map and a right-hand tools panel. Place the system title above the tools, sources/info and text enlargement in the panel footer, and keep control density off the map. Remove the obsolete top bar/options menu. Allow internal panel scrolling while the document remains fixed; retain zoom and pan. The latest review explicitly requests height-fit at startup/reset, superseding the earlier complete-world default. Keep a clearly labeled whole-world framing action and shared camera geometry; explain that height-fit can extend beyond the horizontal viewport.

Use coherent tabs and groups, a clear all-zones view, separate main/detailed climates, and independent on/off switches for additions. Keep colors, labels, marker meaning and legends consistent. Use one compact latitude label per line in a separate desktop gutter, with tropic aliases only in tooltips. Mobile defaults to lines without labels. Provide an independent visibility switch.

Keep a single 12-month timeline and play/pause control adjacent to the map legend, a stable disabled detail section on non-climate layers, and teaching additions in a collapsed accordion. Use a mobile bottom sheet, persistent selected-point pins, country/region names, hover values and high-contrast current lines with sparse default labels. Implement real text enlargement across DOM, canvas and SVG. A body class alone is insufficient. Recompute layout and redraw labels/charts; avoid double scaling. Check Hebrew punctuation, numeric direction, overlap and clipping on narrow and short screens.

## Verify and deliver

- Run checks proportional to the change: data correctness, state preservation, browser behavior, actual screenshots and publication are distinct forms of evidence.
- Test relevant combinations of base layer, month, overlay, zoom, city and font size. Confirm reset behavior and that turning an overlay off restores the underlying view.
- For this public atlas, preserve the same canonical URL and anonymous viewing. Use existing authorized deployment capabilities before requiring new accounts or installations.
- A successful commit or upload is not verified delivery. Confirm the deployed page and assets correspond to the tested candidate, and provide the public link.
- State only what was tested. Browser viewport/touch simulation is not physical-device testing. When blocked, preserve the candidate and explain the concrete missing capability without claiming success or repeating unproductive attempts.
- Carry useful corrections into these references when authorized, validate the skill and sync it to its actual backing repository. Do not claim that a repository skill has also appeared in the user's personal Skills catalog without verifying that separately.

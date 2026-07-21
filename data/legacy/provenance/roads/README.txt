oex export
==========

Generated:        2026-06-22 21:59:14 UTC
oex version:      0.3.0
Project:          https://github.com/osgeonepal/oex

Country (ISO3):   UGA
Boundary:         geoBoundaries CGAZ ADM0
Bounding box:     (29.5734, -1.4823, 35.0003, 4.2341)

Dataset:          roads
Format:           ESRI Shapefile (shp)
Features:         681,317

Source:           OpenStreetMap contributors
Source URL:       https://www.openstreetmap.org/
Snapshot:         2026-06-22
License:          hdx-odc-odbl
License URL:      https://opendatacommons.org/licenses/odbl/1-0/

About the source
  OpenStreetMap is a community-edited geographic dataset of the world. Country
  features are extracted from the source PBF via quackosm with the union of
  all category tag filters; per-category exports apply tag predicates at query
  time.

Notes
  - Shapefile output is split by geometry type:
    <category>_polygons.shp, <category>_lines.shp, <category>_points.shp.
    This is a shapefile-format limitation, not a data limitation.
  - Field names are truncated to 10 characters in shp; gpkg keeps them full.

Feedback:         https://github.com/osgeonepal/oex/issues
Engine: geofabrik
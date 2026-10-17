# Observatory: what needs a person, not a script

Everything here was found during the 2026-10-17 research pass but could not
(or should not) be fetched automatically. Each item says why and what to do.
Machine-readable status for every source is in
[`data/observatory/catalog.json`](../../data/observatory/catalog.json).

## 1. Manual downloads (free, a browser is enough)

| What | Where | Why a script can't | Drop it in |
|---|---|---|---|
| UBOS microdata: NPHC 2024 (#74), UNHS 2023/24 (#80), UDHS 2022 (#81), Livestock Census 2021 (#116), UNPS waves | https://microdata.ubos.org:7070/index.php/catalog | Free registration and a per-study usage form | `data/legacy/provenance/observatory/ubos-nada/` |
| Uganda Standards Catalogue (31 Dec 2025) | https://www.unbs.go.ug/attachments/menus/27/ | unbs.go.ug returns 403 to every scripted request (a Wayback copy works as a fallback) | `.../unbs/` |
| Uganda Gazette back issues (district creation notices 1959-2026) | https://gazettes.africa/gazettes/ug | No licence stated; Laws.Africa bans bulk scraping. Download the issues you need, or email info@laws.africa for bulk | `.../gazettes/` |
| Y503 1:250,000 and any Y732 1:50,000 sheet scans | https://maps.lib.utexas.edu/maps/uganda.html | Anti-bot challenge | `.../maps/` |
| Index shapefile of the 1:50,000 sheets (CC BY-SA 4.0) | https://repository.mines.edu (search "Uganda 1:50,000 index") | Server refused scripts (403) | `.../maps/` |
| Murdock ethnographic map, Nunn digitisation v2 | https://nathannunn.arts.ubc.ca/?p=2468 | JS challenge; licence also unverified, so read it while there | `.../ethnography/` |
| energydata.info Uganda layers (distribution lines 2023, substations, DRE atlas) | https://energydata.info/dataset?q=uganda | File downloads 403 to curl; CC BY 4.0 | `.../energy/` |
| Wetlands Atlas Vol. I & II | https://wedocs.unep.org/handle/20.500.11822/17429 and /17430 | PDF maps only; for reference and citations | `.../wetlands/` |
| Makerere digital archives (land and Protectorate records) | https://archives.mak.ac.ug | Access level unclear; please check what is public | n/a |
| Ministry of Lands GeoServer layers (zonal offices, topographic WMS, 40 cm orthophoto) | Open https://ugnlis.mlhud.go.ug/, go to the map, and watch the browser's network tab | Blocked to outside scripts; may only work inside the portal session. If WMS tiles load, note the request URLs | notes only |

## 2. Permission requests (data is reachable but terms say ask first)

1. **Ministry of Water & Environment, WEIS GeoServer.** The highest-value
   find: 4 water management zones, 8 basins, 78 catchments, 161 river
   gauges, 8,339 boreholes, 258 dams, wetlands 1994/2008/2015, national
   roads/bridges/culverts, and 44,034 village polygons. MWE's terms
   (https://mwe.go.ug/terms-conditions) forbid robots without written
   permission and forbid commercial reuse. Ask the Directorate of Water
   Resources Management for written permission to mirror these layers in an
   open, attributed, non-commercial dataset. Ask in the same letter for
   access to the hydromet time series (gauge levels, rainfall stations).
2. **UNMA / meteo.mwe.go.ug.** UNMA's site now redirects to a
   password-protected host. Request seasonal forecast GIS files per district
   and ENACTS gridded climate under a data-sharing agreement.
3. **KCCA GIS.** The public FeatureServers (2026 roads, 2040 land-use plan,
   slum boundaries, city parishes) carry no licence. Ask KCCA's GIS unit for
   reuse terms. Request the drainage master plan data at the same time.
4. **UNEP-WCMC, WDPA.** Its licence forbids redistribution. Ask
   protectedareas@unep-wcmc.org whether per-district *statistics* derived
   from it (area protected per district) may be published. Until then use
   OpenStreetMap protected areas for anything shipped.
5. **ETH Zurich ICR (GREG/GeoEPR)** and **Laws.Africa**: no licence
   stated; ask before re-hosting.

## 3. Access to Information Act requests

Process (ATI Act 2005, Regulations S.I. 17/2011): write to the body's
Information Officer (normally the Permanent Secretary or CEO) using Form A.
They have 21 days to decide, extendable once by 21 days; silence is deemed
refusal. A UGX 20,000 access fee is reported (check the S.I. text) plus
reproduction costs. Complaints go to the Chief Magistrate. Ask only for
non-personal, aggregate data. That keeps you clear of the s.26 privacy
exemption and of the Data Protection and Privacy Act 2019.

| Body | Ask for |
|---|---|
| Ministry of Lands (MLHUD) | Zonal office and district polygons; block index map; survey-sheet index (1:2,500 / 1:10,000 grids); count of titles by tenure (mailo/freehold/leasehold) per district; count of Certificates of Customary Ownership per district; Arc 1960 to UGRF transformation parameters |
| National Forestry Authority | Central Forest Reserve boundaries (GIS) |
| Uganda Wildlife Authority | National park and wildlife reserve boundaries (GIS) |
| Uganda Land Commission | Summary of the government land inventory by district |
| MAAIF | Agro-ecological zones (GIS); fall armyworm and pest surveillance counts by district |
| Petroleum Authority | Exploration and production licence block polygons |
| Electoral Commission | 2026 polling-station list with coordinates |
| Ministry of ICT | Full national postcode/addressing list |

## 4. Things to report, not ingest

These were noticed in passing and deliberately left alone. Consider a quiet
note to each agency:

- **MWE**: its GeoServer publishes a layer named `SDC:users`, and
  `wis.mwe.go.ug` exposes a Webmin admin login to the internet.
- **KCCA**: the `Kampala_All_Arrears_26` and Survey123 services appear to
  hold property-tax records with public access.
- **UCC**: a staff ArcGIS account publishes telecom tower, fibre and
  medium-voltage grid locations without a licence.
- **MLHUD**: the public dictionary API returns internal 172.x LAN
  addresses (stripped from our copy).

## 5. Timing

The Ministry of ICT, UNDP and UN Global Pulse launch **Uganda's National
Data Strategy on 20 October 2026** (Mestil Hotel, Kampala). The strategy
text is not published yet. That launch is the natural moment to introduce
this project as an open reference for administrative units and P-codes.

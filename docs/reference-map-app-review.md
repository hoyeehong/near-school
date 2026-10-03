# Reference map-app review

Reviewed 3 October 2026. This is a source review of the supplied `map-app` folder, not validation of its README's production-readiness claims. The reference was not executed or modified. Graphify's structural extraction found 129 symbols and 355 relationships across the selected frontend/backend code; one JSX file (`AdvisoryInfoCard.jsx`) had a partial parse, so relevant components were also read directly.

## Recommended ports

| Reference | Recommendation | Integration into Near School |
| --- | --- | --- |
| `src/components/MapView.jsx`: GeoJSON catchment layers | **Implemented as exploration perimeters.** Highest immediate visual value. | Reuse the rendering pattern, with a small typed spherical geometry helper rather than adding Turf. Select a location, choose 1 km / 2 km / Off, and retain its centre marker while amenities are filtered. Rings never determine official registration eligibility. |
| `src/components/HdbComparisonMatrix.jsx` | **Next priority:** compare shortlisted locations and nearby amenities. | Adapt the table and sorting interaction. Use verified, dated HDB data before adding prices or lease comparisons; static fixture values are unsuitable for housing decisions. |
| `src/components/ExecutionTracePanel.jsx` | **Good portfolio enhancement:** optional explanation of tools used. | Expose sanitized tool names, source citations, outcomes and real wall-clock durations from existing bounded tools. The reference sums span durations even though some operations run concurrently; do not label that sum total elapsed time. Never expose credentials or residential prompts. |
| `src/components/DossierApprovalModal.jsx` | **Later:** preview and export a sourced school shortlist. | Use neutral planning-report language, explicit data dates and citations. User approval of an export does not certify its factual accuracy. |
| `backend/mcp_server.py` | **Optional developer integration.** | Wrap existing validated Near School tools if an external MCP client is a real requirement. Add authentication and limits before exposure. |
| `backend/state_graph.py` | **Defer a wholesale backend port.** | The current Next.js / Vertex AI / Cloud SQL design already supports grounded questions and map actions. Add durable orchestration only when multi-step resumable workflows justify the extra service and state management. |

## Logic and operational issues to avoid importing

- The frontend odds calculator describes the two tracks as within/beyond 2 km, while `backend/mcp_server.py` marks Track 2 as strictly within 1 km and excludes homes beyond 2 km. They disagree. Keep one tested policy implementation backed by MOE sources.
- `src/utils/oddsCalculator.js` supplies default projected probabilities such as 52% and 34%, plus default seat counts. These are assumptions, not reliable forecasts. Do not display them as admission odds.
- Point-to-point distance in `geoUtils.js` and the backend is not official home-school distance. Near School's official-distance lookup must continue to fail closed when authoritative data is unavailable.
- `geoUtils.js` falls back to a Singapore Central coordinate when location resolution fails. Return an explicit unresolved-location result instead of silently pinning the wrong place.
- Map popup HTML interpolates values. Use escaped text or React-rendered content before introducing external datasets.
- The reference's LangGraph `MemorySaver` is process-local and cannot provide durable cross-instance Cloud Run resume state. Client-supplied thread IDs also need authenticated ownership checks before a public resumable workflow.
- The FastAPI gateway permits broad cross-origin access. A production port needs explicit origins, authentication where appropriate and request limits; the current Near School protections should remain in place.
- A tilted raster map is not evidence of 3D building data. The reviewed map uses pitch changes, without a building extrusion layer.

## Delivered perimeter behaviour

The dashed teal ring measures approximately 1 or 2 km from the selected map coordinate. It is available for schools and other geocoded places, defaults to 2 km, and is removable. Selecting a radius frames the ring. A selected centre remains visible when filtered out of the results, without adding it to the result count. Asking about amenities can still focus the returned locations. Closing the selection removes the ring. “Show more map” collapses the details without clearing the selection. MapLibre’s geometry worker and shared module are copied from the locked dependency into public assets during development/build and included in the deployed container.

The ring is an exploration aid, not a walking route, school land-boundary buffer, official home-school distance classification or admission guarantee. The hosted location catalogue remains illustrative until verified data is published.

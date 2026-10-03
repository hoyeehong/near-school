# Data contracts and provenance

`data/demo.ts` contains labelled illustrative locations. It is never used to generate official classifications. The MOE summary list records the 12 participating schools, but school sites still require year-specific review, especially temporary or relocated campuses.

`npm run data:refresh` downloads the official MOE directory into ignored `data/candidates/`. With `ONEMAP_TOKEN`, it resolves school postal codes; without it, coordinates stay null. Mixed-level schools need review to distinguish primary-plus-secondary from secondary-plus-JC records. The importer intentionally does not publish automatically.

Additional normalised HDB and amenity snapshots can be passed as file arguments. Each is an array satisfying `placeSchema` in `lib/types.ts`: stable id, name, category, address, nullable WGS84 `[longitude, latitude]`, source URL, source date, quality and optional `twoTrackFrom`. Preserve building-specific IDs; do not merge an entire estate into one home address. Only verified residential HDB records use category `hdb`.

## Official distances

No supported SchoolQuery API has been assumed. Obtain a permitted API/export from the responsible agency before filling this table. No private endpoint scraping is included.

A reviewed publication file contains:

```json
{
  "version": "approved-source-version",
  "places": [],
  "report": { "reviewedBy": "operator", "sourceYear": 2027 },
  "officialDistances": [
    {
      "addressId": "canonical-building-id",
      "schoolId": "canonical-school-id",
      "year": 2027,
      "band": "between-1-and-2km",
      "sourceUrl": "https://www.onemap.gov.sg/",
      "verifiedAt": "2027-06-01"
    }
  ]
}
```

The example is a contract, not a real classification. Populate places with the reviewed national school directory and authorised neighbourhood data. Set `OFFICIAL_DISTANCE_REUSE_APPROVED=true` and `OFFICIAL_DISTANCE_SOURCE_URL` only after review. `npm run data:publish -- FILE` validates the release gate and atomically replaces the published snapshot. Unknown address-school pairs remain unverified even after release.

The `≤2km` track includes official within-1km and 1–2km categories. The `>2km` track uses the official beyond-2km category. The frontend draws verified building points; it does not interpolate an official continuous boundary from sparse classifications.

Policy summaries include effective years and source URLs. Ingestion creates embeddings using the configured model and stores its identifier; retrieval never compares embeddings from different models. A model change requires re-embedding the corpus.

No school enrolment, applicant count, eligibility or ballot probability is inferred from public housing density.

## Verified housing transactions

The Homes view reads PostgreSQL transaction aggregates, independently of the school catalogue's `DATA_MODE`. It never substitutes illustrative prices. URA private residential transactions are fetched server-side using a daily token and all four `PMI_Resi_Transaction` batches. SVY21 project coordinates are converted to WGS84. HDB resale records come from data.gov.sg dataset `d_8b84c4ee58e3cfc0ece0d773c8ca6abc`; they are mapped only after an exact OneMap address match. Unmapped blocks remain searchable but cannot appear in radius searches.

The import retains approximately five years, publishes each source atomically, and preserves the last successful source snapshot on failure. Project rows can recur across URA batches: project keys are deduplicated while repeated, indistinguishable transaction records retain occurrence IDs. There is no unit-level identity in the public source, so the application does not infer one. A daily job at 07:30 Singapore time refreshes data and attempts up to 500 new HDB addresses. Unresolved matches are cached for 30 days to avoid preventing progress through the remaining addresses.

Median price, middle 50% price range, median area, sales count and PSF describe only transactions matching the displayed period, sale type, price, area and property-type filters. Bulk transactions are excluded from aggregates. PSF is suppressed when area bases are mixed or unknown. Small and mixed samples are identified. Latest transaction tables show all types and explicitly label bulk records. Saved comparisons preserve their filter description and source timestamp; they are browser-local snapshots, not current valuations or sale listings.

School search points and exploration circles remain illustrative where labelled. Neither a housing coordinate nor a route establishes MOE home–school distance eligibility. Journeys resolve the school address through OneMap when its catalogue coordinate is illustrative, but do not claim to identify a verified school gate. No article text or proprietary Straits Times map data is republished.

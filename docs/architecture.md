# Architecture decisions

## A map assistant with bounded authority

The language model interprets the question and selects a tool. Zod validates every tool argument; the server executes parameterised queries and derives map actions from returned feature IDs. The browser accepts only those known IDs. The model never supplies executable SQL or new coordinates.

This separates three kinds of evidence:

| Question                                             | Implementation                                                     | Evidence required                  |
| ---------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| Which parks are near a school?                       | Spatial query using PostGIS, or sample point distance in demo mode | Stored locations and a radius      |
| What changes in Phase 2C?                            | Effective-year policy retrieval followed by a sourced answer       | Reviewed MOE summaries and links   |
| Which registration distance band applies to my home? | Exact address–school–year lookup                                   | Authorised official classification |

RAG helps explain policy; it cannot establish official distance eligibility. A circle around a school point is not a replacement for an authorised classification. Missing official records produce an unverified result.

## Independent data and assistant modes

`DATA_MODE=demo` keeps illustrative locations visibly labelled. `AI_MODE=live` can independently enable the Vertex assistant and database-backed policy retrieval over those sample locations. Local users can run both modes as `demo` without credentials. Official place publication is a separate reviewed gate.

Policies are filtered by effective year. When embeddings are available, reciprocal-rank fusion combines full-text and vector rankings. If embedding generation fails, retrieval falls back to full-text ranking. The initial corpus contains only four reviewed summaries: it demonstrates the retrieval path, not broad coverage of every registration question.

## Managed infrastructure and its tradeoffs

Cloud Run hosts the web application and separate migration, seed, refresh and evaluation jobs. Cloud SQL uses regional high availability, private addressing, PostGIS and pgvector. The connector establishes authenticated encrypted connections. Regional HA protects against some zonal failures; it does not establish a tested recovery time or protect against an entire region outage.

The runtime database role reads published data and writes rate/budget counters. A separate migration identity changes schemas. GitHub uses OIDC restricted to this repository's owner ID and `main`; no service-account private key is stored in GitHub. The release identity can deploy application images but cannot administer project IAM.

The fixed database and warm-instance costs are deliberately higher than a minimal portfolio hosting setup. Vertex calls have bounded tool rounds and output length, per-client throttling, and a shared monthly reservation ledger. That ledger limits application calls; it is not a GCP-wide spending cap.

## Delivery and validation

Pull requests run TypeScript, lint, domain tests, actual PostgreSQL extension/migration tests, deterministic assistant cases, production builds, dependency auditing, Terraform validation, and Chromium tests at desktop and mobile sizes. Live-model evaluations are separate paid runs and retain their own evidence.

After passing checks, the deployment workflow publishes immutable image digests, runs migrations, and deploys a candidate revision without production traffic. It smoke-tests the candidate before switching traffic, then tests the public service. A failed public check restores the preceding application revision. Schema changes must remain backward compatible because application rollback does not undo migrations.

The refresh job stages candidate source snapshots. Publication requires reviewed provenance, geometry, exercise year and official distance evidence. A successful download never automatically makes a dataset official.

## Remaining acceptance work

An official-data release still needs authorised address-distance records, completed place geometry, OneMap token operations and a reviewed publication. Recovery claims need a Cloud SQL failover and backup-restore exercise. The current live-model evaluation is a small regression set, not a statistically meaningful accuracy benchmark. These boundaries are explicit so reviewers can distinguish implemented mechanisms from demonstrated production readiness.

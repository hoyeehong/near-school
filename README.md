# Near School

A conversational map for Singapore P1 registration: schools, residential neighbourhoods, family amenities and the 2027 Phase 2C two-track scheme.

**Current release: working portfolio demo.** Includes 14 illustrative school locations (the 12 two-track schools plus two comparison schools), sample HDB blocks and amenities. These coordinates are not official registration geometry. No official distance categories are bundled or inferred. Live Vertex AI, authorised data import and GCP infrastructure are implemented but require configuration.

## Run locally

Node.js 24 is recommended.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. No API keys or database are required for demo mode. OneMap basemap tiles need an internet connection; the accessible results list remains usable without them.

Try **Show the two-track schools**, select Nanyang, then **Find parks nearby**. The local assistant is deliberately labelled as a deterministic guided demo, not a live language model.

## Architecture

Read the [architecture decisions and tradeoffs](docs/architecture.md) for the boundaries between spatial search, RAG and official eligibility.

```mermaid
flowchart LR
  Browser[Next.js + MapLibre] --> Run[Cloud Run API]
  Run --> Rules[Validated tools + year-specific rules]
  Run --> Vertex[Vertex AI]
  Vertex --> Rules
  Rules --> SQL[(Cloud SQL: PostGIS + pgvector)]
  Jobs[Cloud Run import jobs] --> SQL
  Jobs --> Storage[Versioned source snapshots]
  GitHub[GitHub Actions + OIDC] --> Registry[Artifact Registry]
  Registry --> Run
```

- Spatial tools return stored feature IDs; the model cannot invent map coordinates or execute SQL.
- Official classifications are exact address–school–exercise-year records. Unknown or wrong-year records fail closed.
- Keyword and vector retrieval filters policy by effective year. Embedding failures fall back to keyword retrieval.
- AI calls reserve a conservative per-request maximum from an atomic monthly database budget. Validate the reservation against current model prices before enabling live mode.
- Runtime and migration database roles are separate. Production connections use the Cloud SQL connector over private networking.
- No home addresses or conversation text are intentionally logged by the application. Infrastructure access logs require appropriate retention policies.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run eval
npm run build
npx playwright install chromium
npm run test:e2e
```

The deterministic evaluation is not evidence of live-model accuracy. It writes `artifacts/evaluation.json`. Run paid model evaluations explicitly with `EVAL_LIVE=true`, after configuring ADC and Vertex models.

For database integration tests:

```sh
docker compose up -d --build --wait
export DATABASE_URL='postgresql://nearschool:local-only-password@localhost:5432/nearschool'
npm run db:migrate
npm run db:seed
TEST_DATABASE_URL="$DATABASE_URL" npm test
```

## Deployment and data

See [GCP deployment](docs/deployment.md), [data contracts](docs/data.md), and [operations](docs/operations.md).

The application and jobs have separate Docker targets. Terraform provisions regional HA PostgreSQL in Singapore, a warm Cloud Run service, private networking, secrets, monitoring and GitHub federation. GitHub Actions tests pull requests, deploys passing merges to `main`, runs migrations, checks a new revision before switching traffic, and restores the previous application revision on failure.

Official distance integration is a release gate, not a future promise hidden behind an approximate radius. Until authorised 2027 data is obtained and reviewed, publish only the clearly labelled demo.

## Sources and attribution

- [MOE 2027 framework changes](https://www.moe.gov.sg/primary/p1-registration/changes-to-p1-registration-framework)
- [MOE school directory](https://data.gov.sg/datasets/d_688b934f82c1059ed0a6993d2a829089/view)
- [SLA OneMap](https://www.onemap.gov.sg/) — basemap and optional address search
- [HDB existing buildings](https://data.gov.sg/datasets/d_16b157c52ed637edd6ba1232e026258d/view)

Policy snippets are short, manually reviewed summaries linked to MOE, not full reproductions. Source-data licences and attribution requirements remain separate from the code. This is an independent project, not affiliated with MOE, SLA or HDB.

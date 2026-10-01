# Validation evidence

Validated on 1–2 October 2026 (Singapore time). Application commit: `0c8256b42f5ec970c32d1588edd8c60ab3512518`.

- [GitHub release checks](https://github.com/hoyeehong/near-school/actions/runs/36887601066): TypeScript, lint, security audit, production build, Terraform validation, 13 domain/database tests with PostgreSQL, and 10 desktop/mobile browser tests.
- Dependency audit after upgrading Next.js to 16.3.8: zero reported vulnerabilities.
- Live GCP evaluation: `near-school-evaluate-zjdgr`, Gemini `gemini-3.5-flash-lite`, embeddings `gemini-embedding-001`, private Cloud SQL policy retrieval. All five cases passed.

| Live question                      | Expected behaviour                                      | Latency |
| ---------------------------------- | ------------------------------------------------------- | ------- |
| Show the two-track schools (2027)  | Select 12 known school IDs                              | 5.518 s |
| Show the two-track schools (2026)  | Select no two-track schools                             | 4.533 s |
| Which track applies to my address? | Report unavailable/unverified distance; no map mutation | 3.883 s |
| Explain the new Phase 2C rules     | Return retrieved source citations                       | 4.036 s |
| Find parks near Nanyang            | Select known park IDs                                   | 1.745 s |

These timings are individual observations, not percentile measurements or an SLA. Five cases are a regression smoke test, not a broad accuracy benchmark. Map locations remain illustrative, and official registration distance records are not published.

The hosted desktop and mobile layouts were also visually inspected. Database migration and embedding seeding completed through Cloud Run jobs. HA failover, backup restoration, alert delivery and forced rollback rehearsals remain untested; see [operations](operations.md).

To repeat the paid cloud model check after seeding:

```sh
gcloud run jobs execute near-school-evaluate --wait --region=asia-southeast1 --project=YOUR_PROJECT
```

The current evaluation script writes a structured `assistant_evaluation` log with model identifiers, fixture answers, citations, validated map actions and timings. It contains public test fixtures only.

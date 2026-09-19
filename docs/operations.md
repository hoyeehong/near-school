# Operations and acceptance

## Recovery

- **Application rollback:** `gcloud run services update-traffic near-school --to-revisions=PREVIOUS_REVISION=100 --region=asia-southeast1`. Additive migrations must support the previous revision. Do not auto-run destructive down migrations.
- **Database failover:** during an announced test window, trigger Cloud SQL failover; watch database reconnection and end-to-end requests. Record interruption duration. A warm container does not prevent database failover interruption.
- **Restore:** restore a backup into a separate instance, run row-count/category/source checks, and record recovery time. Never test restore over the only production database.
- **Data rollback:** republish a previously reviewed snapshot with a new version identifier. Preserve old source snapshots and record why the rollback occurred.

## Security and budget

Application queries use the restricted runtime DB role; only Cloud Run jobs receive migration credentials. The Cloud SQL connector establishes authenticated TLS over the private network. DB passwords are kept in Secret Manager; generated passwords also exist in restricted Terraform state.

The AI gate uses a shared database counter and reserves `AI_REQUEST_RESERVATION_SGD` for every call before inference, including calls that time out. This is a conservative accounting mechanism, not provider billing reconciliation. Verify the reservation covers the maximum tool rounds, embeddings, input and output at the selected model's current prices; increase it if needed. The application caps message size and tool rounds. Set provider quotas and billing alerts as additional controls.

The request limiter hashes the Cloud Run-forwarded IP with a private salt. Verify forwarding behaviour if adding another proxy/load balancer. Clear obsolete minute buckets with an operational retention job. No raw addresses or conversation text should be added to logs.

## Remaining acceptance gates

- An authorised 2027 distance source and the full reviewed school/HDB/amenity snapshot.
- Vertex model availability, live evaluation, latency and measured provider usage.
- HA failover and restore rehearsal on provisioned infrastructure.
- Notification delivery and actual release rollback rehearsal.
- Review data reuse permissions and changing school sites before claiming official year coverage.

Keep evidence in release notes: commit/image digest, test reports, evaluated model version, dataset version, recovery timings and known limitations. Never report deterministic demo evaluation as live RAG accuracy.

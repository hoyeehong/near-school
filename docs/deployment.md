# GCP and GitHub deployment

## Cost and prerequisites

This configuration is **paid high availability**, not a free-tier deployment: a regional Cloud SQL Enterprise 2-vCPU / 8-GB instance, 20-GB SSD, backups and a warm Cloud Run instance. Obtain a Singapore-region estimate from the Google Cloud calculator before applying. AI's S$30 budget is separate. Budget alerts do not stop infrastructure charges.

Required: a GCP project with billing; permission to create networks, IAM roles, Cloud SQL and Cloud Run; a GitHub repository; Node 24, Docker, Terraform and gcloud. `gh` is optional for repository settings. Never commit `.tfvars`, Terraform state, saved plans, credentials or data containing residential searches.

## Bootstrap

1. Create the project with `gcloud projects create PROJECT_ID --name='Near School'`. Enable Cloud Billing API and link your selected billing account. Do not reuse another application's project by accident.
2. Enable the bootstrap APIs (`cloudresourcemanager.googleapis.com`, `iam.googleapis.com`, `serviceusage.googleapis.com`, `artifactregistry.googleapis.com`) and create the `near-school` Docker repository in `asia-southeast1`. Pass both `--project=PROJECT_ID` and `--billing-project=PROJECT_ID` to gcloud so an old CLI quota project cannot receive these calls.
3. Build the two images with `docker build --platform linux/amd64 --target runner` and `--target jobs`, push to Artifact Registry, and record their immutable digests.
4. Create `gs://PROJECT_ID-tfstate` with uniform bucket-level access, public-access prevention and versioning. Restrict state access to administrators; Terraform stores generated DB passwords in state.
5. Authenticate Terraform using Application Default Credentials or an ephemeral access token from your signed-in gcloud account. Copy `infra/terraform.tfvars.example` to an ignored `.tfvars` file and supply project, GitHub repository, numeric owner ID, notification email and image digests.
6. Run:

```sh
terraform -chdir=infra init -backend-config='bucket=PROJECT_ID-tfstate' -backend-config='prefix=near-school'
terraform -chdir=infra plan -out=release.tfplan
terraform -chdir=infra apply release.tfplan
```

7. If the registry was bootstrapped with gcloud, import it **before step 6's plan**: `terraform -chdir=infra import google_artifact_registry_repository.app projects/PROJECT_ID/locations/asia-southeast1/repositories/near-school`.
8. Execute `near-school-migrate` and then `near-school-seed` using `gcloud run jobs execute JOB --region=asia-southeast1 --wait`. The application defaults to labelled demo mode during this bootstrap.

Model IDs are configurable. Check availability and prices in the Vertex project before enabling `AI_MODE=live`. The default Vertex endpoint is global: do not claim Singapore-only model processing. Cloud SQL and the web service are in Singapore.

The configured generation model is `gemini-3.5-flash-lite` and the embedding model is `gemini-embedding-001` (768 dimensions). Both passed a project API availability check on 19 September 2026. Model availability alone does not establish answer quality: execute the `near-school-evaluate` job after seeding and inspect its results before enabling the live assistant. See Google's [model lifecycle](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions) and [pricing](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing) before changing these settings. The S$0.25 request reservation is deliberately conservative for the bounded text-only tools; it is not an exact billing reconciliation.

## GitHub setup

Create a public repository and push this folder. Set these repository variables from Terraform outputs:

| Variable                         | Value                               |
| -------------------------------- | ----------------------------------- |
| `GCP_PROJECT_ID`                 | project ID                          |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `workload_identity_provider` output |
| `GCP_DEPLOY_SERVICE_ACCOUNT`     | `deploy_service_account` output     |

Create the `production` environment restricted to `main`. Protect `main` with required quality, database and Terraform checks. Require pull requests, but do not require another reviewer for a solo repository. Test forked PRs without secrets; no `pull_request_target` workflow is used. The OIDC provider permits only the named repository, numeric owner and `main` ref.

The release workflow builds app/jobs images, migrates inside GCP, deploys a zero-traffic revision, smoke-tests it, switches traffic, and smoke-tests the public URL. Releases are serialized. Infrastructure changes are intentionally separate: an administrator reviews and applies a saved Terraform plan; the application deployer is not granted IAM or database administration.

Use the `Review data candidate` workflow or weekly Cloud Scheduler job to stage updated source data. This never automatically changes published policy or distance classifications.

## Enable live services

- Add a valid OneMap token to Secret Manager and bind `ONEMAP_TOKEN` to that secret on the application and refresh job. Token renewal is an operator responsibility; expired tokens fail visibly.
- Complete the reviewed snapshot contract in `docs/data.md`, import it with `data:publish` inside the private network, then change Terraform `data_mode` to `live`.
- Enable Vertex only after seeding embeddings, configuring a conservative request reservation and passing live-model evaluations.
- Apply settings through Terraform to avoid configuration drift; GitHub owns image revisions and traffic.

Do not equate application smoke tests with an end-to-end availability guarantee. Perform the failover and restore exercises in `operations.md` before claiming recovery targets.

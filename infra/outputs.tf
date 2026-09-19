output "service_url" {
  value = google_cloud_run_v2_service.app.uri
}
output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
output "deploy_service_account" {
  value = google_service_account.deployer.email
}
output "registry" {
  value = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}
output "snapshot_bucket" {
  value = google_storage_bucket.snapshots.name
}

locals {
  services = toset(["run.googleapis.com", "sqladmin.googleapis.com", "compute.googleapis.com", "servicenetworking.googleapis.com", "secretmanager.googleapis.com", "artifactregistry.googleapis.com", "aiplatform.googleapis.com", "iamcredentials.googleapis.com", "sts.googleapis.com", "monitoring.googleapis.com", "logging.googleapis.com", "cloudscheduler.googleapis.com"])
}
resource "google_project_service" "apis" {
  for_each           = local.services
  service            = each.value
  disable_on_destroy = false
}
resource "google_compute_network" "app" {
  name                    = "near-school"
  auto_create_subnetworks = false
  depends_on              = [google_project_service.apis]
}
resource "google_compute_subnetwork" "app" {
  name                     = "near-school-run"
  network                  = google_compute_network.app.id
  ip_cidr_range            = "10.24.0.0/24"
  private_ip_google_access = true
}
resource "google_compute_global_address" "sql" {
  name          = "near-school-sql-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.app.id
}
resource "google_service_networking_connection" "sql" {
  network                 = google_compute_network.app.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.sql.name]
}
resource "google_sql_database_instance" "postgres" {
  name                = "near-school-db"
  database_version    = "POSTGRES_16"
  deletion_protection = true
  depends_on          = [google_service_networking_connection.sql]
  settings {
    tier                        = "db-custom-2-8192"
    edition                     = "ENTERPRISE"
    availability_type           = "REGIONAL"
    disk_size                   = 20
    disk_type                   = "PD_SSD"
    disk_autoresize             = true
    disk_autoresize_limit       = 100
    deletion_protection_enabled = true
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "19:00"
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }

    }
    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.app.id
      ssl_mode        = "ENCRYPTED_ONLY"

    }
    maintenance_window {
      day  = 7
      hour = 19

    }

  }
}
resource "google_sql_database" "app" {
  name     = "nearschool"
  instance = google_sql_database_instance.postgres.name
}
resource "random_password" "db" {
  length  = 32
  special = false
}
resource "random_password" "salt" {
  length  = 48
  special = false
}
resource "google_sql_user" "migrator" {
  name     = "nearschool_migrator"
  instance = google_sql_database_instance.postgres.name
  password = random_password.db.result
}
resource "random_password" "runtime_db" {
  length  = 32
  special = false
}
resource "google_sql_user" "runtime" {
  name     = "nearschool_runtime"
  instance = google_sql_database_instance.postgres.name
  password = random_password.runtime_db.result
}
resource "google_secret_manager_secret" "secrets" {
  for_each  = toset(["database-url", "migration-database-url", "rate-limit-salt", "onemap-token"])
  secret_id = "near-school-${each.value}"
  replication {
    auto {}
  }
  depends_on = [google_project_service.apis]
}
resource "google_secret_manager_secret_version" "db" {
  secret      = google_secret_manager_secret.secrets["database-url"].id
  secret_data = "postgresql://${google_sql_user.runtime.name}:${random_password.runtime_db.result}@${google_sql_database_instance.postgres.private_ip_address}:5432/nearschool?sslmode=require"
}
resource "google_secret_manager_secret_version" "migration_db" {
  secret      = google_secret_manager_secret.secrets["migration-database-url"].id
  secret_data = "postgresql://${google_sql_user.migrator.name}:${random_password.db.result}@${google_sql_database_instance.postgres.private_ip_address}:5432/nearschool?sslmode=require"
}
resource "google_secret_manager_secret_version" "salt" {
  secret      = google_secret_manager_secret.secrets["rate-limit-salt"].id
  secret_data = random_password.salt.result
}
resource "google_service_account" "runtime" {
  account_id = "near-school-runtime"
}
resource "google_service_account" "jobs" {
  account_id = "near-school-jobs"
}
resource "google_service_account" "deployer" {
  account_id = "near-school-deployer"
}
resource "google_project_iam_member" "runtime_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_project_iam_member" "sql_client" {
  for_each = { runtime = google_service_account.runtime.email, jobs = google_service_account.jobs.email }
  project  = var.project_id
  role     = "roles/cloudsql.client"
  member   = "serviceAccount:${each.value}"
}
resource "google_project_iam_member" "jobs_vertex" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.jobs.email}"
}
resource "google_secret_manager_secret_iam_member" "runtime" {
  for_each  = toset(["database-url", "rate-limit-salt", "onemap-token"])
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
resource "google_secret_manager_secret_iam_member" "jobs" {
  for_each  = toset(["migration-database-url", "onemap-token"])
  secret_id = google_secret_manager_secret.secrets[each.value].id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.jobs.email}"
}
resource "google_artifact_registry_repository" "app" {
  repository_id = "near-school"
  format        = "DOCKER"
  depends_on    = [google_project_service.apis]
}
resource "google_storage_bucket" "snapshots" {
  name                        = "${var.project_id}-near-school-snapshots"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  versioning {
    enabled = true
  }
  lifecycle_rule {
    condition {
      age            = 90
      matches_prefix = ["candidates/"]

    }
    action {
      type = "Delete"
    }

  }
}
resource "google_storage_bucket_iam_member" "jobs" {
  bucket = google_storage_bucket.snapshots.name
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.jobs.email}"
}
resource "google_cloud_run_v2_service" "app" {
  name                = "near-school"
  location            = var.region
  deletion_protection = true
  template {
    service_account                  = google_service_account.runtime.email
    max_instance_request_concurrency = 20
    timeout                          = "120s"
    scaling {
      min_instance_count = 1
      max_instance_count = 5

    }
    vpc_access {
      egress = "PRIVATE_RANGES_ONLY"
      network_interfaces {
        network    = google_compute_network.app.name
        subnetwork = google_compute_subnetwork.app.name

      }

    }
    containers {
      image = var.app_image
      resources {
        limits = {
          cpu = "1", memory = "1Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true

      }
      ports {
        container_port = 8080
      }
      dynamic "env" {
        for_each = {
          DATA_MODE = var.data_mode, AI_MODE = var.ai_mode, GOOGLE_CLOUD_PROJECT = var.project_id, INSTANCE_CONNECTION_NAME = google_sql_database_instance.postgres.connection_name, GOOGLE_CLOUD_LOCATION = "global", VERTEX_MODEL = var.vertex_model, VERTEX_EMBEDDING_MODEL = var.embedding_model, AI_MONTHLY_BUDGET_SGD = "30", AI_REQUEST_RESERVATION_SGD = "0.25"
        }
        content {
          name  = env.key
          value = env.value

        }

      }
      dynamic "env" {
        for_each = {
          DATABASE_URL = "database-url", RATE_LIMIT_SALT = "rate-limit-salt"
        }
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets[env.value].secret_id
              version = "latest"

            }

          }

        }

      }
      startup_probe {
        http_get {
          path = "/api/health"
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 12

      }

    }

  }
  lifecycle {
    ignore_changes = [template[0].containers[0].image, client, client_version, traffic]
  }
  depends_on = [google_secret_manager_secret_version.db, google_secret_manager_secret_version.salt, google_secret_manager_secret_iam_member.runtime]
}
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.app.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
resource "google_cloud_run_v2_job" "jobs" {
  for_each            = toset(["migrate", "seed", "refresh", "evaluate"])
  name                = "near-school-${each.value}"
  location            = var.region
  deletion_protection = false
  template {
    template {
      service_account = google_service_account.jobs.email
      max_retries     = 0
      timeout         = "1800s"
      vpc_access {
        egress = "PRIVATE_RANGES_ONLY"
        network_interfaces {
          network    = google_compute_network.app.name
          subnetwork = google_compute_subnetwork.app.name

        }

      }
      containers {
        image   = var.jobs_image
        command = ["node"]
        args    = ["--import", "tsx", "scripts/${each.value}.ts"]
        resources {
          limits = {
            cpu = "1", memory = "1Gi"
          }
        }
        env {
          name = "DATABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.secrets["migration-database-url"].secret_id
              version = "latest"

            }

          }

        }
        dynamic "env" {
          for_each = {
            GOOGLE_CLOUD_PROJECT = var.project_id, INSTANCE_CONNECTION_NAME = google_sql_database_instance.postgres.connection_name, GOOGLE_CLOUD_LOCATION = "global", VERTEX_MODEL = var.vertex_model, VERTEX_EMBEDDING_MODEL = var.embedding_model, SNAPSHOT_BUCKET = google_storage_bucket.snapshots.name, DATA_MODE = "demo", AI_MODE = each.value == "evaluate" ? "live" : "demo", EVAL_LIVE = each.value == "evaluate" ? "true" : "false"
          }
          content {
            name  = env.key
            value = env.value

          }

        }

      }

    }

  }
  lifecycle {
    ignore_changes = [template[0].template[0].containers[0].image, client, client_version]
  }
  depends_on = [google_secret_manager_secret_version.migration_db, google_secret_manager_secret_iam_member.jobs]
}
resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "near-school-github"
  depends_on                = [google_project_service.apis]
}
resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  attribute_mapping = {
    "google.subject" = "assertion.sub", "attribute.repository" = "assertion.repository", "attribute.repository_owner_id" = "assertion.repository_owner_id"
  }
  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.repository_owner_id == '${var.github_owner_id}' && assertion.ref == 'refs/heads/main'"
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}
resource "google_service_account_iam_member" "federation" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
resource "google_project_iam_member" "deployer" {
  for_each = toset(["roles/run.developer", "roles/artifactregistry.writer"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.deployer.email}"
}
resource "google_service_account_iam_member" "act_as" {
  for_each = {
    runtime = google_service_account.runtime.name, jobs = google_service_account.jobs.name
  }
  service_account_id = each.value
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.deployer.email}"
}
resource "google_service_account" "scheduler" {
  account_id = "near-school-scheduler"
}
resource "google_cloud_run_v2_job_iam_member" "scheduler" {
  name     = google_cloud_run_v2_job.jobs["refresh"].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.scheduler.email}"
}
resource "google_cloud_scheduler_job" "refresh" {
  name      = "near-school-weekly-refresh"
  schedule  = "0 9 * * 1"
  time_zone = "Asia/Singapore"
  http_target {
    uri         = "https://run.googleapis.com/v2/projects/${var.project_id}/locations/${var.region}/jobs/${google_cloud_run_v2_job.jobs["refresh"].name}:run"
    http_method = "POST"
    oauth_token {
      service_account_email = google_service_account.scheduler.email
    }

  }
}

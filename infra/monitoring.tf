resource "google_monitoring_notification_channel" "email" {
  display_name = "Near School operator"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}
resource "google_monitoring_uptime_check_config" "app" {
  display_name = "Near School health"
  timeout      = "10s"
  period       = "300s"
  http_check {
    path         = "/api/health"
    port         = 443
    use_ssl      = true
    validate_ssl = true

  }
  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id, host = trimprefix(google_cloud_run_v2_service.app.uri, "https://")
    }

  }
}
resource "google_monitoring_alert_policy" "uptime" {
  display_name          = "Near School unavailable"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.name]
  conditions {
    display_name = "Health check failed"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND resource.type=\"uptime_url\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.app.uptime_check_id}\""
      comparison      = "COMPARISON_LT"
      threshold_value = 1
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_FRACTION_TRUE"

      }
      trigger {
        count = 1
      }

    }

  }
}

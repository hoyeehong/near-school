variable "project_id" {
  type = string
}
variable "region" {
  type    = string
  default = "asia-southeast1"
}
variable "github_repository" {
  type        = string
  description = "Exact owner/repository; restricts federation trust."
}
variable "github_owner_id" {
  type        = string
  description = "Numeric GitHub owner ID; prevents namespace reuse attacks."
}
variable "app_image" {
  type        = string
  description = "Initial app image digest; subsequent releases managed by GitHub Actions."
}
variable "jobs_image" {
  type = string
}
variable "data_mode" {
  type    = string
  default = "demo"
  validation {
    condition     = contains(["demo", "live"], var.data_mode)
    error_message = "data_mode must be demo or live."

  }
}
variable "ai_mode" {
  type    = string
  default = "demo"
}
variable "vertex_model" {
  type    = string
  default = "gemini-3.5-flash-lite"
}
variable "embedding_model" {
  type    = string
  default = "gemini-embedding-001"
}
variable "alert_email" {
  type = string
}

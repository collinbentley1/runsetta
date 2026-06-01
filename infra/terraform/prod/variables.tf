variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
  default     = "runsetta"
}

variable "region" {
  description = "Primary Google Cloud region."
  type        = string
  default     = "us-east4"
}

variable "service_name" {
  description = "Production Cloud Run service name."
  type        = string
  default     = "runsetta"
}

variable "artifact_registry_repository_id" {
  description = "Artifact Registry Docker repository ID."
  type        = string
  default     = "api"
}

variable "bootstrap_image" {
  description = "Initial public image used before the application container exists."
  type        = string
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "runtime_service_account_email" {
  description = "Cloud Run runtime service account email."
  type        = string
  default     = "cloud-run-runtime@runsetta.iam.gserviceaccount.com"
}

variable "prod_deploy_service_account_email" {
  description = "Production deploy service account email."
  type        = string
  default     = "gha-prod-deploy@runsetta.iam.gserviceaccount.com"
}

variable "preview_deploy_service_account_email" {
  description = "Preview deploy service account email."
  type        = string
  default     = "gha-preview-deploy@runsetta.iam.gserviceaccount.com"
}

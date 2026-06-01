terraform {
  required_version = "~> 1.14.0"

  backend "gcs" {
    bucket = "runsetta-tfstate-601124730704"
    prefix = "runsetta/bootstrap"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "= 7.34.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

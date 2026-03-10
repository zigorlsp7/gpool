variable "aws_region" {
  type        = string
  description = "AWS region"
}

variable "deploy_bucket" {
  type        = string
  description = "S3 bucket used for release bundles"
}

variable "deploy_instance_id" {
  type        = string
  description = "EC2 instance id where app compose deploy runs"
}

variable "ecr_api_repository_uri" {
  type        = string
  description = "ECR URI for api"
}

variable "ecr_web_repository_uri" {
  type        = string
  description = "ECR URI for web"
}

variable "ssm_app_prefix" {
  type        = string
  description = "SSM Parameter Store path prefix for app env"
}

variable "next_public_api_base_url" {
  type        = string
  description = "Public API URL baked into web build"
}

variable "aws_region" {
  description = "AWS region for gpool app deployment artifacts"
  type        = string
}

variable "environment" {
  description = "Environment name (dev/staging/prod)"
  type        = string
  default     = "prod"
}

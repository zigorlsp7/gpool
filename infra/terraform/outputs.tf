output "app_name" {
  value       = local.app_name
  description = "Application identifier"
}

output "environment" {
  value       = var.environment
  description = "Deployment environment"
}

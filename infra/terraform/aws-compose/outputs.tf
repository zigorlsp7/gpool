output "github_actions_variables" {
  description = "Map of values required in GitHub production environment variables"
  value = {
    AWS_REGION                 = var.aws_region
    AWS_DEPLOY_BUCKET          = var.deploy_bucket
    AWS_DEPLOY_INSTANCE_ID     = var.deploy_instance_id
    AWS_ECR_API_REPOSITORY_URI = var.ecr_api_repository_uri
    AWS_ECR_WEB_REPOSITORY_URI = var.ecr_web_repository_uri
    AWS_SSM_APP_PREFIX         = var.ssm_app_prefix
    NEXT_PUBLIC_API_BASE_URL        = var.next_public_api_base_url
  }
}

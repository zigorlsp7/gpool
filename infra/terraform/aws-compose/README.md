# AWS Compose Module

Mirror module for app deploy-facing outputs consumed by `.github/workflows/deploy.yml`.

Expected output contract (usually emitted from `platform-ops` and copied into GitHub environment variables):

- `aws_region`
- `deploy_bucket`
- `deploy_instance_id`
- `ecr_api_repository_uri`
- `ecr_web_repository_uri`
- `ssm_app_prefix`
- `next_public_api_base_url`

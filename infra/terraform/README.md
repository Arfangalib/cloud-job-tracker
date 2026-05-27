# AWS Infrastructure Skeleton

This Terraform module captures the portfolio architecture for the cloud deployment:

- ECS Fargate cluster for API and worker containers.
- ECR repositories for container images.
- S3 bucket for generated resumes, cover letters, and future exports.
- SQS queues for ingestion, Apify result processing, tailoring, and reminders.
- EventBridge rule for scheduled reminder/ingestion scans.
- CloudWatch log groups.
- Secrets Manager placeholders for JWT, refresh-token, Apify, and AI credentials.

It is intentionally a skeleton: networking, IAM least-privilege policies, domain/TLS, MongoDB Atlas peering, and SES identity verification should be finalized per AWS account before production use.

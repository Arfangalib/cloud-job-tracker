output "api_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "worker_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "documents_bucket" {
  value = aws_s3_bucket.documents.bucket
}

output "work_queue_url" {
  value = aws_sqs_queue.work.url
}

output "secrets_name" {
  value = aws_secretsmanager_secret.app.name
}

locals {
  name = "${var.project_name}-${var.environment}"
}

resource "aws_ecr_repository" "api" {
  name                 = "${local.name}-api"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_repository" "worker" {
  name                 = "${local.name}-worker"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecs_cluster" "main" {
  name = local.name
}

resource "aws_s3_bucket" "documents" {
  bucket_prefix = "${local.name}-documents-"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_sqs_queue" "work" {
  name                       = "${local.name}-work"
  visibility_timeout_seconds = 60
  message_retention_seconds  = 345600
}

resource "aws_sqs_queue" "dead_letter" {
  name = "${local.name}-work-dlq"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${local.name}/api"
  retention_in_days = 14
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${local.name}/worker"
  retention_in_days = 14
}

resource "aws_secretsmanager_secret" "app" {
  name = "${local.name}/app-secrets"
}

resource "aws_cloudwatch_event_rule" "reminder_scan" {
  name                = "${local.name}-reminder-scan"
  description         = "Triggers scheduled reminder and ingestion scans."
  schedule_expression = "rate(15 minutes)"
}

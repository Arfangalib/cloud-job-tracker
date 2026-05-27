# Cloud Job Tracker + Resume Tailor

A MERN + Docker MVP for SWE/cloud internship and co-op searching. It imports jobs from compliant sources and Apify Actors, tracks applications, scores fit against a student resume, and drafts truthful ATS-friendly resume/cover-letter content.

## Features

- Secure JWT auth with short-lived access tokens and refresh-token rotation.
- Resume intake and keyword extraction for SWE/cloud internships.
- Job search/import through direct source ingestion and Apify-backed URL imports.
- Secure Apify webhook endpoint that normalizes extracted job data and queues scoring.
- Application tracker with statuses, notes, reminders, and dashboard analytics.
- Local Mongo-backed work queue that maps cleanly to AWS SQS for deployment.
- Docker Compose local development.

## Quick Start

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm run dev:api
npm run dev:web
```

Or run the full stack:

```bash
docker compose up --build
```

API: http://localhost:4000  
Web: http://localhost:5173

## Apify Setup

Set these in `apps/api/.env`:

```bash
APIFY_TOKEN=your_apify_token
APIFY_JOB_ACTOR_ID=actor_or_task_id
APIFY_WEBHOOK_SECRET=shared_secret_for_callbacks
PUBLIC_API_URL=https://your-api-domain.com
```

For local demos without Apify credentials, LinkedIn/Indeed-style imports create a pending ingestion run and can be completed by posting a webhook payload to `/webhooks/apify/job-parsed`.

## Cloud Architecture

The local worker polls MongoDB work items. In AWS, the same job types can be routed through SQS/EventBridge while the API and worker run on ECS Fargate. S3 stores generated documents, SES sends reminders, Secrets Manager stores credentials, and CloudWatch captures logs/metrics.

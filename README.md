# Cloud Job Tracker + Resume Tailor

A MERN + Docker MVP for SWE/cloud internship and co-op searching. It imports jobs from compliant sources and Apify Actors, tracks applications, scores fit against a student resume, and drafts truthful ATS-friendly resume/cover-letter content.

## Features

- Modern, routed web app (React 19 + Vite, Tailwind CSS v4, shadcn-style component
  system) with Dashboard, Jobs, Resume, Documents, and Security pages.
- Secure JWT auth with short-lived access tokens and refresh-token rotation; sessions
  are restored on reload via the refresh cookie.
- Resume intake by **PDF/DOCX/TXT upload** (pdf-parse + mammoth) or text paste, with
  keyword extraction for SWE/cloud internships.
- Job search/import through direct source ingestion and Apify-backed URL imports.
- Secure Apify webhook endpoint that normalizes extracted job data and queues scoring.
- AI fit scoring and **ATS-friendly document generation**: downloadable, single-column,
  text-based resume and cover-letter **PDF (pdfkit) and DOCX (docx)** tailored to a job.
- **Real saved-job search** (text + location/source/minScore filters) and a **custom
  recency filter** (posted in the last 24h / 7d / 30d / any custom window) backed by a
  real posting date.
- Application tracker with statuses, notes, reminders, and dashboard analytics.
- Pluggable file storage (local disk in dev, S3 in prod) for uploads and generated docs.
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
APIFY_JOB_ACTOR_ID=worldunboxer~rapid-linkedin-scraper
APIFY_WEBHOOK_SECRET=shared_secret_for_callbacks
PUBLIC_API_URL=https://your-api-domain-or-local-tunnel.com
AI_PROVIDER=mock
OPENAI_API_KEY=
OPENAI_SCORING_MODEL=gpt-5.4-mini
OPENAI_TAILOR_MODEL=gpt-5.4
```

For local demos without Apify credentials, LinkedIn/Indeed-style imports create a pending ingestion run and can be completed by posting a webhook payload to `/webhooks/apify/job-parsed`.

For local Apify webhooks, expose the API on port 4000 with a public tunnel and set `PUBLIC_API_URL` to that tunnel URL before starting the API. The LinkedIn search import is currently mapped to the `worldunboxer/rapid-linkedin-scraper` input fields for job title, location, and row count.

Set `AI_PROVIDER=openai` and provide `OPENAI_API_KEY` to enable AI scoring and tailoring. When the provider is `mock` or the key is missing, the app keeps using deterministic local scoring/tailoring fallbacks.

## File Storage

Uploaded resumes and generated documents are written through a storage abstraction:

```bash
STORAGE_DRIVER=local   # writes under UPLOAD_DIR (default: uploads/)
UPLOAD_DIR=uploads
# For production, switch to S3 (uses the Terraform-provisioned documents bucket):
# STORAGE_DRIVER=s3
# S3_BUCKET=your-documents-bucket
# AWS_REGION=us-east-1
```

## Cloud Architecture

The local worker polls MongoDB work items. In AWS, the same job types can be routed through SQS/EventBridge while the API and worker run on ECS Fargate. S3 stores generated documents, SES sends reminders, Secrets Manager stores credentials, and CloudWatch captures logs/metrics.

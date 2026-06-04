import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../db.js";
import { User } from "../models/User.js";
import { Resume } from "../models/Resume.js";
import { JobPost } from "../models/JobPost.js";
import { Application } from "../models/Application.js";
import { parseResume } from "../services/resumeParser.js";

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@cloudjobtracker.app";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoPass123!";
// Set DEMO_RESET=true to wipe and recreate the demo account (refresh after deploy).
const DEMO_RESET = process.env.DEMO_RESET === "true";

const RESUME_TEXT = `Alex Rivera
Vancouver, BC | alex.rivera@example.com | github.com/alexrivera | linkedin.com/in/alexrivera
Software / Cloud Engineering Intern

SUMMARY
Computer Science student (UBC, expected 2027) with hands-on experience building and
deploying full-stack, cloud-native applications. Comfortable across JavaScript/TypeScript,
React, and Node.js with practical AWS, Docker, and Terraform experience.

TECHNICAL SKILLS
Languages: JavaScript, TypeScript, Python, Java, SQL
Frontend: React, Next.js, HTML, CSS, Tailwind CSS
Backend: Node.js, Express, REST APIs, GraphQL
Cloud / DevOps: AWS (Lambda, S3, ECS), Docker, Kubernetes, Terraform, CI/CD, GitHub Actions, Linux
Data: MongoDB, PostgreSQL, Redis
Practices: Unit/integration testing (Vitest, Jest), Git, Agile

EXPERIENCE
Software Engineer Intern — Northstar Labs, Vancouver, BC (May 2025 - Aug 2025)
- Built REST APIs in Node.js and Express backed by PostgreSQL, serving 5+ internal endpoints.
- Containerized services with Docker and deployed to AWS ECS using Terraform infrastructure-as-code.
- Set up CI/CD with GitHub Actions, cutting manual deploy steps and speeding up releases.
- Wrote unit and integration tests, raising coverage on the team's core service.

PROJECTS
Cloud Job Tracker (2025) — React, Node.js, Express, MongoDB
- Full-stack app with worker queues, AI fit scoring, and ATS document generation.
- Deployed on Render with MongoDB Atlas; resilient job ingestion via webhook + polling.
Serverless Image Pipeline (2024) — AWS Lambda, S3, Terraform
- Event-driven image processing with infrastructure defined entirely as code.

EDUCATION
B.Sc. Computer Science, University of British Columbia (UBC) — Expected 2027
Relevant coursework: Data Structures & Algorithms, Databases, Operating Systems, Cloud Computing`;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

const SAMPLE_JOBS = [
  {
    source: "greenhouse",
    sourceUrl: "https://boards.greenhouse.io/demo/jobs/1001",
    title: "Cloud Software Engineer Intern",
    company: "Nimbus Cloud",
    location: "Vancouver, BC (Hybrid)",
    description: "Build cloud-native services with Node.js, AWS, Docker, and Terraform. CI/CD and Kubernetes a plus.",
    keywords: ["aws", "docker", "terraform", "node", "kubernetes", "ci/cd"],
    postedAt: new Date(Date.now() - 6 * HOUR),
    match: { score: 88, strongMatches: ["aws", "docker", "terraform", "node"], missingKeywords: ["kubernetes"], summary: "Strong fit. Tailor bullets around AWS + Terraform IaC project." },
    status: "saved"
  },
  {
    source: "lever",
    sourceUrl: "https://jobs.lever.co/demo/2002",
    title: "Backend Engineer (Internship)",
    company: "Streamline Labs",
    location: "Remote (Canada)",
    description: "REST APIs in Node/Express, MongoDB, and PostgreSQL. Containerized with Docker.",
    keywords: ["node", "express", "mongodb", "postgresql", "docker", "rest"],
    postedAt: new Date(Date.now() - 2 * DAY),
    match: { score: 82, strongMatches: ["node", "express", "mongodb", "docker", "rest"], missingKeywords: ["postgresql"], summary: "Great match for your backend + Docker experience." },
    status: "applied"
  },
  {
    source: "greenhouse",
    sourceUrl: "https://boards.greenhouse.io/demo/jobs/3003",
    title: "Full-Stack Developer Co-op",
    company: "Pixel & Co",
    location: "Toronto, ON",
    description: "React + TypeScript frontend, Node backend. Bonus: AWS, CI/CD.",
    keywords: ["react", "typescript", "node", "aws", "ci/cd"],
    postedAt: new Date(Date.now() - 5 * DAY),
    match: { score: 79, strongMatches: ["react", "typescript", "node", "aws"], missingKeywords: [], summary: "Solid full-stack fit; highlight your React + Node chat app." },
    status: "interview"
  },
  {
    source: "lever",
    sourceUrl: "https://jobs.lever.co/demo/4004",
    title: "Platform Engineering Intern",
    company: "Corehaus",
    location: "Remote",
    description: "Kubernetes, Terraform, and observability for internal platforms. Go or Python.",
    keywords: ["kubernetes", "terraform", "python", "go", "observability"],
    postedAt: new Date(Date.now() - 9 * DAY),
    match: { score: 61, strongMatches: ["terraform", "python"], missingKeywords: ["kubernetes", "go", "observability"], summary: "Promising lead. Address platform keywords where your experience supports them." },
    status: "saved"
  }
];

async function seed() {
  await connectDb();

  const existing = await User.findOne({ email: DEMO_EMAIL.toLowerCase() });
  if (existing) {
    if (!DEMO_RESET) {
      console.log(`Demo user ${DEMO_EMAIL} already exists; pass DEMO_RESET=true to refresh it.`);
      return;
    }
    console.log(`DEMO_RESET=true — clearing existing demo data for ${DEMO_EMAIL}...`);
    await Promise.all([
      Resume.deleteMany({ userId: existing._id }),
      JobPost.deleteMany({ userId: existing._id }),
      Application.deleteMany({ userId: existing._id })
    ]);
    await User.deleteOne({ _id: existing._id });
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const user = await User.create({
    name: "Alex Rivera (Demo)",
    email: DEMO_EMAIL,
    passwordHash,
    targetRoles: ["Cloud Engineer Intern", "Backend Intern"],
    targetLocations: ["Vancouver", "Remote (Canada)"]
  });

  await Resume.create({
    userId: user._id,
    title: "Alex Rivera — Cloud/SWE Resume",
    rawText: RESUME_TEXT,
    parsed: parseResume(RESUME_TEXT),
    isPrimary: true
  });

  for (const sample of SAMPLE_JOBS) {
    const { status, ...jobFields } = sample;
    const job = await JobPost.create({ userId: user._id, scoredAt: new Date(), ...jobFields });
    await Application.create({
      userId: user._id,
      jobId: job._id,
      status,
      appliedAt: status === "applied" || status === "interview" ? new Date(Date.now() - DAY) : undefined
    });
  }

  console.log(`Seeded demo account:\n  email:    ${DEMO_EMAIL}\n  password: ${DEMO_PASSWORD}\n  jobs:     ${SAMPLE_JOBS.length}`);
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
    await mongoose.connection.close().catch(() => {});
  });

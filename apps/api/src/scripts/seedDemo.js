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

const RESUME_TEXT = `Alex Rivera
Cloud / Software Engineering Intern

SKILLS
JavaScript, TypeScript, React, Node.js, Express, Python
AWS, Docker, Kubernetes, Terraform, MongoDB, PostgreSQL, REST, CI/CD, Git

PROJECTS
- Serverless image pipeline on AWS Lambda + S3 with Terraform IaC.
- Real-time chat app with React, Node, WebSockets, and MongoDB.

EDUCATION
B.Sc. Computer Science, University of British Columbia (expected 2027)`;

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

  let user = await User.findOne({ email: DEMO_EMAIL.toLowerCase() });
  if (user) {
    console.log(`Demo user ${DEMO_EMAIL} already exists; nothing to seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  user = await User.create({
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

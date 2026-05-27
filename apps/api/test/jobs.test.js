import { describe, expect, it } from "vitest";
import { normalizeJob } from "../src/services/jobNormalizer.js";
import { parseResume } from "../src/services/resumeParser.js";
import { scoreJobAgainstResume } from "../src/services/scoring.js";
import { buildTailoredDraft } from "../src/services/tailor.js";

describe("job matching and tailoring", () => {
  it("normalizes jobs, scores against resume skills, and keeps guardrails", () => {
    const resume = {
      parsed: parseResume("Built a React and Node project on AWS using Docker, S3, REST APIs, and testing.")
    };
    const job = normalizeJob({
      title: "Cloud SWE Intern",
      company: "Acme",
      url: "https://example.com/acme",
      description: "React, Node, AWS, Docker, Terraform, Kubernetes, testing"
    });

    const match = scoreJobAgainstResume(job, resume);
    expect(match.strongMatches).toContain("react");
    expect(match.missingKeywords).toContain("terraform");

    const draft = buildTailoredDraft({ job: { ...job, match }, resume });
    expect(draft.guardrails.doNotInvent).toContain("certifications");
    expect(draft.guardrails.onlyAddIfTrue).toContain("terraform");
  });
});

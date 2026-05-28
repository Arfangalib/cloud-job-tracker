import OpenAI from "openai";
import { env } from "../config/env.js";

let client;
let testClient;

export function isOpenAiConfigured() {
  return env.aiProvider === "openai" && Boolean(env.openaiApiKey);
}

export async function createStructuredJson({ model, schemaName, schema, instructions, input, maxOutputTokens = 1200 }) {
  if (!isOpenAiConfigured()) return null;

  const response = await getClient().responses.create({
    model,
    instructions,
    input,
    max_output_tokens: maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        schema,
        strict: true
      }
    }
  });

  return parseResponseJson(response);
}

export function logAiError(context, error) {
  console.error("AI service failed", {
    context,
    message: error instanceof Error ? error.message : String(error)
  });
}

export function setOpenAiClientForTests(nextClient) {
  testClient = nextClient;
  client = undefined;
}

function getClient() {
  if (testClient) return testClient;
  if (!client) {
    client = new OpenAI({ apiKey: env.openaiApiKey });
  }
  return client;
}

function parseResponseJson(response) {
  const text = response.output_text || extractOutputText(response);
  if (!text) throw new Error("OpenAI response did not include text output");
  return JSON.parse(text);
}

function extractOutputText(response) {
  return (response.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .join("")
    .trim();
}

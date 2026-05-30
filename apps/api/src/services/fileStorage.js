import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { env } from "../config/env.js";

/**
 * Storage abstraction shared by resume uploads (Phase 2) and generated
 * documents (Phase 3). Driver is chosen by STORAGE_DRIVER:
 *  - "local": writes under env.uploadDir (dev default)
 *  - "s3":    writes to the provisioned documents bucket (prod)
 */

let s3ClientPromise;

async function getS3() {
  if (!s3ClientPromise) {
    s3ClientPromise = import("@aws-sdk/client-s3").then(({ S3Client }) => ({
      sdk: import("@aws-sdk/client-s3"),
      client: new S3Client({ region: env.awsRegion })
    }));
  }
  return s3ClientPromise;
}

/**
 * Persist a buffer and return a descriptor of where it landed.
 * @returns {Promise<{storageKey: string, storageDriver: string}>}
 */
export async function putObject({ key, buffer, contentType }) {
  if (env.storageDriver === "s3") {
    const { sdk, client } = await getS3();
    const { PutObjectCommand } = await sdk;
    await client.send(
      new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType
      })
    );
    return { storageKey: key, storageDriver: "s3" };
  }

  const fullPath = path.join(env.uploadDir, key);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, buffer);
  return { storageKey: key, storageDriver: "local" };
}

/** Read a stored object back as a Buffer. */
export async function getObjectBuffer({ storageKey, storageDriver }) {
  if (storageDriver === "s3") {
    const { sdk, client } = await getS3();
    const { GetObjectCommand } = await sdk;
    const response = await client.send(
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: storageKey })
    );
    return streamToBuffer(response.Body);
  }
  return readFile(path.join(env.uploadDir, storageKey));
}

/** Stream a stored object (for download responses). */
export async function getObjectStream({ storageKey, storageDriver }) {
  if (storageDriver === "s3") {
    const { sdk, client } = await getS3();
    const { GetObjectCommand } = await sdk;
    const response = await client.send(
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: storageKey })
    );
    return response.Body; // already a Readable stream in Node
  }
  return createReadStream(path.join(env.uploadDir, storageKey));
}

async function streamToBuffer(body) {
  if (Buffer.isBuffer(body)) return body;
  const readable = body instanceof Readable ? body : Readable.from(body);
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

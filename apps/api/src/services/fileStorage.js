import { createReadStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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

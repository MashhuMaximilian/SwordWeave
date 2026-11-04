import "server-only";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from "@aws-sdk/client-s3";
import { get, put } from "@vercel/blob";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { verifiedUploadAliases } from "@/lib/runtime/deployment";
import { isUploadKey } from "./upload-path";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const uploadMimeTypes = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
} as const;
type PrivateUpload = { stream: ReadableStream<Uint8Array>; contentType: string; size: number };
type Backend = "local" | "blob" | "r2";

function backend(): Backend {
  const chosen = process.env["SW_UPLOAD_BACKEND"];
  if (process.env["SW_HOSTING"] === "hetzner") {
    if (chosen !== "r2") throw new Error("Hetzner requires the private R2 upload backend.");
    return "r2";
  }
  if (chosen === "r2" || chosen === "blob") return chosen;
  if (process.env.NODE_ENV === "development" && (chosen === "local" || (!chosen && !process.env["BLOB_READ_WRITE_TOKEN"]))) return "local";
  if (chosen === undefined) return "blob";
  throw new Error("Invalid private upload backend.");
}

let r2: { bucket: string; client: S3Client } | undefined;

function r2Store() {
  if (r2) return r2;
  verifiedUploadAliases();
  const endpoint = process.env["SW_R2_ENDPOINT"] ?? "";
  const bucket = process.env["SW_R2_UPLOAD_BUCKET"] ?? "";
  const accessKeyId = process.env["SW_R2_ACCESS_KEY_ID"];
  const secretAccessKey = process.env["SW_R2_SECRET_ACCESS_KEY"];
  if (
    !/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|fedramp))?\.r2\.cloudflarestorage\.com\/?$/.test(endpoint) ||
    !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket) || !accessKeyId || !secretAccessKey
  ) throw new Error("Invalid private R2 configuration.");
  r2 = { bucket, client: new S3Client({
    endpoint, region: "auto", forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  }) };
  return r2;
}

export async function checkPrivateUploadStore(signal: AbortSignal): Promise<void> {
  if (backend() !== "r2") throw new Error("Readiness requires private R2 storage.");
  const { client, bucket } = r2Store();
  await client.send(new HeadObjectCommand({
    Bucket: bucket, Key: "__swordweave__/readiness",
  }), { abortSignal: signal });
}

function mimeForKey(key: string): string {
  const ext = key.split(".").pop()!.toLowerCase() as keyof typeof uploadMimeTypes;
  return uploadMimeTypes[ext];
}

function uploadBody(body: ReadableStream<Uint8Array>, size: number, contentType: string): PrivateUpload {
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_UPLOAD_BYTES) {
    void body.cancel().catch(() => {});
    throw new Error("Private upload size is invalid.");
  }
  let bytes = 0;
  const bound = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      bytes += chunk.byteLength;
      if (bytes > size) throw new Error("Private upload exceeded its declared size.");
      controller.enqueue(chunk);
    },
    flush() {
      if (bytes !== size) throw new Error("Private upload was truncated.");
    },
  });
  return { stream: body.pipeThrough(bound), size, contentType };
}

export async function readPrivateUpload(key: string, signal?: AbortSignal): Promise<PrivateUpload | null> {
  if (!isUploadKey(key)) return null;
  const abortSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000);
  switch (backend()) {
    case "local": {
      try {
        const root = await realpath(join(process.cwd(), ".local-uploads"));
        const path = await realpath(join(root, key));
        if (!path.startsWith(root + sep)) return null;
        const file = await stat(path);
        if (!file.isFile() || file.size > MAX_UPLOAD_BYTES) return null;
        const bytes = await readFile(path, { signal: abortSignal });
        return uploadBody(new Blob([Uint8Array.from(bytes)]).stream(), file.size, mimeForKey(key));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    }
    case "blob": {
      const result = await get(key, { access: "private", abortSignal });
      return result?.statusCode === 200
        ? uploadBody(result.stream, result.blob.size, mimeForKey(key)) : null;
    }
    case "r2": {
      const { client, bucket } = r2Store();
      try {
        const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }), { abortSignal });
        return result.Body
          ? uploadBody(result.Body.transformToWebStream(), result.ContentLength ?? 0, mimeForKey(key)) : null;
      } catch (error) {
        if (error instanceof S3ServiceException && error.$metadata.httpStatusCode === 404) return null;
        throw error;
      }
    }
  }
}

export async function writePrivateUpload(key: string, file: File, signal: AbortSignal): Promise<void> {
  if (!isUploadKey(key) || file.size < 1 || file.size > MAX_UPLOAD_BYTES || file.type !== mimeForKey(key)) {
    throw new Error("Private upload is invalid.");
  }
  const abortSignal = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  switch (backend()) {
    case "local": {
      const path = join(process.cwd(), ".local-uploads", key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, Buffer.from(await file.arrayBuffer()), { flag: "wx", signal: abortSignal });
      return;
    }
    case "blob":
      await put(key, file, { access: "private", addRandomSuffix: false, contentType: file.type, abortSignal });
      return;
    case "r2": {
      const { client, bucket } = r2Store();
      await client.send(new PutObjectCommand({
        Bucket: bucket, Key: key, Body: new Uint8Array(await file.arrayBuffer()),
        ContentType: file.type, ContentLength: file.size, IfNoneMatch: "*",
      }), { abortSignal });
    }
  }
}

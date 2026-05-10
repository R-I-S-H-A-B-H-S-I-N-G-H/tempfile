import { AwsClient } from "https://esm.sh/aws4fetch@1.0.20";

export async function generatePresignedUrl(
  filename: string,
  contentType?: string,
  contentDisposition?: string,
  cacheDuration?: string,
  contentLength?: string
) {
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID") || "";
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY") || "";
  const endpoint = Deno.env.get("S3_ENDPOINT") || "";
  const region = Deno.env.get("S3_REGION") || "us-east-1";
  const bucketName = Deno.env.get("S3_BUCKET_NAME") || "";

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    throw new Error("S3 configuration missing");
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region,
  });

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const url = new URL(`${cleanEndpoint}/${bucketName}/${filename}`);

  const headers: Record<string, string> = {};
  if (contentType) headers["Content-Type"] = contentType;
  if (contentDisposition) headers["Content-Disposition"] = contentDisposition;
  if (cacheDuration) {
    headers["Cache-Control"] = `public, max-age=${cacheDuration}`;
  }
  if (contentLength) {
    headers["Content-Length"] = contentLength;
  }

  const signedReq = await aws.sign(url, {
    method: "PUT",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    aws: { signQuery: true }
  });

  return {
    url: signedReq.url,
    requiredHeaders: headers
  };
}

export async function deleteObject(storageKey: string) {
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID") || "";
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY") || "";
  const endpoint = Deno.env.get("S3_ENDPOINT") || "";
  const region = Deno.env.get("S3_REGION") || "us-east-1";
  const bucketName = Deno.env.get("S3_BUCKET_NAME") || "";

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    throw new Error("S3 configuration missing");
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region,
  });

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const url = new URL(`${cleanEndpoint}/${bucketName}/${storageKey}`);

  const res = await aws.fetch(url, { method: "DELETE" });

  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to delete object: ${res.status}`);
  }

  return { deleted: true, storageKey };
}

export async function getPresignedGetUrl(storageKey: string, expiresInSeconds: number = 3600) {
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID") || "";
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY") || "";
  const endpoint = Deno.env.get("S3_ENDPOINT") || "";
  const region = Deno.env.get("S3_REGION") || "us-east-1";
  const bucketName = Deno.env.get("S3_BUCKET_NAME") || "";

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    throw new Error("S3 configuration missing");
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region,
  });

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const url = new URL(`${cleanEndpoint}/${bucketName}/${storageKey}`);

  const signedReq = await aws.sign(url, {
    method: "GET",
    aws: { signQuery: true }
  });

  return signedReq.url;
}

export async function getObjectResponse(storageKey: string) {
  const accessKeyId = Deno.env.get("S3_ACCESS_KEY_ID") || "";
  const secretAccessKey = Deno.env.get("S3_SECRET_ACCESS_KEY") || "";
  const endpoint = Deno.env.get("S3_ENDPOINT") || "";
  const region = Deno.env.get("S3_REGION") || "us-east-1";
  const bucketName = Deno.env.get("S3_BUCKET_NAME") || "";

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucketName) {
    throw new Error("S3 configuration missing");
  }

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: "s3",
    region,
  });

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  const url = new URL(`${cleanEndpoint}/${bucketName}/${storageKey}`);

  const res = await aws.fetch(url, { method: "GET" });
  return res;
}

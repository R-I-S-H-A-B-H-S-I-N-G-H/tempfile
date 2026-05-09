import { Hono } from "npm:hono";
import { generatePresignedUrl, deleteObject } from "../service/s3.ts";
import { uniqueNamesGenerator, adjectives, colors, animals, names } from "https://esm.sh/unique-names-generator@4.7.1";

const mediaRouter = new Hono();

async function sha256(message: string) {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function generateFunId(secretToken?: string) {
  const config = {
    dictionaries: [adjectives, colors, animals, names],
    separator: "-",
    style: "lowerCase" as const,
  };

  if (!secretToken) {
    return uniqueNamesGenerator(config);
  }

  const hash = await sha256(secretToken);
  return uniqueNamesGenerator({ ...config, seed: hash });
}

mediaRouter.get("/temp-file-url", async (c) => {
  const filename = c.req.query("filename");
  const contentType = c.req.query("contentType");
  const contentDisposition = c.req.query("contentDisposition");
  const cacheDuration = c.req.query("cacheDuration");
  const secretToken = c.req.query("secretToken");
  const contentLength = c.req.query("contentLength");

  const MIN_CACHE = 86400;     // 1 day
  const MAX_CACHE = 604800;    // 1 week
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

  if (!filename) {
    return c.json({ error: "filename is required" }, 400);
  }

  if (contentLength) {
    const size = Number(contentLength);
    if (isNaN(size) || size <= 0 || size > MAX_FILE_SIZE) {
      return c.json({ error: `File size must be between 1 byte and 100MB` }, 400);
    }
  }

  if (cacheDuration !== undefined) {
    const dur = Number(cacheDuration);
    if (isNaN(dur) || dur < MIN_CACHE || dur > MAX_CACHE) {
      return c.json(
        { error: `cacheDuration must be between ${MIN_CACHE} (1 day) and ${MAX_CACHE} (1 week) seconds` },
        400
      );
    }
  }

  try {
    const uid = await generateFunId(secretToken);
    const storageKey = `${uid}/${filename}`;

    const { url, requiredHeaders } = await generatePresignedUrl(
      storageKey,
      contentType,
      contentDisposition,
      cacheDuration,
      contentLength
    );
    const cdnUrl = Deno.env.get("CDN_URL");
    const responsePayload: any = {
      uploadUrl: url,
      requiredHeaders: requiredHeaders,
      filename: filename,
      storageKey: storageKey,
    };

    if (cdnUrl) {
      const cleanCdnUrl = cdnUrl.replace(/\/$/, "");
      responsePayload.publicUrl = `${cleanCdnUrl}/${storageKey}`;
    }

    return c.json(responsePayload);
  } catch (err: any) {
    return c.json({ error: err.message || "Internal Server Error" }, 500);
  }
});

async function purgeBunnyCache(publicUrl: string) {
  const bunnyApiKey = Deno.env.get("BUNNY_API_KEY");
  if (!bunnyApiKey) return; // Skip if not configured

  const purgeUrl = `https://api.bunny.net/purge?url=${encodeURIComponent(publicUrl)}&async=false`;

  const res = await fetch(purgeUrl, {
    method: "POST",
    headers: {
      "AccessKey": bunnyApiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    console.warn(`[Bunny] Cache purge failed for ${publicUrl}: ${res.status}`);
  } else {
    console.log(`[Bunny] Cache purged: ${publicUrl}`);
  }
}

mediaRouter.post("/upload-complete", async (c) => {
  const { publicUrl, secretToken } = await c.req.json();

  if (!publicUrl) {
    return c.json({ error: "publicUrl is required" }, 400);
  }

  if (!secretToken) {
    return c.json({ error: "secretToken is required" }, 400);
  }

  try {
    // Re-derive the user's folder name from their secretToken
    const userFolder = await generateFunId(secretToken);
    const cdnUrl = Deno.env.get("CDN_URL")?.replace(/\/$/, "") ?? "";

    // Validate the publicUrl actually belongs to the requesting user's folder
    const expectedPrefix = `${cdnUrl}/${userFolder}/`;
    if (!publicUrl.startsWith(expectedPrefix)) {
      return c.json({ error: "Forbidden: you can only purge your own files" }, 403);
    }

    await purgeBunnyCache(publicUrl);
    return c.json({ success: true, purged: publicUrl });
  } catch (err: any) {
    return c.json({ error: err.message || "Upload complete / purge failed" }, 500);
  }
});

mediaRouter.post("/delete-file", async (c) => {
  const { publicUrl, secretToken } = await c.req.json();

  if (!publicUrl) {
    return c.json({ error: "publicUrl is required" }, 400);
  }

  if (!secretToken) {
    return c.json({ error: "secretToken is required" }, 400);
  }

  try {
    const userFolder = await generateFunId(secretToken);
    const cdnUrl = Deno.env.get("CDN_URL")?.replace(/\/$/, "") ?? "";

    const expectedPrefix = `${cdnUrl}/${userFolder}/`;
    if (!publicUrl.startsWith(expectedPrefix)) {
      return c.json({ error: "Forbidden: you can only delete your own files" }, 403);
    }

    const storageKey = publicUrl.replace(`${cdnUrl}/`, "");
    await deleteObject(storageKey);
    await purgeBunnyCache(publicUrl);

    console.log(`[Delete] File deleted: ${storageKey}`);
    return c.json({ success: true, deleted: publicUrl });
  } catch (err: any) {
    return c.json({ error: err.message || "Delete failed" }, 500);
  }
});

export default mediaRouter;

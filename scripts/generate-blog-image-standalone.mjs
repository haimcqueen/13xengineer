// Standalone blog image generator - no external dependencies, no pnpm needed.
// Usage: node scripts/generate-blog-image-standalone.mjs --prompt '...' --output 'public/content/slug.png'
// Reads FAL_KEY_LEON from .env.development automatically.

import { readFileSync, writeFileSync } from "fs";
import { parseArgs } from "util";
import { resolve } from "path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.development");
  try {
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env.development not found, rely on existing env vars
  }
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      prompt: { type: "string" },
      output: { type: "string" },
    },
    strict: true,
  });

  if (!values.prompt || !values.output) {
    console.error("Usage: node scripts/generate-blog-image-standalone.mjs --prompt '...' --output 'public/content/slug.png'");
    process.exit(1);
  }

  return { prompt: values.prompt, output: values.output };
}

async function submitToFal(apiKey, prompt) {
  const response = await fetch("https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image", {
    method: "POST",
    headers: {
      Authorization: `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_size: "landscape_16_9",
      enable_safety_checker: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fal submit failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function pollStatus(apiKey, statusUrl) {
  while (true) {
    const response = await fetch(statusUrl, {
      headers: { Authorization: `Key ${apiKey}` },
    });
    const data = await response.json();
    console.log(`Status: ${data.status}`);

    if (data.status === "COMPLETED") return data.response_url;
    if (data.status === "FAILED") throw new Error("Fal request failed");

    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function getResult(apiKey, responseUrl) {
  const response = await fetch(responseUrl, {
    headers: { Authorization: `Key ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Fal result fetch failed (${response.status}): ${text}`);
  }

  return response.json();
}

async function main() {
  loadEnv();
  const { prompt, output } = parseCliArgs();

  const apiKey = process.env.FAL_KEY_LEON;
  if (!apiKey) {
    console.error("FAL_KEY_LEON is not set (checked .env.development and environment)");
    process.exit(1);
  }

  console.log("Generating blog image with seedream 4.5...");
  console.log(`Prompt: ${prompt}`);
  console.log(`Output: ${output}`);

  // Submit the request
  const submitData = await submitToFal(apiKey, prompt);
  console.log(`Request ID: ${submitData.request_id}`);
  console.log(`Status URL: ${submitData.status_url}`);

  // Poll until complete
  const responseUrl = await pollStatus(apiKey, submitData.status_url);

  // Fetch the result
  const result = await getResult(apiKey, submitData.response_url || responseUrl);
  const imageUrl = result?.images?.[0]?.url;
  if (!imageUrl) {
    console.error("No image was returned from the model.");
    process.exit(1);
  }

  // Download and save
  console.log(`Downloading image from: ${imageUrl}`);
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    console.error("Failed to download generated image.");
    process.exit(1);
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  writeFileSync(output, buffer);
  console.log(`Image saved to ${output} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

main();

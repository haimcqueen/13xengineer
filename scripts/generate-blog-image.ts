import { createFalClient } from "@fal-ai/client";
import { writeFileSync } from "fs";
import { parseArgs } from "util";
import sharp from "sharp";

function parseCliArgs(): { prompt: string; output: string } {
  const { values } = parseArgs({
    options: {
      prompt: { type: "string" },
      output: { type: "string" },
    },
    strict: true,
  });

  if (!values.prompt || !values.output) {
    console.error("Usage: pnpm script scripts/generate-blog-image.ts --prompt '...' --output 'public/content/slug.webp'");
    process.exit(1);
  }

  return { prompt: values.prompt, output: values.output };
}

async function main(): Promise<void> {
  const { prompt, output } = parseCliArgs();

  const apiKey = process.env.FAL_KEY_LEON;
  if (!apiKey) {
    console.error("FAL_KEY_LEON is not set");
    process.exit(1);
  }

  console.log("Generating blog image with seedream 4.5...");
  console.log(`Prompt: ${prompt}`);
  console.log(`Output: ${output}`);

  const client = createFalClient({ credentials: apiKey });

  const result = await client.subscribe("fal-ai/bytedance/seedream/v4.5/text-to-image", {
    input: {
      prompt,
      image_size: "landscape_16_9",
      enable_safety_checker: false,
    },
    logs: true,
    onQueueUpdate: (update) => {
      console.log(`Status: ${update.status}`);
      if (update.status === "IN_PROGRESS") {
        update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });

  const imageUrl = (result.data as { images: Array<{ url: string }> }).images?.[0]?.url;
  if (!imageUrl) {
    console.error("No image was returned from the model.");
    process.exit(1);
  }

  console.log(`Downloading image from: ${imageUrl}`);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    console.error("Failed to download generated image.");
    process.exit(1);
  }

  const rawBuffer = Buffer.from(await response.arrayBuffer());
  const buffer = await sharp(rawBuffer).webp({ quality: 90 }).toBuffer();
  writeFileSync(output, buffer);
  console.log(`Image saved to ${output} (${(buffer.length / 1024).toFixed(0)} KB, converted to WebP)`);
}

main();

import { readdirSync, existsSync, unlinkSync, readFileSync, writeFileSync } from "fs";
import { join, basename, extname } from "path";
import { parseArgs } from "util";
import sharp from "sharp";
import { globSync } from "glob";

const CONTENT_DIR = join(process.cwd(), "public/content");
const BLOG_DIR = join(process.cwd(), "app/blog/content");
const WEBP_QUALITY = 90;

function parseCliArgs(): { dryRun: boolean } {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
    },
    strict: true,
  });
  return { dryRun: values["dry-run"] ?? false };
}

async function convertImage(inputPath: string, outputPath: string): Promise<{ inputSize: number; outputSize: number }> {
  const inputBuffer = readFileSync(inputPath);
  const outputBuffer = await sharp(inputBuffer).webp({ quality: WEBP_QUALITY }).toBuffer();
  writeFileSync(outputPath, outputBuffer);
  return { inputSize: inputBuffer.length, outputSize: outputBuffer.length };
}

function updateFrontmatter(filePath: string, oldImagePath: string, newImagePath: string, dryRun: boolean): boolean {
  const content = readFileSync(filePath, "utf-8");
  if (!content.includes(oldImagePath)) return false;

  const updated = content.replace(oldImagePath, newImagePath);
  if (!dryRun) {
    writeFileSync(filePath, updated);
  }
  return true;
}

async function main(): Promise<void> {
  const { dryRun } = parseCliArgs();

  if (dryRun) {
    console.log("=== DRY RUN MODE — no files will be modified ===\n");
  }

  // Find all image files in public/content/ (png, jpg, jpeg)
  const imageFiles = readdirSync(CONTENT_DIR).filter((f) => /\.(png|jpg|jpeg)$/i.test(f));
  console.log(`Found ${imageFiles.length} image(s) in ${CONTENT_DIR}\n`);

  if (imageFiles.length === 0) {
    console.log("Nothing to convert.");
    return;
  }

  // Find all blog markdown files
  const blogFiles = globSync("*.md", { cwd: BLOG_DIR }).map((f) => join(BLOG_DIR, f));
  console.log(`Found ${blogFiles.length} blog post(s) in ${BLOG_DIR}\n`);

  let totalInputBytes = 0;
  let totalOutputBytes = 0;
  let converted = 0;
  let skipped = 0;
  let frontmatterUpdated = 0;

  for (const file of imageFiles) {
    const inputPath = join(CONTENT_DIR, file);
    const nameWithoutExt = basename(file, extname(file));
    const outputPath = join(CONTENT_DIR, `${nameWithoutExt}.webp`);

    // Skip if webp already exists
    if (existsSync(outputPath)) {
      console.log(`SKIP (webp exists): ${file}`);
      skipped++;
      continue;
    }

    if (dryRun) {
      const inputSize = readFileSync(inputPath).length;
      console.log(`WOULD CONVERT: ${file} (${(inputSize / 1024 / 1024).toFixed(1)} MB)`);
      totalInputBytes += inputSize;
      converted++;
    } else {
      const { inputSize, outputSize } = await convertImage(inputPath, outputPath);
      const savings = ((1 - outputSize / inputSize) * 100).toFixed(0);
      console.log(
        `CONVERTED: ${file} → ${nameWithoutExt}.webp  ` +
          `(${(inputSize / 1024 / 1024).toFixed(1)} MB → ${(outputSize / 1024 / 1024).toFixed(1)} MB, ${savings}% smaller)`
      );
      totalInputBytes += inputSize;
      totalOutputBytes += outputSize;
      converted++;

      // Delete the original
      unlinkSync(inputPath);
      console.log(`  DELETED: ${file}`);
    }

    // Update frontmatter in blog posts
    const oldMetaImage = `/content/${file}`;
    const newMetaImage = `/content/${nameWithoutExt}.webp`;
    for (const blogFile of blogFiles) {
      const updated = updateFrontmatter(blogFile, oldMetaImage, newMetaImage, dryRun);
      if (updated) {
        console.log(`  ${dryRun ? "WOULD UPDATE" : "UPDATED"} frontmatter: ${basename(blogFile)}`);
        frontmatterUpdated++;
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Converted: ${converted}`);
  console.log(`Skipped (already webp): ${skipped}`);
  console.log(`Frontmatter references updated: ${frontmatterUpdated}`);
  if (!dryRun && converted > 0) {
    const totalSavings = ((1 - totalOutputBytes / totalInputBytes) * 100).toFixed(0);
    console.log(
      `Total size: ${(totalInputBytes / 1024 / 1024).toFixed(1)} MB → ${(totalOutputBytes / 1024 / 1024).toFixed(1)} MB (${totalSavings}% smaller)`
    );
  }
}

main();

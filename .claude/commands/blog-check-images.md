---
description: Check all blog posts have valid images, generate missing ones
allowed-tools: Read, Glob, Bash, Grep
---

# Blog Image Checker

Scan all published blog posts and verify that every `meta-image` referenced in frontmatter has a corresponding file on disk. Generate images for any posts that are missing one.

## Steps

### 1. Scan all blog posts

- Glob `blog/content/*.md` (not drafts)
- Read each file's YAML frontmatter and extract: `meta-image`, `h1-title` (or `meta-title` as fallback)
- Build a list of `{ slug, title, metaImage, filePath }`

### 2. Validate images exist

For each post, check if the file exists at `public/[meta-image value]`.

Example: if `meta-image: "/content/my-post.webp"`, check that `public/content/my-post.webp` exists.

Use Glob to check. A post is "missing" if no file is found at that path.

### 3. Report

Print a summary table:
- Total blog posts scanned
- Posts with valid images (count)
- Posts missing images (list each with title and expected path)

If all images exist, say "All blog posts have valid images." and stop.

### 4. Generate missing images

For each post missing an image:

1. Read the full article content to understand its topic
2. Write a detailed image generation prompt. Rules for the prompt:
   - Premium and elegant aesthetic, realistic photography feel
   - No text in the image whatsoever
   - No holograms, no cheesy stock-photo vibes, no gradients
   - Calm, intentional, aspirational mood
   - Describe a specific scene or composition (flat-lay, environment, objects) related to the article topic
   - End with: "Ultra realistic photography, natural lighting, 8K quality."
3. Run: `pnpm script scripts/generate-blog-image.ts --prompt '<prompt>' --output 'public/[meta-image value]'`
4. Confirm the file was created

### 5. Final report

List every image that was generated with its file path.

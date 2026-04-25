---
description: Generate a complete blog post from topic to final article
allowed-tools: WebSearch, WebFetch, Read, Write, Edit, Grep, Glob, Task, Bash
---

# Blog Pipeline

Generate a complete blog post for: **$ARGUMENTS**

## Overview

This command runs the full blog pipeline, creating all intermediate files in a dedicated folder for debugging and review.

## Folder Structure

All outputs go to: `blog/content/drafts/[slug]/`

| Step | File | Agent |
| :--- | :--- | :--- |
| 1 | `01-brief.md` | blog-ideator |
| 2 | `02-research.md` | blog-researcher |
| 3 | `03-outline.md` | blog-outliner |
| 4 | `04-article.md` | blog-writer |

## Instructions

### Step -1 — Pick a Topic (if none provided)

If `$ARGUMENTS` is empty, blank, or contains only whitespace/asterisks:

1. Read `.claude/blog-ideas.md`
2. Look at the **"Ideas (Not Started)"** section
3. Pick the first idea that does NOT already have a folder in `blog/content/drafts/`
4. Use that title as the topic for the rest of the pipeline
5. Tell the user which topic you picked and why

---

### Step 0 — Duplicate Check (run this BEFORE anything else)

1. **Scan existing content**:
   - Read the frontmatter (`meta-title`, `h1-title`, `tags`, `description`) of every `.md` file in `blog/content/` (published articles)
   - Read the `## Keywords` and `## Content Angle` sections of every `01-brief.md` found in `blog/content/drafts/*/` (articles already in progress)

2. **Compare against the new topic** on these dimensions:
   - **Title / subject overlap** — Is the core subject the same or very similar? (e.g. "AI in legal research" vs "how AI transforms legal research")
   - **Primary keyword overlap** — Would both articles target the same or near-identical search queries?
   - **Search intent overlap** — Do both articles answer the same underlying question for the same audience?
   - **Content angle overlap** — Even with different keywords, do both articles make the same core argument or cover the same ground?

3. **Decision**:
   - If **any significant overlap** is found across two or more of the dimensions above: **stop immediately**. Do not create any files or run any agents. Tell the user:
     - Which existing article(s) are too close, with the file path(s)
     - Specifically why (which dimensions overlap and how)
     - What the risk is (keyword cannibalization, duplicate content penalty, wasted effort)
     - A concrete suggestion: either a genuinely differentiated angle on the same topic, or a different topic entirely
   - If **no significant overlap** is found: proceed with the steps below.

---

1. **Generate slug** from the topic (lowercase, hyphens, no special chars)
2. **Create folder** at `blog/content/drafts/[slug]/`
3. **Run each agent sequentially**:
   - Spawn blog-ideator agent → writes `01-brief.md`
   - Spawn blog-researcher agent → reads `01-brief.md`, writes `02-research.md`
   - Spawn blog-outliner agent → reads `02-research.md`, writes `03-outline.md`
   - Spawn blog-writer agent → reads `03-outline.md`, writes `04-article.md`

4. **Set the article date**:
   - After `04-article.md` is written, update the `date` field in its frontmatter
   - Pick a random date between today and 1 month ago (e.g. if today is 2026-02-21, pick a random date between 2026-01-21 and 2026-02-21)
   - Format: `YYYY-MM-DD`

5. **Generate the meta image**:
   - Read `04-article.md` and extract the `meta-image` field and the article title from frontmatter
   - Determine the output path: `public/[meta-image value]` (e.g. `public/content/slug.webp`)
   - Write a detailed, vivid image generation prompt based on the article's topic/title. The prompt must follow these rules:
     - Premium and elegant aesthetic, realistic photography feel
     - No text in the image whatsoever (unless showing a real company logo)
     - No holograms, no cheesy stock-photo vibes, no gradients
     - Calm, intentional, aspirational mood
     - Describe a specific scene or composition (flat-lay, environment, objects) that relates to the article topic
     - End with: "Ultra realistic photography, natural lighting, 8K quality."
   - Run the script: `pnpm script scripts/generate-blog-image.ts --prompt '<prompt>' --output '<output-path>'`

6. **Publish the article**:
   - Read the `h1-title` from the frontmatter of `04-article.md`
   - Generate a clean, SEO-friendly slug from the h1-title. The slug must read like a sensible phrase. Strip year numbers (e.g. `2026`) and any dangling prepositions or words left behind (e.g. "5 Best Ways to Do SEO in 2026" → strip "in 2026", not just "2026"). Cap at ~6-8 meaningful words.
   - Copy `04-article.md` to `blog/content/[slug].md`

7. **Report completion** with the folder path, the published file path, the generated image path, and a summary

## Agent Spawning

For each step, use the Task tool with the appropriate `subagent_type`:
- `blog-ideator` for step 1
- `blog-researcher` for step 2
- `blog-outliner` for step 3
- `blog-writer` for step 4

Pass the folder path in the prompt so each agent knows where to read/write.

## Example

Topic: "AI adoption challenges at law firms"
Slug: `ai-adoption-challenges-law-firms`
Folder: `blog/content/drafts/ai-adoption-challenges-law-firms/`

## Final Output

When complete, tell the user:
- The folder location with all intermediate files
- The published file path in `blog/content/`
- The generated image path in `public/content/`
- That the article is live and they can edit it directly at the published path

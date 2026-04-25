---
description: Generate topic ideas and keyword strategy for a blog post
allowed-tools: WebSearch, Read, Grep, Write
---

# Blog Ideation

Use the **blog-ideator** agent to research and generate a topic brief for: $ARGUMENTS

## File Convention

Create a folder and write the brief:
1. Generate slug from topic (lowercase, hyphens)
2. Create folder: `blog/content/drafts/[slug]/`
3. Write brief to: `[folder]/01-brief.md`

## Instructions

1. Research the topic using web search
2. Identify primary and secondary keywords
3. Find "People Also Ask" questions
4. Analyze competitor content and gaps
5. Create a comprehensive topic brief

## Output

Save the topic brief to `01-brief.md` in the drafts folder.

The brief should include:
- Primary and secondary keywords
- Search intent analysis
- People Also Ask questions
- Recommended content angle
- How Legora fits as the solution
- Suggested titles

Tell the user the folder path so they can continue with `/blog-research [folder-path]`.

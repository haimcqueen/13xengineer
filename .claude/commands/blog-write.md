---
description: Write the final blog post from an outline
allowed-tools: Read, Write, Edit
---

# Blog Write

Use the **blog-writer** agent to write the final blog post from: $ARGUMENTS

## File Convention

The argument should be a folder path like: `blog/content/drafts/[slug]/`

1. Read: `[folder]/03-outline.md`
2. Optionally read: `[folder]/02-research.md` for data
3. Write to: `[folder]/04-article.md`

**IMPORTANT**: Write ONLY to `04-article.md` in the drafts folder. Do NOT write to `blog/content/` directly.

## Instructions

1. Read the outline from `03-outline.md`
2. Write in Legora's professional brand voice
3. Follow all writing rules (no banned vocabulary/patterns)
4. Include proper frontmatter with meta-title and meta-description
5. Add link references at the bottom

## Output

Write the final markdown file to `04-article.md` in the same folder.

The post must:
- Start with opening hook that addresses the user's problem
- Use proper markdown formatting
- Include tables where specified in outline
- Have 5-7 FAQ answers
- Link Legora naturally (not forced)
- Include all markdown link references at bottom
- Feel like it was written by a domain expert, not a marketer

Tell the user:
- The article is at `[folder]/04-article.md`
- They can review all intermediate files in the folder
- When satisfied, manually copy to `blog/content/[slug].md`

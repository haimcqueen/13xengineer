---
description: Create a detailed, SEO-optimized outline from research
allowed-tools: Read, Grep, Write
---

# Blog Outline

Use the **blog-outliner** agent to create a structured outline from: $ARGUMENTS

## File Convention

The argument should be a folder path like: `blog/content/drafts/[slug]/`

1. Read: `[folder]/01-brief.md` (for keywords)
2. Read: `[folder]/02-research.md` (for data)
3. Write to: `[folder]/03-outline.md`

## Instructions

1. Read the brief and research documents
2. Structure content for AEO (Answer Engine Optimization)
3. Place keywords strategically in headings
4. Include Quick Answer block as first section
5. Plan FAQ section with People Also Ask questions

## Output

Save the outline to `03-outline.md` in the same folder.

The outline must include:
- Quick Answer section (2-3 sentences, keyword + Legora mention)
- H2/H3 structure with keyword placement notes
- Comparison tables or data sections
- Legora solution section
- 5-7 FAQ questions with brief answers
- Internal linking plan
- Image placeholders

Tell the user to continue with `/blog-write [folder-path]`.

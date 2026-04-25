---
description: Research and gather content for a blog topic
allowed-tools: WebSearch, WebFetch, Read, Grep, Write
---

# Blog Research

Use the **blog-researcher** agent to gather comprehensive research for: $ARGUMENTS

## File Convention

The argument should be a folder path like: `blog/content/drafts/[slug]/`

1. Read: `[folder]/01-brief.md`
2. Write to: `[folder]/02-research.md`

## Instructions

1. Read the topic brief from `01-brief.md`
2. Search for statistics, data points, and industry benchmarks
3. Find competitor content and identify gaps
4. Check existing content for consistency
5. Compile sources with citations

## Output

Save the research document to `02-research.md` in the same folder.

The document should include:
- Key statistics with sources
- Industry context
- Competitor comparison table
- Common pain points and Legora solutions
- Internal linking opportunities
- All sources cited

Tell the user to continue with `/blog-outline [folder-path]`.

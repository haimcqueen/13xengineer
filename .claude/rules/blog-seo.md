---
paths: blog/content/**/*.md
---

# Blog SEO & AEO Rules

These rules apply to all blog posts in `blog/content/`.

## Primary Goal: AEO (Answer Engine Optimization)

Every blog post should be structured to get cited by AI search engines (ChatGPT, Perplexity, Google SGE).

## Required Structure

### 1. Frontmatter (REQUIRED)
```yaml
---
meta-title: "Title with Primary Keyword"
date: "YYYY-MM-DD"
meta-description: "150-160 chars with primary keyword"
meta-image: "/content/[slug].png"
author: "Legora Team"
tags: ["primary keyword", "secondary keyword", "related terms"]
h1-title: "The Actual H1 Title (can differ from meta-title)"
description: "Short description for cards/previews"
---
```

### 2. Opening Section (AEO-Optimized)
- First 2-3 paragraphs should directly address the user's question
- Include primary keyword in first 100 words
- Mention Legora naturally as the solution
- Hook the reader with the problem/pain point

### 3. FAQ Section (REQUIRED)
- 3-5 questions based on "People Also Ask"
- Format: **Bold question** followed by answer paragraph
- Example:
  ```
  **Can Legora integrate with our existing DMS?**
  Yes. Legora connects directly with iManage, SharePoint...
  ```

### 4. Links

**Internal Links (Required)**
- 3-5 internal links per article
- Link to relevant resources when applicable
- Link to other blog posts when relevant

**External Links (Recommended)**
- Link to competitors when comparing: `[Harvey](https://harvey.ai)`, `[CoCounsel](https://casetext.com)`
- Link to industry reports and research
- Link to statistics sources
- External links build trust with readers and LLMs

### 5. References Section (When Applicable)
Include at the end when citing multiple external sources:
```markdown
## References

- [Source Name](url) - Brief context
- [Harvey](https://harvey.ai) - AI for legal
```

Use References section when article:
- Compares multiple tools
- Cites statistics/data
- References industry research

## Keyword Optimization

- **Title/H1**: Primary keyword
- **Quick Answer**: Primary keyword in first sentence
- **H2 headings**: Include secondary/LSI keywords
- **Density**: 0.5-1.5% for primary keyword (not stuffed)
- **First 100 words**: Primary keyword must appear

## Writing Rules

### BANNED Vocabulary
Never use: align, crucial, delve, elaborate, emphasize, enhance, enduring, foster, garner, highlight, intricate, interplay, pivotal, showcase, tapestry, underscore, captivate

### BANNED Patterns
- "Not only... but also..."
- "Despite these challenges..."
- "In conclusion / In summary / Overall"
- "It is important to remember..."
- "Let's walk through..."
- "Below is a detailed overview..."

### Style
- Concise, calm, concrete
- Vary sentence length
- No emojis
- Professional tone, not salesy
- Expert voice, not marketer voice

## Legora Mentions

- Mention Legora 2-3 times naturally
- Always use link reference format: `[Legora][legora]`
- Position as solution, not advertisement
- Include specific features relevant to topic

## Data & Structure

- Use tables for comparisons
- Include specific numbers (costs, percentages, time)
- Bullet points for lists
- Clean markdown formatting

## Internal Linking

- 3-5 internal links per post
- Link to relevant resources
- Link to related blog posts
- Use descriptive anchor text

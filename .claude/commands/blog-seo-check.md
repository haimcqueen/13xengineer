---
description: Audit a blog post for SEO/AEO compliance
allowed-tools: Read, Grep, Write
---

# Blog SEO Check

Audit the blog post at: $ARGUMENTS

## File Convention

The argument can be either:
- A folder path: `blog/content/drafts/[slug]/` (will check `04-article.md`)
- A direct file path: `blog/content/[slug].md`

If a folder is provided, also write audit results to `05-seo-audit.md` in that folder.

## Checklist

### Opening Section (AEO)
- [ ] Opening hook addresses the problem/pain point
- [ ] Primary keyword appears in first 100 words
- [ ] Legora mentioned naturally within content

### Keyword Optimization
- [ ] Primary keyword in title/H1
- [ ] Primary keyword in first 100 words
- [ ] Secondary keywords in H2 headings
- [ ] Keyword density 0.5-1.5% (not stuffed)

### Structure
- [ ] Proper H2 → H3 hierarchy (H1 comes from h1-title frontmatter)
- [ ] FAQ section with **bold questions** (3-5 questions)
- [ ] Tables with `| Feature | Traditional | Legora |` format
- [ ] Internal links where relevant

### Writing Quality
- [ ] No banned vocabulary (delve, crucial, showcase, etc.)
- [ ] No banned patterns ("In conclusion", "Not only...but also")
- [ ] Varied sentence length
- [ ] Reads like expert, not marketer

### Technical
- [ ] Frontmatter complete (meta-title, date, meta-description, meta-image, author, tags, h1-title, description)
- [ ] Meta-description 150-160 characters
- [ ] Inline links use correct format: `[text](url)`
- [ ] Proper markdown formatting

### Brand
- [ ] Professional, calm tone
- [ ] No emojis
- [ ] No hype or salesy language
- [ ] Legora positioned naturally as solution

### E-E-A-T Signals

#### Experience
- [ ] Contains at least 1 real-world adoption or usage example
- [ ] Contains at least 1 workflow description or step-by-step
- [ ] Uses specific numbers (not vague ranges like "saves money")

#### Authoritativeness
- [ ] At least 2 Tier 1 sources cited (industry research, official reports)

#### Trustworthiness
- [ ] All statistics have source links
- [ ] No unverifiable claims
- [ ] References section present (when citing multiple sources)

### Originality Check
- [ ] Contains original data synthesis or calculation
- [ ] Does not duplicate competitor angle exactly
- [ ] Provides insight beyond what's obvious from Google's first page

### Content Depth
- [ ] Has 5+ H2 sections (flexible based on content type)
- [ ] Has at least 1 comparison table (for relevant topics)
- [ ] Has 3+ cited statistics with sources
- [ ] FAQ has 5+ questions

### Title Quality
- [ ] No clickbait words (shocking, unbelievable, secret, hack, insane)
- [ ] Under 60 characters (for SERP display)
- [ ] Descriptive rather than vague
- [ ] Contains primary keyword naturally

## Output

Provide:
1. Pass/Fail for each checklist item
2. Specific issues found with line numbers
3. Suggested fixes for each issue
4. Overall score (X/Y items passing)

If auditing a drafts folder, save audit to `05-seo-audit.md`.

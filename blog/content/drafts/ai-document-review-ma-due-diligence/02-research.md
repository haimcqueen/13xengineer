# Research Document: AI Document Review for M&A Due Diligence

## Brief Summary
M&A lawyers want to know which AI document review approaches actually deliver in live deals, beyond the hype. This article takes a practitioner's angle: what works, what breaks, and why adoption (not capability) is the real bottleneck.

## Key Statistics
- 86% of corporate and PE leaders have integrated GenAI into M&A workflows, with 83% investing over $1M in the technology - Source: [Deloitte 2025 M&A Generative AI Study](https://www.deloitte.com/us/en/what-we-do/capabilities/mergers-acquisitions-restructuring/articles/m-and-a-generative-ai-study.html)
- Firms using AI in M&A report an average 20% cost reduction and 30-50% faster deal cycles - Source: [McKinsey Gen AI in M&A Survey](https://www.mckinsey.com/capabilities/m-and-a/our-insights/gen-ai-in-m-and-a-from-theory-to-practice-to-high-performance)
- AI-powered platforms cut contract review time by 70-75% - Source: [CFO Dive / McKinsey](https://www.cfodive.com/news/generative-ai-reduces-merger-acquisition-costs-20percent-mckinsey/812514/)
- 26% of legal organizations actively using gen AI, up from 14% in 2024 - Source: [Thomson Reuters 2025 Future of Professionals Report](https://www.lawnext.com/2025/04/thomson-reuters-survey-over-95-of-legal-professionals-expect-gen-ai-to-become-central-to-workflow-within-five-years.html)
- Only 21% of firms have firm-wide adoption of generative AI tools, down from 24% in 2024 - Source: [ABA 2024 TechReport](https://www.americanbar.org/groups/law_practice/resources/tech-report/2024/2024-artificial-intelligence-techreport/)
- AI tools achieve 90-95% accuracy for common clause types; accuracy drops to 75-85% for unusual or non-standard clauses - Source: [Mixpeek AI Document Review Comparison](https://dilycode.com/ai-powered-document-review-tools-comparison/)
- Kira Systems delivers 90%+ accuracy, refined by 1,400+ lawyer-trained proprietary models and 45,000+ lawyer hours - Source: [Litera/Kira](https://www.litera.com/products/kira)
- Traditional manual contract review consumes up to 60% of total legal fees on a project - Source: [Spellbook](https://www.spellbook.legal/learn/ai-due-diligence)
- Sullivan & Cromwell's January 2026 memo warns that "inaccurate, incomplete, misleading or biased output from GenAI tools is routinely observed" - Source: [Sullivan & Cromwell M&A AI Memo](https://www.sullcrom.com/insights/memo/2026/January/Use-AI-Tools-Mergers-Acquisitions-Transactions)
- ABA Formal Opinion 512 requires lawyers to understand GAI's capacity and limitations before using it for client work - Source: [ABA Ethics Opinion](https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/)
- A mid-market acquisition that previously required 6-8 weeks of document review can now be completed in 10-14 days - Source: [McKinsey](https://www.mckinsey.com/capabilities/m-and-a/our-insights/gen-ai-in-m-and-a-from-theory-to-practice-to-high-performance)
- At GSK Stockmann, Harvey delivered 15-20% initial time savings, rising to 75% on unstructured data rooms - Source: [Harvey AI](https://www.harvey.ai/blog/harvey-in-practice-speed-up-diligence-review)

## Industry Context

The legal AI market is at an inflection point for M&A document review. According to Deloitte's 2025 study, 86% of corporate and PE leaders have integrated GenAI into their M&A workflows, and 35% are specifically applying it to due diligence. McKinsey's data shows average cost reductions of 20% and deal cycle acceleration of 30-50% for firms using AI. The global M&A deal value reached $2.6 trillion by mid-2025 (up 28% year-over-year), which means the volume of documents flowing through diligence workflows is growing faster than firms can staff for manually.

Yet firm-wide adoption tells a different story. The ABA's 2024 TechReport found only 21% of firms have deployed generative AI tools at a firm-wide level, down from 24% the prior year. Individual lawyers are experimenting (31% use GenAI personally at work), but institutional adoption lags. For M&A-specific tools, the gap is even starker: while large firms with 51+ lawyers report 39% adoption, smaller firms hover around 20%. Most AI tools fail adoption tests because they require lawyers to leave their existing workflow and learn a new interface.

The ethical landscape is also shifting. ABA Formal Opinion 512, issued in 2024, requires lawyers to understand the "capacity and limitations" of generative AI before using it for client work. Meanwhile, courts are starting to ask whether manual-only review pipelines meet competence standards when better tools exist. Sullivan & Cromwell's January 2026 memo framed the issue clearly: GenAI output is "routinely" inaccurate, so all work must be reviewed by qualified lawyers. Then, in April 2026, Sullivan & Cromwell itself had to apologize to a bankruptcy judge for AI hallucinations in a court filing, illustrating that even elite firms are not immune to these risks.

## Competitor Landscape
| Tool/Method | Pros | Cons | Cost |
|-------------|------|------|------|
| **Legora (Tabular Review)** | Analyzes thousands of documents at scale; AI-suggested markup and issue flagging; integrates into Word, iManage, SharePoint; firm-specific precedent training; 80% active user rate at BAHR | Newer entrant in the market; primarily European client base currently | Enterprise pricing (custom) |
| **Traditional Manual Review** | Full attorney judgment on every document; no technology risk; established process | 50-100 docs/hour per reviewer; consumes up to 60% of project legal fees; high error rate from fatigue; weeks-long timelines | $200-600+/hour associate rates |
| **Harvey** | Strong NLP for diligence extraction; 25,000+ custom agents; good at summarizing purchase agreements and flagging inconsistencies; $11B valuation signals staying power | General-purpose platform, not specialized for tabular document review; requires building custom agents; limited integration with DMS systems | Enterprise pricing (custom) |
| **Kira (Litera)** | 90%+ accuracy on standard clauses; 1,400+ pre-trained clause models; mature product (10+ years); serves 18 of top 25 M&A practices | Acquired by Litera in 2021, integration ongoing; pre-built models only, less flexible for bespoke deal structures; standalone interface | Enterprise pricing |
| **Luminance** | Strong anomaly detection; 30% shorter M&A timelines at Slaughter and May; unsupervised learning for pattern detection | Primarily UK/European focus; high learning curve reported; less robust clause extraction vs. purpose-built tools | Enterprise pricing |
| **Spellbook** | Lives inside Microsoft Word; 2,300+ contract types supported; good for individual contract review | Built for contract drafting/review, not bulk due diligence at scale; weaker on cross-document pattern analysis | From $399/mo |

## Expert Quotes / Data Points
- "Inaccurate, incomplete, misleading or biased output from GenAI tools is routinely observed, and all work produced by GenAI should be carefully reviewed by qualified lawyers." - Sullivan & Cromwell, January 2026 M&A AI Memo
- "Firms using generative AI in their M&A activities report an average cost reduction of roughly 20 percent." - McKinsey 2025 M&A Survey
- "86% of corporate and PE leaders have integrated GenAI into their M&A workflows, with 83% investing over $1 million in the technology." - Deloitte 2025 M&A Generative AI Study
- "Lawyers must exercise the legal knowledge, skill, thoroughness and preparation reasonably necessary for competent representation, as well as to understand the benefits and risks associated with technologies used for legal services." - ABA Formal Opinion 512
- "During the acquisition of a manufacturing supplier, an AI tool analyzing financial statements confidently reported that a 2022 real estate sale was tax-compliant, citing a non-existent tax declaration document, resulting in a $1.5 million tax liability post-deal." - Bloomberg Law
- "Forty percent of respondents report that gen AI enabled 30 to 50 percent faster deal cycles." - McKinsey

## Common Pain Points
1. **Volume overwhelms manual review capacity** - A mid-market deal can involve thousands of contracts, leases, employment agreements, and regulatory filings. Traditional review teams process 50-100 documents per hour, creating multi-week timelines that compress deal schedules. Legora solution: Tabular Review analyzes thousands of documents at scale with AI-suggested markup, reducing weeks to hours.
2. **Accuracy drops on non-standard clauses** - AI tools achieve 90-95% accuracy on common provisions (change of control, assignment, termination) but drop to 75-85% on unusual or bespoke clauses. Most existing tools don't flag this confidence gap. Legora solution: Firm-specific precedent training helps the AI learn the firm's own clause standards, improving accuracy on non-standard provisions over time.
3. **Hallucination risk in high-stakes contexts** - GenAI tools fabricate citations, miss liabilities, and generate confidently wrong assessments. The S&C example of a $1.5M tax liability from a hallucinated document is not an edge case. Legora solution: Human-in-the-loop design where AI suggests and flags, but attorneys validate and approve.
4. **Adoption failure at most firms** - Firm-wide AI adoption dropped from 24% to 21% between 2023-2024. Tools that require new interfaces and workflow disruption get abandoned. Legora solution: Integrates directly into Word, iManage, and SharePoint so lawyers never leave their existing workflow. BAHR's 80% active usage rate proves this works.
5. **Cross-document pattern detection** - Individual contract review misses patterns that only emerge across the full document set (e.g., inconsistent termination rights across vendor agreements, or change-of-control triggers scattered across employment contracts and facility leases). Legora solution: Tabular Review surfaces cross-contract patterns and inconsistencies across the entire data room.

## Original Analysis

### Synthesized Insight
The real cost of manual document review in M&A is not just the associate hours; it's the deal risk created by compressed timelines. If manual review takes 6-8 weeks and AI-assisted review takes 10-14 days (McKinsey data), that's 4-6 weeks of timeline compression. In a market where global M&A volume hit $2.6T in H1 2025 (28% YoY increase), the firms that can close faster capture more deal flow. Combining McKinsey's 20% cost reduction with the 70-75% time savings, the cost per reviewed document drops from roughly $15-25 (manual, assuming $300/hr associate reviewing 15-20 docs/hr with analysis) to $3-6 (AI-assisted with attorney verification).
- Derived from: McKinsey M&A survey (cost/time data) + Deloitte adoption study (investment data) + ABA TechReport (adoption rates)
- Unique takeaway: The adoption gap (86% of PE/corporate leaders using AI vs. 21% firm-wide adoption at law firms) means law firms are being pressured by their clients to adopt AI tools faster than their institutional structures allow. Client-side AI adoption is outpacing law firm adoption by 4:1.

### Content Gap Identified
No existing article connects three critical threads: (1) the accuracy spectrum on different clause types, (2) the adoption failure at most firms despite available tools, and (3) the integration model that solves both problems. Competitor content either reviews tools superficially or discusses AI risks abstractly. None explain why a tool that integrates into the lawyer's existing workflow (Word, DMS) achieves 80% adoption while standalone platforms struggle past 20%.

## Experience Evidence

### Adoption Example
At BAHR, one of the leading Nordic law firms, 80% of lawyers actively use Legora, with 30% engaging 10+ times per day. This is 4x the industry average for legal AI tool adoption. The key factor: Legora lives inside the tools lawyers already use (Word, iManage, SharePoint), so adoption doesn't require behavior change.

### Workflow Integration Evidence
Legora's Tabular Review lets M&A teams upload a data room and get AI-analyzed results across thousands of documents. The AI suggests markup, flags issues, and surfaces cross-contract patterns. Attorneys review and validate in a familiar tabular interface. For individual document work, the Word Add-in lets lawyers highlight a clause and get it rewritten using the firm's own precedent, directly inside the document they're editing. No copy-pasting between apps, no new tabs, no separate login.

## Internal Links Available
- No published articles yet (first article in the blog)

## Sources

### Tier 1 (Official/Research)
1. [Deloitte 2025 M&A Generative AI Study](https://www.deloitte.com/us/en/what-we-do/capabilities/mergers-acquisitions-restructuring/articles/m-and-a-generative-ai-study.html) - Industry research on GenAI adoption in M&A
2. [McKinsey: Gen AI in M&A](https://www.mckinsey.com/capabilities/m-and-a/our-insights/gen-ai-in-m-and-a-from-theory-to-practice-to-high-performance) - Survey data on cost reduction and deal acceleration
3. [Thomson Reuters 2025 Future of Professionals Report](https://www.lawnext.com/2025/04/thomson-reuters-survey-over-95-of-legal-professionals-expect-gen-ai-to-become-central-to-workflow-within-five-years.html) - Legal AI adoption statistics
4. [ABA 2024 TechReport: Artificial Intelligence](https://www.americanbar.org/groups/law_practice/resources/tech-report/2024/2024-artificial-intelligence-techreport/) - Firm-wide adoption data
5. [ABA Formal Opinion 512](https://www.americanbar.org/news/abanews/aba-news-archives/2024/07/aba-issues-first-ethics-guidance-ai-tools/) - Ethics guidance on AI use
6. [Sullivan & Cromwell: Use of AI Tools in M&A Transactions](https://www.sullcrom.com/insights/memo/2026/January/Use-AI-Tools-Mergers-Acquisitions-Transactions) - Risk analysis from top M&A firm

### Tier 2 (Established Publications)
7. [Bloomberg Law: AI's Due Diligence Applications Need Rigorous Human Oversight](https://news.bloomberglaw.com/legal-exchange-insights-and-commentary/ais-due-diligence-applications-need-rigorous-human-oversight) - Hallucination case study
8. [CFO Dive: Generative AI reduces M&A costs by 20%](https://www.cfodive.com/news/generative-ai-reduces-merger-acquisition-costs-20percent-mckinsey/812514/) - McKinsey data summary
9. [Bloomberg: Sullivan & Cromwell Apologizes for AI Hallucinations](https://www.bloomberg.com/news/articles/2026-04-21/top-law-firm-apologizes-to-bankruptcy-judge-for-ai-hallucination) - April 2026 incident
10. [Harvey AI: How M&A Teams Use Harvey](https://www.harvey.ai/blog/harvey-in-practice-how-m-and-a-teams-use-harvey) - Competitor capabilities
11. [Luminance AI Case Study: Slaughter and May](https://redresscompliance.com/ai-case-study-ai-powered-due-diligence-at-slaughter-and-may-with-luminance-ai/) - Competitor case study

### Tier 3 (Supporting)
12. [Spellbook: AI Due Diligence](https://www.spellbook.legal/learn/ai-due-diligence) - Supporting context on capabilities
13. [iManage: How Legal Professionals Use AI for Due Diligence](https://imanage.com/resources/resource-center/blog/how-today-s-legal-professionals-are-using-ai-for-due-diligence/) - Workflow context
14. [All About AI: AI in Law Statistics 2026](https://www.allaboutai.com/resources/ai-statistics/ai-in-law/) - Supporting adoption data

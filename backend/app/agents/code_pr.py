import asyncio

from app.models import Action, Company


class CodePrAgent:
    kind = "code-pr"

    async def run(self, action: Action, company: Company) -> dict:
        await asyncio.sleep(2)
        target = action.target or {}
        domain = target.get("domain") or company.own_domain or "example.com"
        schemas = target.get("schemas") or ["Product", "FAQPage"]
        diff = (
            "diff --git a/index.html b/index.html\n"
            "@@ -10,6 +10,28 @@\n"
            '   <meta charset="UTF-8" />\n'
            f"+  <script type=\"application/ld+json\">\n"
            "+    {\n"
            '+      "@context": "https://schema.org",\n'
            f'+      "@type": "{schemas[0]}",\n'
            f'+      "name": "{company.name}",\n'
            f'+      "url": "https://{domain}"\n'
            "+    }\n"
            "+  </script>\n"
        )
        return {
            "type": "code-pr",
            "title": action.title,
            "repo": f"{company.name.lower().replace(' ', '-')}/website",
            "branch": "felix/structured-data",
            "pr_url": f"https://github.com/demo/{company.id}/pull/42",
            "files_changed": ["index.html", "src/components/SEO.tsx"],
            "diff_preview": diff,
            "schemas_added": schemas,
        }

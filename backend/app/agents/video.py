import asyncio

from app.models import Action, Company


class VideoAgent:
    kind = "video"

    async def run(self, action: Action, company: Company) -> dict:
        await asyncio.sleep(2)
        target = action.target or {}
        return {
            "type": "video",
            "title": action.title,
            "duration_seconds": int(target.get("duration_target_seconds", 90)),
            "video_url": f"https://demo.felix.local/videos/{company.id}/preview.mp4",
            "thumbnail_url": f"https://demo.felix.local/videos/{company.id}/thumb.jpg",
            "storyboard": [
                "Open on a 60-page contract on screen.",
                f"Cut to {company.name} interface — start review.",
                "Highlight key clauses being flagged.",
                "Show timer: 4:32 elapsed.",
                "Closing card with CTA.",
            ],
        }

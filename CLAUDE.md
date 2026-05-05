# I.ON Energy Calculator — Claude Code Project Notes

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.

All font choices, colors, spacing, and aesthetic direction are defined there. Two contexts:
- **Rep mode** (dashboard, calculator, quotes, admin) — internal tool
- **Customer mode** (`/present/[quoteId]`) — customer-facing meeting deck

The two modes share Geist + Geist Mono typography, brand red `#d92127`, warm gray neutrals, and the no-stock-photography / anti-AI-slop rules. They differ on density (customer is 1.5× spacious), display scale (customer hero numbers 96-128px), tap targets (customer ≥56px), and motion (customer is intentional, rep is minimal-functional).

Do not deviate without explicit user approval. In QA mode (`/qa`, `/qa-design-review`), flag any code that doesn't match `DESIGN.md`.

**Memorable thing:** Swiss-engineered precision instrument. Reference posture for customer mode: UBS Private Banking on a tablet, NOT Sunrun marketing.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

- Product ideas/brainstorming → `/office-hours`
- Strategy/scope → `/plan-ceo-review`
- Architecture → `/plan-eng-review`
- Design system / plan review → `/design-consultation` or `/plan-design-review`
- Full review pipeline → `/autoplan`
- Bugs/errors → `/investigate`
- QA/testing site behavior → `/qa` or `/qa-only`
- Design QA + fix loop → `/qa-design-review`
- Code review/diff check → `/review`
- Visual polish → `/design-review`
- Ship/deploy/PR → `/ship` or `/land-and-deploy`
- Save progress → `/context-save`
- Resume context → `/context-restore`

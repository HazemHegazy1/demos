# Standing instructions for Claude Code

Each folder is a premium, elegant marketing website for a **real** local business, used as a sales demo.

## Design bar
- Elegant, modern, high-end UI/UX that keeps visitors engaged: scroll reveals, parallax, pinned/sticky sections, micro-interactions, smooth transitions, tasteful typography and spacing.
- Fully responsive (phones, short landscape screens, laptops, large desktops).
- Respect `prefers-reduced-motion`: disable or simplify animations, and make all content visible without them.
- Keep each demo a single static `index.html` (assets in the same folder if needed). No build step.

## Facts
- Never invent facts. Use only what is in `briefs/` or already in the page (name, address, hours, ratings, services, phone). Use clearly generic wording or placeholders otherwise.
- WhatsApp CTAs must use the business's own number from its brief, formatted `https://wa.me/<digits>`.

## Mandatory testing before you finish
Use Playwright (headless Chromium) on every demo you touch, at viewports **390x844, 1024x469, 1280x720, 1440x900**, in **both EN and AR** where a toggle exists. Scroll through the whole page step by step and assert:
1. No console errors or uncaught page errors.
2. Fixed/sticky header is not clipped: fully inside the viewport, nothing overlapping it, content not hidden under it.
3. No large empty or blank sections while scrolling. Reveal and pinned animations must not leave viewport-height empty gaps (e.g. check that each viewport-sized scroll step shows visible content; screenshot and inspect).
4. No horizontal overflow (`document.documentElement.scrollWidth <= innerWidth`).
5. Every `wa.me` link points to the correct number for that business.
Save screenshots under `tests/screenshots/` (gitignored) and fix all failures before committing. Summarise test results in your final message.

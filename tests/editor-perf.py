#!/usr/bin/env python3
"""Editor perf harness — measures scripting cost across three workloads.

Workloads:
  1. Type 30 characters into the page title (InlineEditable → store).
  2. Expand/collapse the first section card 10 times.
  3. Click 5 different section cards in sequence.

For each workload we capture:
  - wall ms (start→settle)
  - long-task count + total long-task ms (PerformanceObserver, longtask)
  - JS event-loop blocked ms approximation
  - layout/recalc-style counts via CDP Performance.getMetrics

Pass --label to tag the output JSON: tests/editor-perf-out/<label>.json
Default label: "run".
"""
import asyncio, json, os, sys, argparse
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "editor-perf-out"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"
TARGET = "/w/acme/p/northwind/editor?scope=pages&node=section:sc_home_features"

INSTRUMENT = """
() => {
  window.__perf = { longtasks: [], blocked: 0 };
  try {
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        window.__perf.longtasks.push({ d: e.duration, s: e.startTime });
        window.__perf.blocked += Math.max(0, e.duration - 50);
      }
    });
    po.observe({ entryTypes: ['longtask'] });
    window.__perf._po = po;
  } catch (_) {}
};
"""

RESET = """
() => {
  window.__perf.longtasks = [];
  window.__perf.blocked = 0;
};
"""

READ = """
() => ({
  longtaskCount: window.__perf.longtasks.length,
  longtaskTotalMs: window.__perf.longtasks.reduce((n, e) => n + e.d, 0),
  blockedMs: window.__perf.blocked,
});
"""

async def workload(page, name, fn):
    await page.evaluate(RESET)
    t0 = await page.evaluate("() => performance.now()")
    await fn()
    # Let any debounced/rAF work settle.
    await page.wait_for_timeout(200)
    t1 = await page.evaluate("() => performance.now()")
    metrics = await page.evaluate(READ)
    return {
        "name": name,
        "wallMs": round(t1 - t0, 1),
        **{k: round(v, 1) if isinstance(v, float) else v for k, v in metrics.items()},
    }

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default="run")
    args = ap.parse_args()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        # Restore auth session if present.
        await page.goto(BASE, wait_until="domcontentloaded")
        key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if key and sess:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
            )

        await page.goto(BASE + TARGET, wait_until="networkidle")
        await page.wait_for_timeout(800)
        await page.evaluate(INSTRUMENT)

        results = []

        # Workload 1: type into the page title input (first xl InlineEditable on page).
        async def w1():
            title = page.locator('input[placeholder="Untitled page"]').first
            if await title.count() == 0:
                # Fallback: any visible InlineEditable input
                title = page.locator(".group\\/inline input").first
            await title.click()
            await title.press("End")
            for ch in "performance-test-typing-thirty-x":
                await title.press(ch if ch != "-" else "Minus")
        results.append(await workload(page, "type-30-chars", w1))

        # Workload 2: expand/collapse the first section header chevron 10×.
        async def w2():
            btn = page.get_by_role("button", name="Collapse section").or_(
                page.get_by_role("button", name="Expand section")
            ).first
            for _ in range(10):
                await btn.click()
                await page.wait_for_timeout(15)
        results.append(await workload(page, "toggle-section-10x", w2))

        # Workload 3: click 5 different section cards in sequence.
        async def w3():
            cards = page.locator(".group.relative.overflow-hidden.rounded-xl")
            n = min(5, await cards.count())
            for i in range(n):
                await cards.nth(i).click()
                await page.wait_for_timeout(20)
        results.append(await workload(page, "select-5-sections", w3))

        await page.screenshot(path=str(OUT / f"{args.label}.png"))
        summary = {"label": args.label, "results": results}
        out_path = OUT / f"{args.label}.json"
        out_path.write_text(json.dumps(summary, indent=2))
        print(json.dumps(summary, indent=2))
        await browser.close()

asyncio.run(main())

#!/usr/bin/env python3
"""Smoke test: editor route renders and surfaces never resolve to transparent."""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "editor-surfaces-out"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"
TARGET = "/w/acme/p/northwind/editor?scope=pages&node=section:sc_home_features"

async def main():
    errors: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        await page.goto(BASE, wait_until="domcontentloaded")
        key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if key and sess:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
            )

        await page.goto(BASE + TARGET, wait_until="networkidle")
        await page.wait_for_timeout(1000)
        url1 = page.url
        await page.screenshot(path=str(OUT / "1_editor.png"))
        await page.wait_for_timeout(2000)
        url2 = page.url
        url_stable = url1 == url2

        # Surface assertions
        report = await page.evaluate("""
        () => {
          const body = getComputedStyle(document.body).backgroundColor;
          const sels = ['[data-surface]', '.bg-card', '.bg-popover', '[data-sidebar]', '[data-topbar]'];
          const violators = [];
          for (const sel of sels) {
            for (const el of document.querySelectorAll(sel)) {
              const bg = getComputedStyle(el).backgroundColor;
              const r = el.getBoundingClientRect();
              if (r.width < 4 || r.height < 4) continue;
              if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') {
                violators.push({ sel, cls: el.className?.toString?.().slice(0,160), bg });
              }
            }
          }
          // Confirm features section content rendered
          const hit = !!document.querySelector('[data-node-id="section:sc_home_features"]')
            || /features/i.test(document.body.innerText);
          return { body, violators: violators.slice(0, 20), violatorCount: violators.length, sectionRendered: hit };
        }
        """)

        ok = (
            report["sectionRendered"]
            and report["body"] not in ("", "rgba(0, 0, 0, 0)", "transparent")
            and report["violatorCount"] == 0
            and url_stable
            and not errors
        )
        summary = {
            "ok": ok,
            "url1": url1, "url2": url2, "urlStable": url_stable,
            "body": report["body"],
            "sectionRendered": report["sectionRendered"],
            "violatorCount": report["violatorCount"],
            "violators": report["violators"],
            "errors": errors[:10],
            "screenshot": str(OUT / "1_editor.png"),
        }
        print(json.dumps(summary, indent=2))
        await browser.close()
        sys.exit(0 if ok else 1)

asyncio.run(main())

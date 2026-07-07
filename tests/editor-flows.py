#!/usr/bin/env python3
"""Editor flow checks — palette, publish dialog, inspector accordion state."""
import asyncio, json, os, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path(__file__).parent / "editor-flows-out"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"
TARGET = "/w/acme/p/northwind/editor?scope=pages&node=section:sc_home_features"

async def main():
    failures: list[str] = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        console_errors: list[str] = []
        page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

        await page.goto(BASE, wait_until="domcontentloaded")
        key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if key and sess:
            await page.evaluate(
                f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
            )

        # 1. Command palette opens with ⌘K and renders something searchable.
        await page.goto(BASE + TARGET, wait_until="networkidle")
        await page.wait_for_timeout(600)
        await page.keyboard.press("Meta+K")
        await page.wait_for_timeout(250)
        palette = page.locator('[cmdk-root], [role="dialog"]').first
        if not await palette.is_visible():
            failures.append("palette did not open on Cmd+K")
        await page.screenshot(path=str(OUT / "1_palette.png"))
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(200)

        # 2. Publish button opens the confirmation dialog, Cancel closes it.
        publish = page.locator('[data-testid="editor-publish"]').first
        await publish.click()
        await page.wait_for_timeout(300)
        dialog_title = page.get_by_text("Publish to production?")
        if await dialog_title.count() == 0:
            failures.append("publish dialog did not open")
        await page.screenshot(path=str(OUT / "2_publish.png"))
        # AlertDialogCancel renders as a button with text "Cancel" inside [role=alertdialog]
        cancel = page.locator('[role="alertdialog"] button', has_text="Cancel").first
        await cancel.click()
        await page.wait_for_timeout(300)
        if await page.locator('[role="alertdialog"]').count() > 0:
            failures.append("publish dialog did not close on Cancel")

        # 3. Inspector accordion persistence. Navigate to a page node so the
        # PageInspector (with named groups) renders.
        await page.goto(
            BASE + "/w/acme/p/northwind/editor?scope=pages&node=page:home",
            wait_until="networkidle",
        )
        await page.wait_for_timeout(700)
        general = page.locator('button[aria-expanded]', has_text="General").first
        if await general.count() == 0:
            failures.append("General inspector group not found on page node")
        else:
            before = await general.get_attribute("aria-expanded")
            await general.click()
            await page.wait_for_timeout(450)
            after = await general.get_attribute("aria-expanded")
            if before == after:
                failures.append(
                    f"accordion toggle did not flip aria-expanded ({before}→{after})"
                )
            await page.reload(wait_until="networkidle")
            await page.wait_for_timeout(700)
            general2 = page.locator('button[aria-expanded]', has_text="General").first
            persisted = await general2.get_attribute("aria-expanded")
            if persisted != after:
                failures.append(
                    f"accordion state did not persist across reload ({after}→{persisted})"
                )
        await page.screenshot(path=str(OUT / "3_after_reload.png"))

        await browser.close()

    # Filter pre-existing Radix DialogContent accessibility warnings (CommandDialog).
    relevant_errors = [e for e in console_errors if "DialogContent" not in e]
    ok = not failures and not relevant_errors
    print(json.dumps({
        "ok": ok,
        "failures": failures,
        "consoleErrors": relevant_errors[:5],
    }, indent=2))
    sys.exit(0 if ok else 1)

asyncio.run(main())

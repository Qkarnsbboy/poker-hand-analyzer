// Screenshots the running dev server at a few replay points into ../.screenshots/.
// Usage (dev server must be running): npm run screenshot
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = new URL("../../.screenshots/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" }); // uses installed Chrome
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://localhost:5173");
await page.screenshot({ path: out + "river.png" });
await page.keyboard.press("2");
await page.screenshot({ path: out + "flop.png" });
await page.keyboard.press("End");
await page.screenshot({ path: out + "end.png" });

console.log(`Saved to ${out}`, errors.length ? { errors } : "");
await browser.close();

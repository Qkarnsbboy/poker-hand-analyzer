// Opens a visible Chrome window on the dev server and keeps it open until closed.
// Usage (dev server must be running): npm run open
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: false });
const page = await browser.newPage({ viewport: null });
await page.goto("http://localhost:5173");
page.on("close", () => browser.close());
await new Promise((resolve) => browser.on("disconnected", resolve));

// ============================================================
//  server/tools/screenshot.js  —  Web/Page Screenshot Tool
// ============================================================

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { resolvePath } = require("../lib/cwd");

const SCREENSHOT_DIR = path.join(process.cwd(), ".screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

/**
 * Capture a screenshot of a URL or local file path.
 */
async function toolScreenshot(urlOrFile, options = {}) {
  let targetUrl = urlOrFile;
  if (!targetUrl) return "ERROR: no URL or file path provided";

  // local file → file:// URL
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://") && !targetUrl.startsWith("file://")) {
    const abs = resolvePath(targetUrl);
    if (!fs.existsSync(abs)) return `ERROR: file not found: ${abs}`;
    targetUrl = `file://${abs}`;
  } else if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://") && !targetUrl.startsWith("file://")) {
    targetUrl = "https://" + targetUrl;
  }

  const outFile = path.join(SCREENSHOT_DIR, `shot_${Date.now()}.png`);

  // Try puppeteer first
  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: options.width || 1280, height: options.height || 800 });
    await page.goto(targetUrl, { waitUntil: "networkidle2", timeout: 30000 });
    if (options.wait) {
      await new Promise(r => setTimeout(r, options.wait));
    }
    await page.screenshot({ path: outFile, fullPage: !!options.fullPage });
    await browser.close();
    return `SCREENSHOT:${outFile}\nURL:${targetUrl}\nSize:${fs.statSync(outFile).size} bytes`;
  } catch (puppeteerErr) {
    // Fallback: try cutycapt, wkhtmltoimage, or headless chrome/chromium CLI
    const cmds = [
      `cutycapt --url="${targetUrl}" --out="${outFile}" 2>/dev/null`,
      `wkhtmltoimage --quiet "${targetUrl}" "${outFile}" 2>/dev/null`,
      `chromium-browser --headless --screenshot="${outFile}" --window-size=1280,800 "${targetUrl}" 2>/dev/null`,
      `google-chrome --headless --screenshot="${outFile}" --window-size=1280,800 "${targetUrl}" 2>/dev/null`,
    ];
    for (const cmd of cmds) {
      try {
        execSync(cmd, { timeout: 30000 });
        if (fs.existsSync(outFile) && fs.statSync(outFile).size > 0) {
          return `SCREENSHOT:${outFile}\nURL:${targetUrl}\nSize:${fs.statSync(outFile).size} bytes`;
        }
      } catch {}
    }
    return `ERROR: Screenshot failed. Install puppeteer: npm install puppeteer\n(${puppeteerErr.message})`;
  }
}

module.exports = {
  screenshot: a => toolScreenshot(a.url || a.path || a.file || a.url_or_path || "", { fullPage: a.full_page, wait: a.wait, width: a.width, height: a.height }),
  SCREENSHOT_DIR
};

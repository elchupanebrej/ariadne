import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const srcArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
const htmlPath = fileURLToPath(
  srcArg
    ? new URL(`../${srcArg.replace(/\.md$/, ".html")}`, import.meta.url)
    : new URL("../docs/nine_operations_software_en.html", import.meta.url),
);
const html = await readFile(htmlPath);
const server = createServer((_, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(html);
});

await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});

let browser;
try {
  try {
    browser = await chromium.launch();
  } catch (err) {
    console.warn(
      `Warning: Skipping Playwright browser pass (headless browser launch error: ${err.message})`,
    );
  }

  if (browser) {
    const page = await browser.newPage();
    const port = server.address().port;
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.renderAllMermaid === "function");

    assert.equal(
      await page.locator('pre.mermaid:not([id^="diagram-"])').count(),
      0,
      "Every Mermaid diagram needs a stable link target",
    );

    const diagrams = await page.locator("pre.mermaid").evaluateAll((nodes) =>
      nodes
        .filter((node) => /(^|[^$])\$[^$\n]+\$(?!\$)/m.test(node.textContent))
        .map((node) => node.dataset.diagram),
    );
    let formulas = 0;
    for (const diagram of diagrams) {
      await page.evaluate((id) => {
        document
          .querySelector(`pre.mermaid[data-diagram="${id}"]`)
          ?.scrollIntoView({ block: "center" });
      }, diagram);
      const rendered = page.locator(`.mermaid-rendered[data-diagram="${diagram}"]`);
      await rendered.waitFor({ state: "attached" });
      formulas += await rendered.locator("mjx-container").count();
    }

    assert.equal(await page.locator(".mermaid-error").count(), 0, "Mermaid rendering failed");
    for (const diagram of diagrams) {
      const count = await page.locator(`.mermaid-rendered[data-diagram="${diagram}"] mjx-container`).count();
      assert.ok(count > 0, `Diagram ${diagram} has formulas but no MathJax output`);
    }
    console.log(`Browser smoke check passed: ${diagrams.length} formula diagrams, ${formulas} formulas`);
  }
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

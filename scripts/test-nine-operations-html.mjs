import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const htmlPath = fileURLToPath(
  new URL("../docs/nine_operations_software_en.html", import.meta.url),
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
  browser = await chromium.launch();
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
  assert.equal(diagrams.length, 7, "Expected seven Mermaid diagrams with formulas");

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
  assert.equal(formulas, 30, "Not every Mermaid formula rendered with MathJax");
  console.log(`Browser smoke check passed: ${diagrams.length} diagrams, ${formulas} formulas`);
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}

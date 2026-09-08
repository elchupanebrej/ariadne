import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import QRCode from "qrcode";

const sourceArg = process.argv.slice(2).find((a) => !a.startsWith("-"));
const htmlPath = fileURLToPath(
  sourceArg
    ? new URL(`../${sourceArg.replace(/\.md$/, ".html")}`, import.meta.url)
    : new URL("../docs/nine_operations_software_en.html", import.meta.url),
);
const pdfPath = htmlPath.replace(/\.html$/, ".pdf");
// Per-edition orientation map: diagram indices are meaningless across editions.
const editionSuffix = sourceArg?.match(/_v\d+/)?.[0] ?? "";
const orientationsPath = fileURLToPath(
  new URL(`diagram-orientations${editionSuffix}.json`, import.meta.url),
);

const html = await readFile(htmlPath);
let orientations = {};
let tight = [];
let unreadable = [];
try {
  ({
    orientations,
    unreadable_at_A5: unreadable = [],
    tight = [],
  } = JSON.parse(await readFile(orientationsPath, "utf8")));
} catch {}

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
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto(`http://127.0.0.1:${server.address().port}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => typeof window.renderAllMermaid === "function");

  assert.equal(
    await page.locator('pre.mermaid:not([id^="diagram-"])').count(),
    0,
    "Every Mermaid diagram needs a stable link target",
  );

  await page.evaluate(() => {
    document.documentElement.dataset.theme = "light";
    document.getElementById("highlight-theme").href =
      "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-light.min.css";
    const style = document.createElement("style");
    style.textContent = `
      p { orphans: 3; widows: 3; }
      h1, h2, h3, h4, h5, h6 { break-after: avoid; page-break-after: avoid; }
      .keep-with-next { break-inside: avoid; }
      .mermaid-rendered { break-inside: avoid; }
      .mermaid-rendered svg { width: auto; max-width: 100%; height: auto; max-height: 108mm; }
      pre { overflow: visible; white-space: pre-wrap; }
      pre code { white-space: pre-wrap; word-break: break-word; }
      pre code, :not(pre) > code { font-size: 0.82em; }
      .qr-note {
        float: right; clear: right; width: 34mm; margin: 0 0 2mm 3mm;
        text-align: center; break-inside: avoid; page-break-inside: avoid;
        font: 6.5px/1.25 sans-serif; color: #444;
      }
      .qr-note img { width: 22mm; height: 22mm; }
      .qr-note .qr-cap { display: block; overflow-wrap: anywhere; }
      ul.table-as-list { margin: 0.5rem 0; padding-left: 1.1em; }
      ul.table-as-list ul { margin: 0.1rem 0 0.3rem; padding-left: 1.1em; list-style: circle; }
      /* MathJax display math and its hidden assistive copy expand the layout
         beyond the page, triggering Chromium's silent shrink-to-fit. */
      mjx-container[jax="CHTML"] {
        display: inline-block !important;
        max-width: 100% !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        vertical-align: middle;
      }
      mjx-container[jax="CHTML"][display="true"] { display: block !important; }
      mjx-assistive-mml { display: none !important; }
    `;
    document.head.appendChild(style);
  });

  // Print media first: table overflow must be measured at print width.
  await page.emulateMedia({ media: "print" });

  // Wide tables overflow the page even in landscape: reformat them as nested
  // lists (first column becomes the bullet, remaining columns key:value).
  await page.evaluate(() => {
    const tables = [...document.querySelectorAll("article table")];
    for (const table of tables) {
      if (table.scrollWidth <= table.clientWidth + 2) continue;
      const headers = [...table.querySelectorAll("thead th")].map(
        (th) => th.textContent.trim(),
      );
      const rows = [...table.querySelectorAll("tbody tr")];
      const list = document.createElement("ul");
      list.className = "table-as-list";
      for (const tr of rows) {
        let cells = [...tr.querySelectorAll("td, th")].map(
          (td) => td.innerHTML.trim(),
        );
        if (!cells.length) continue;
        // A leading "No."-style column or an empty title cell would render as
        // an empty numbered line: promote the first real cell to the title.
        let shift = 0;
        if (/^\d+\.?$/.test(cells[0])) shift = 1;
        else if (!cells[0] || cells[0] === "&nbsp;") shift = 1;
        if (shift && cells.length > 1) {
          cells = cells.slice(1);
        }
        const li = document.createElement("li");
        const title = document.createElement("strong");
        title.innerHTML = cells[0] || "";
        li.append(title);
        if (cells.length > 1) {
          const sub = document.createElement("ul");
          cells.slice(1).forEach((cell, i) => {
            if (!cell || cell === "&nbsp;") return;
            const subLi = document.createElement("li");
            const label = headers[i + 1 + shift];
            subLi.innerHTML = label
              ? `<em>${label}:</em> ${cell}`
              : cell;
            sub.append(subLi);
          });
          if (sub.children.length) li.append(sub);
        }
        list.append(li);
      }
      table.replaceWith(list);
    }
  });

  // Per-diagram orientation from the numeric optimizer map (scripts/diagram-orientations.json).
  await page.evaluate((assignment) => {
    const setDirection = (src, dir) => {
      src = src.replace(/^(flowchart|graph)\s+(TD|TB|LR|RL)\b/m, `$1 ${dir}`);
      if (/^stateDiagram(-v2)?\b/m.test(src)) {
        // mermaid parses an injected top-level "direction" line as state nodes
        // when the body is indented: never inject, strip any existing one.
        return src.replace(/^direction\s+\w+\s*$/m, "");
      }
      if (/^classDiagram\b/m.test(src)) {
        return src.replace(/^classDiagram\b/m, `classDiagram\ndirection ${dir}`);
      }
      return src;
    };
    for (const node of document.querySelectorAll("pre.mermaid")) {
      const dir = assignment[node.dataset.diagram];
      if (dir) node.textContent = setDirection(node.textContent, dir);
    }
  }, orientations);

  // Denser layout + shorter labels for diagrams too large for A5: drop the
  // parenthetical enumerations inside node labels (they duplicate body text).
  await page.evaluate((tightList) => {
    const tight = new Set(tightList);
    window.__mermaid?.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      flowchart: { htmlLabels: true, useMaxWidth: true, nodeSpacing: 14, rankSpacing: 24, padding: 6 },
    });
    for (const node of document.querySelectorAll("pre.mermaid")) {
      if (!tight.has(node.dataset.diagram)) continue;
      // Keep parentheses that contain TeX math.
      node.textContent = node.textContent.replace(
        /\s*\(([^()]{18,})\)/g,
        (match, inner) => (inner.includes("$") ? match : " "),
      );
    }
  }, tight.map(String));

  // QR margin notes for external links, anchored to the right page margin.
  const links = await page.evaluate(() =>
    [...document.querySelectorAll("article a[href^='http']")]
      .filter((a) => !a.closest("td, th"))
      .map((a) => ({ href: a.href, text: a.textContent.trim().slice(0, 70) })),
  );
  const unique = [...new Map(links.map((l) => [l.href, l])).values()];
  const qrDataUrls = new Map();
  for (const { href } of unique) {
    qrDataUrls.set(href, await QRCode.toDataURL(href, { margin: 0, width: 220 }));
  }
  console.log(`QR notes: ${links.length} anchors, ${unique.length} unique URLs`);
  await page.evaluate(
    ({ noteByHref }) => {
      const seen = new Set();
      for (const a of document.querySelectorAll("article a[href^='http']")) {
        if (a.closest("td, th")) continue;
        const href = a.href;
        const info = noteByHref[href];
        if (!info) continue;
        const block = a.closest("p, li, blockquote, h1, h2, h3, h4, h5, h6, dd, dt");
        if (!block || seen.has("url:" + href)) continue;
        seen.add("url:" + href);
        const note = document.createElement("div");
        note.className = "qr-note";
        const img = document.createElement("img");
        img.src = info.qr;
        img.alt = "QR: " + href;
        const cap = document.createElement("span");
        cap.className = "qr-cap";
        cap.textContent = info.text;
        note.append(img, cap);
        block.prepend(note);
      }
    },
    {
      noteByHref: Object.fromEntries(
        unique.map(({ href, text }) => [href, { text, qr: qrDataUrls.get(href) }]),
      ),
    },
  );

  // Prevent orphaned headings: keep a heading on the page of the block that
  // follows it (skip long blocks that cannot fit on one page anyway).
  await page.evaluate(() => {
    for (const h of document.querySelectorAll("article h1, article h2, article h3, article h4, article h5, article h6")) {
      const next = h.nextElementSibling;
      const isLongList =
        (next.tagName === "UL" || next.tagName === "OL") && next.children.length > 6;
      if (next && !isLongList && ["P", "UL", "OL", "BLOCKQUOTE"].includes(next.tagName)) {
        const wrap = document.createElement("div");
        wrap.className = "keep-with-next";
        h.replaceWith(wrap);
        wrap.append(h, next);
      }
    }
  });

  // DOM transforms above may have moved math into fresh nodes after MathJax's
  // initial typeset: re-typeset the document before rendering diagrams.
  await page.evaluate(() => window.MathJax.typesetPromise());

  const stats = await page.evaluate(() => window.renderAllMermaid());
  console.log(`Mermaid: ${stats.rendered}/${stats.total} rendered, ${stats.failed} failed`);
  assert.equal(stats.failed, 0, "Mermaid rendering failed");
  assert.equal(await page.locator(".mermaid-error").count(), 0, "Mermaid rendering failed");

  const formulas = await page.locator(".mermaid-rendered mjx-container").count();
  const inlineMath = await page.locator("mjx-container").count();
  console.log(`MathJax containers: ${inlineMath} total, ${formulas} inside diagrams`);
  const hasMath = await page.evaluate(() =>
    /\$[^$\n]+\$/.test(document.querySelector("article")?.textContent ?? ""),
  );
  if (hasMath) assert.ok(inlineMath > 1000, "Expected body math to render with MathJax");
  // Every diagram whose source contains inline math must have MathJax output.
  const mathDiagrams = await page.evaluate(() =>
    [...document.querySelectorAll("pre.mermaid")]
      .filter((n) => /(^|[^$])\$[^$\n]+\$(?!\$)/m.test(n.textContent))
      .map((n) => n.dataset.diagram),
  );
  for (const id of mathDiagrams) {
    const count = await page.locator(`.mermaid-rendered[data-diagram="${id}"] mjx-container`).count();
    assert.ok(count > 0, `Diagram ${id} has formulas but no MathJax output`);
  }

  // Quality gate: any layout wider than the printable page triggers Chromium's
  // silent shrink-to-fit and changes the font size. The viewport is sized to
  // the A5-landscape print width so the measurement matches print layout.
  const layout = await page.evaluate(() => {
    const clippedByAncestor = (el) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const ov = getComputedStyle(n).overflowX;
        if (ov === "auto" || ov === "scroll" || ov === "hidden" || ov === "clip") return true;
      }
      return false;
    };
    const offenders = [];
    for (const el of document.querySelectorAll("body, body *")) {
      const r = el.getBoundingClientRect();
      if (r.right > 795 && el.tagName !== "MJX-C" && !clippedByAncestor(el)) {
        offenders.push({
          text: el.textContent,
          tag: el.tagName,
          cls: String(el.className).slice(0, 40),
          right: Math.round(r.right),
          w: Math.round(r.width),
          chain: (() => {
            const chain = [];
            let n = el;
            for (let i = 0; n && i < 6; i++, n = n.parentElement) {
              chain.push(`${n.tagName}${n.id ? "#" + n.id.slice(0, 20) : ""}`);
            }
            return chain.join(" < ");
          })(),
        });
      }
    }
    offenders.sort((a, b) => b.right - a.right);
    for (const o of offenders) {
      if (o.tag === "MJX-CONTAINER") o.tex = (o.text ?? "").slice(0, 80);
    }
    for (const o of offenders) delete o.text;
    return { scrollWidth: document.documentElement.scrollWidth, offenders: offenders.slice(0, 5) };
  });
  console.log(`Print layout: ${layout.scrollWidth}px (limit 795)`);
  if (layout.offenders.length) {
    console.log("Overflow offenders:", JSON.stringify(layout.offenders));
  }
  assert.ok(layout.scrollWidth <= 795, "Print layout overflows the page; font size would shrink");

  await page.pdf({
    path: pdfPath,
    format: "A5",
    landscape: true,
    // Deliberate print scale: ~8pt body on A5, matching the approved v1 look.
    // Without this, accidental layout overflow decides the size instead.
    scale: 0.667,
    printBackground: true,
    margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="width:100%;text-align:center;font-size:8px;color:#666;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  console.log(`PDF written: ${pdfPath}`);
  if (unreadable.length && stats.total > 0) {
    console.log(
      `WARNING: ${unreadable.length} diagrams are below readable print size at A5 in both orientations; consider simplifying sources. Indices: ${unreadable.join(", ")}`,
    );
  }
} finally {
  await browser?.close();
  server.close();
}

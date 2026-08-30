import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = `${root}docs/nine_operations_software_en.md`;
const outputPath = `${root}docs/nine_operations_software_en.html`;
const checkOnly = process.argv.includes("--check");

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function plainText(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function createSlugger() {
  const counts = new Map();
  return (value) => {
    const base =
      value
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
        .trim()
        .replace(/\s/g, "-") || "section";
    const count = counts.get(base) ?? 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

// GitHub's $`...`$ form protects TeX from Markdown parsing. MathJax expects $...$.
function normalizeGitHubMath(markdown) {
  let fence;
  return markdown
    .split(/(?<=\n)/)
    .map((line) => {
      if (fence) {
        const close = line.match(/^\s*([`~]{3,})\s*$/);
        if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
          fence = undefined;
        }
        return line;
      }

      const open = line.match(/^\s*([`~]{3,})/);
      if (open) {
        fence = { char: open[1][0], length: open[1].length };
        return line;
      }

      return line.replace(/\$`([^`\n]+)`\$/g, (_, expression) => `$${expression}$`);
    })
    .join("");
}

function renderMarkdown(markdown) {
  const headings = [];
  const slug = createSlugger();
  let mermaidCount = 0;
  const renderer = new marked.Renderer();

  renderer.heading = function ({ tokens, depth }) {
    const content = this.parser.parseInline(tokens);
    const label = plainText(content);
    const id = slug(label);
    headings.push({ depth, id, label });
    return `<h${depth} id="${id}">${content}<a class="heading-link" href="#${id}" aria-label="Link to this section">#</a></h${depth}>\n`;
  };

  renderer.code = function ({ text, lang }) {
    const language = (lang ?? "").trim().split(/\s+/)[0].toLowerCase();
    if (language === "mermaid") {
      mermaidCount += 1;
      return `<pre id="diagram-${mermaidCount}" class="mermaid" data-diagram="${mermaidCount}">${escapeHtml(text)}</pre>\n`;
    }
    if (language === "math") {
      return `<div class="math-block">\\[${escapeHtml(text)}\\]</div>\n`;
    }
    const className = language ? ` class="language-${escapeHtml(language)}"` : "";
    return `<pre><code${className}>${escapeHtml(text)}</code></pre>\n`;
  };

  const body = marked.parse(normalizeGitHubMath(markdown), {
    gfm: true,
    renderer,
  });
  return { body, headings, mermaidCount };
}

function buildDocument(markdown) {
  const { body, headings, mermaidCount } = renderMarkdown(markdown);
  const title = headings.find(({ depth }) => depth === 1)?.label ?? "Nine Operations";
  const sourceHash = createHash("sha256").update(markdown).digest("hex");
  const toc = headings
    .filter(({ depth }) => depth <= 3)
    .map(
      ({ depth, id, label }) =>
        `<li class="toc-depth-${depth}"><a href="#${id}">${escapeHtml(label)}</a></li>`,
    )
    .join("\n");

  return {
    html: String.raw`<!doctype html>
<html lang="en" data-theme="dark" data-source-sha256="${sourceHash}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="source-sha256" content="${sourceHash}">
  <meta name="mermaid-count" content="${mermaidCount}">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css" id="highlight-theme">
  <script defer src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/highlight.min.js"></script>
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$'], ['\\[', '\\]']],
        processEscapes: true
      },
      options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] }
    };
  </script>
  <script defer src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js"></script>
  <style>
    :root { color-scheme: dark; --bg:#0d1117; --panel:#161b22; --text:#e6edf3; --muted:#8b949e; --border:#30363d; --accent:#58a6ff; --code:#161b22; }
    [data-theme="light"] { color-scheme:light; --bg:#fff; --panel:#f6f8fa; --text:#1f2328; --muted:#656d76; --border:#d0d7de; --accent:#0969da; --code:#f6f8fa; }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--bg); color:var(--text); font:16px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif; }
    a { color:var(--accent); }
    #toolbar { position:fixed; inset:0 0 auto 0; z-index:20; height:3rem; display:flex; align-items:center; gap:.75rem; padding:0 1rem; background:var(--panel); border-bottom:1px solid var(--border); }
    #toolbar strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    button,input { font:inherit; color:var(--text); background:var(--bg); border:1px solid var(--border); border-radius:.35rem; padding:.35rem .55rem; }
    button { cursor:pointer; }
    #menu-button { display:none; }
    aside { position:fixed; inset:3rem auto 0 0; width:20rem; overflow:auto; padding:1rem; background:var(--panel); border-right:1px solid var(--border); }
    #toc-search { position:sticky; top:0; width:100%; margin-bottom:.75rem; }
    #toc { margin:0; padding:0; list-style:none; font-size:.83rem; }
    #toc li { margin:.18rem 0; }
    #toc li[hidden] { display:none; }
    #toc a { display:block; color:var(--muted); text-decoration:none; }
    #toc a:hover { color:var(--accent); }
    .toc-depth-2 { padding-left:.75rem; }
    .toc-depth-3 { padding-left:1.5rem; }
    main { margin-left:20rem; padding:5rem clamp(1rem,4vw,4rem) 4rem; }
    article { max-width:78rem; margin:auto; }
    h1,h2,h3,h4,h5,h6 { line-height:1.25; scroll-margin-top:4rem; margin-top:1.8em; }
    h1,h2 { padding-bottom:.35rem; border-bottom:1px solid var(--border); }
    .heading-link { margin-left:.45rem; opacity:0; text-decoration:none; font-weight:400; }
    h1:hover .heading-link,h2:hover .heading-link,h3:hover .heading-link,h4:hover .heading-link,h5:hover .heading-link,h6:hover .heading-link { opacity:1; }
    blockquote { margin:1rem 0; padding:.1rem 1rem; color:var(--muted); border-left:.25rem solid var(--border); }
    pre { overflow:auto; padding:1rem; background:var(--code); border:1px solid var(--border); border-radius:.45rem; }
    code { font-family:ui-monospace,SFMono-Regular,Consolas,monospace; }
    :not(pre)>code { padding:.15rem .3rem; background:var(--code); border-radius:.25rem; }
    table { display:block; width:max-content; max-width:100%; overflow:auto; border-collapse:collapse; }
    th,td { padding:.5rem .7rem; border:1px solid var(--border); vertical-align:top; }
    th { background:var(--panel); }
    img,svg { max-width:100%; height:auto; }
    .mermaid,.mermaid-rendered { margin:1rem 0; overflow:auto; text-align:center; background:var(--panel); border:1px solid var(--border); border-radius:.45rem; padding:1rem; }
    .mermaid-error { color:#ff7b72; white-space:pre-wrap; text-align:left; }
    .math-block { overflow:auto; }
    hr { border:0; border-top:1px solid var(--border); margin:2rem 0; }
    @media (max-width:900px) {
      #menu-button { display:inline-block; }
      aside { transform:translateX(-100%); transition:transform .2s; z-index:15; }
      body.menu-open aside { transform:translateX(0); }
      main { margin-left:0; }
    }
    @media print { #toolbar,aside { display:none; } main { margin:0; padding:0; } article { max-width:none; } }
  </style>
</head>
<body>
  <header id="toolbar">
    <button id="menu-button" type="button" aria-label="Toggle table of contents">☰</button>
    <strong>${escapeHtml(title)}</strong>
    <span style="flex:1"></span>
    <button id="theme-button" type="button">Light theme</button>
  </header>
  <aside aria-label="Table of contents">
    <input id="toc-search" type="search" placeholder="Filter sections" aria-label="Filter sections">
    <nav><ol id="toc">${toc}</ol></nav>
  </aside>
  <main><article>${body}</article></main>
  <script>
    const root = document.documentElement;
    const themeButton = document.getElementById('theme-button');
    const setTheme = (theme) => {
      root.dataset.theme = theme;
      themeButton.textContent = theme === 'dark' ? 'Light theme' : 'Dark theme';
      document.getElementById('highlight-theme').href = theme === 'dark'
        ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css'
        : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css';
    };
    setTheme(localStorage.getItem('ariadne-doc-theme') || 'dark');
    themeButton.addEventListener('click', () => {
      const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ariadne-doc-theme', theme);
      setTheme(theme);
    });
    document.getElementById('menu-button').addEventListener('click', () => document.body.classList.toggle('menu-open'));
    document.getElementById('toc').addEventListener('click', () => document.body.classList.remove('menu-open'));
    document.getElementById('toc-search').addEventListener('input', (event) => {
      const query = event.target.value.toLowerCase();
      document.querySelectorAll('#toc li').forEach((item) => { item.hidden = !item.textContent.toLowerCase().includes(query); });
    });
    addEventListener('DOMContentLoaded', () => window.hljs?.highlightAll());
  </script>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11.12.2/dist/mermaid.esm.min.mjs';
    mermaid.initialize({ startOnLoad:false, theme:'dark', securityLevel:'loose', flowchart:{ htmlLabels:true, useMaxWidth:true } });
    const diagrams = [...document.querySelectorAll('pre.mermaid')];
    let sequence = 0;
    let queue = Promise.resolve();
    async function renderDiagram(node) {
      if (!node.isConnected || node.dataset.rendered) return;
      node.dataset.rendered = 'pending';
      let output;
      try {
        const result = await mermaid.render('ariadne-diagram-' + (++sequence), node.textContent);
        output = document.createElement('div');
        output.id = node.id;
        output.className = 'mermaid-rendered';
        output.dataset.diagram = node.dataset.diagram;
        output.innerHTML = result.svg;
        node.replaceWith(output);
        result.bindFunctions?.(output);
        await window.MathJax.startup.promise;
        await window.MathJax.typesetPromise([output]);
      } catch (error) {
        const target = output?.isConnected ? output : node;
        target.dataset.rendered = 'failed';
        target.classList.add('mermaid-error');
        target.insertAdjacentText('afterbegin', 'Diagram failed to render: ' + error.message + '\n\n');
        console.error('Mermaid diagram ' + node.dataset.diagram + ' failed', error);
      }
    }
    function schedule(node) {
      if (node.dataset.queued) return queue;
      node.dataset.queued = 'true';
      queue = queue.then(() => renderDiagram(node));
      return queue;
    }
    const observer = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => entries.filter((entry) => entry.isIntersecting).forEach((entry) => { observer.unobserve(entry.target); schedule(entry.target); }), { rootMargin:'800px 0px' })
      : null;
    if (observer) diagrams.forEach((node) => observer.observe(node));
    else diagrams.forEach(schedule);
    window.renderAllMermaid = async () => {
      observer?.disconnect();
      for (const node of diagrams) await schedule(node);
      await queue;
      return {
        total: diagrams.length,
        rendered: document.querySelectorAll('.mermaid-rendered').length,
        failed: document.querySelectorAll('.mermaid-error').length
      };
    };
    window.__ariadneDocument = { sourceSha256:'${sourceHash}', mermaidTotal:diagrams.length };
  </script>
</body>
</html>
`,
    headings: headings.length,
    mermaidCount,
    sourceHash,
  };
}

function validateDocument(html) {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const idSet = new Set(ids);
  const missing = [...html.matchAll(/<a href="#([^"]+)"/g)]
    .map((match) => match[1])
    .filter((id) => !idSet.has(id));
  if (idSet.size !== ids.length) throw new Error("Generated HTML contains duplicate ids");
  if (missing.length) throw new Error(`Broken internal links: ${[...new Set(missing)].join(", ")}`);
  if (/class="language-(?:c|cc|cpp|cxx|c\+\+)"/.test(html)) {
    throw new Error("C/C++ examples are not allowed; use TypeScript");
  }

  const telemetrySection = html
    .split('<h5 id="11231-concrete-architectural-example-telemetry-ingestion-pipeline">')[1]
    ?.split(/<h[1-4]\b/)[0];
  const telemetryExamples = telemetrySection?.match(/<code class="language-typescript">/g)?.length ?? 0;
  if (telemetryExamples !== 2) throw new Error("Telemetry before/after examples must be separate");

  const numberedTableCells = [...html.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g)]
    .map((match) => plainText(match[1]).trim())
    .filter((text) => /^\d+\.\s/.test(text));
  if (numberedTableCells.length) {
    throw new Error("Table row numbers must use a separate column");
  }

  const mermaidSources = [...html.matchAll(/<pre class="mermaid"[^>]*>([\s\S]*?)<\/pre>/g)].map(
    (match) => match[1],
  );
  if (mermaidSources.some((source) => /\$\$[^$]+\$\$/.test(source))) {
    throw new Error("Mermaid labels with mixed text must use MathJax $...$ delimiters");
  }
  if (
    mermaidSources.some((source) => /(^|[^$])\$[^$\n]+\$(?!\$)/m.test(source)) &&
    !html.includes("await window.MathJax.typesetPromise([output])")
  ) {
    throw new Error("Mermaid formulas require post-render MathJax typesetting");
  }
}

const markdown = await readFile(sourcePath, "utf8");
const result = buildDocument(markdown);
validateDocument(result.html);

if (checkOnly) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== result.html) {
    console.error("Generated documentation is stale. Run: npm run docs:build");
    process.exit(1);
  }
  console.log(`Documentation is current (${result.headings} headings, ${result.mermaidCount} diagrams).`);
} else {
  await writeFile(outputPath, result.html);
  console.log(`Built ${outputPath} (${result.headings} headings, ${result.mermaidCount} diagrams, ${result.sourceHash.slice(0, 12)}).`);
}

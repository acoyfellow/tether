import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { marked } from "marked";

const root = join(import.meta.dir, "..");
const docsDir = join(root, "docs");
const fonts = ["https:", "", "fonts.googleapis.com"].join("/");
const outDir = join(root, "client", "public", "docs");

const Score = Schema.Struct({ recall: Schema.Number, precision: Schema.Number, falseFlag: Schema.Number });
const Receipt = Schema.Struct({ verdict: Schema.String, bySystem: Schema.Record(Schema.String, Schema.Array(Score)) });
const receipt = Schema.decodeUnknownSync(Schema.fromJsonString(Receipt))(readFileSync(join(import.meta.dir, "receipt.json"), "utf8"));

const order = ["how-it-works", "api", "eval", "design", "limits"];
const slugs = order.filter((slug) => readdirSync(docsDir).includes(`${slug}.md`));
const titleOf = (markdown: string, slug: string) => markdown.split("\n")[0]?.replace(/^# /, "") ?? slug;

const lowest = (system: string, key: "recall" | "precision" | "falseFlag") => {
  const scores = receipt.bySystem[system] ?? [];

  return scores.length === 0 ? "—" : String(Math.min(...scores.map((score) => score[key])));
};

const nav = (current: string) =>
  slugs
    .map((slug) => {
      const title = titleOf(readFileSync(join(docsDir, `${slug}.md`), "utf8"), slug);

      return `<a href="/docs/${slug}"${slug === current ? ' aria-current="page"' : ""}>${title}</a>`;
    })
    .join("");

const shell = (title: string, current: string, body: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · tether</title>
<meta name="description" content="Check what an agent says it did against the output it did it with.">
<link rel="preconnect" href="${fonts}">
<link rel="stylesheet" href="${fonts}/css2?family=Google+Sans+Flex:opsz,wght@6..144,300..700&family=Google+Sans+Mono:wght@400;500&display=swap">
<link rel="stylesheet" href="/docs.css">
<link rel="alternate" type="text/markdown" href="/docs/${current}.md">
</head>
<body>
<header class="top"><a class="brand" href="/">tether</a><nav>${nav(current)}</nav><a class="gh" href="${"https:"}${"/".repeat(2)}github.com/acoyfellow/tether">GitHub</a></header>
<main class="doc">${body}</main>
<footer class="foot">Verdict <b>${receipt.verdict}</b> · tether recall ${lowest("tether", "recall")} · <a href="/llms.txt">llms.txt</a> · <a href="/docs/${current}.md">this page as markdown</a></footer>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });

for (const slug of slugs) {
  const markdown = readFileSync(join(docsDir, `${slug}.md`), "utf8");
  writeFileSync(join(outDir, `${slug}.md`), markdown);
  writeFileSync(join(outDir, `${slug}.html`), shell(titleOf(markdown, slug), slug, await marked.parse(markdown)));
}

const proof = {
  verdict: receipt.verdict,
  tether: { recall: lowest("tether", "recall"), precision: lowest("tether", "precision"), falseFlag: lowest("tether", "falseFlag") },
  clefAlone: { recall: lowest("clef-alone", "recall"), precision: lowest("clef-alone", "precision"), falseFlag: lowest("clef-alone", "falseFlag") },
  regex: { recall: lowest("regex", "recall"), precision: lowest("regex", "precision"), falseFlag: lowest("regex", "falseFlag") },
};

writeFileSync(join(root, "client", "public", "proof.json"), `${JSON.stringify(proof, null, 1)}\n`);

const indexPath = join(root, "client", "index.html");
const summary = `<noscript data-proof><p>Eval verdict: ${proof.verdict}. tether recall ${proof.tether.recall}, Clef alone ${proof.clefAlone.recall}, regex ${proof.regex.recall}. <a href="/docs/eval">Eval</a> · <a href="/llms.txt">llms.txt</a></p></noscript>`;
const index = readFileSync(indexPath, "utf8");
const withProof = index.includes("<noscript data-proof>") ? index.replace(/<noscript data-proof>[\s\S]*?<\/noscript>/, summary) : index.replace('<div id="root"></div>', `<div id="root"></div>\n    ${summary}`);

writeFileSync(indexPath, withProof);

console.log(`site: ${slugs.length} docs pages, verdict ${receipt.verdict}`);

import type { Html, HtmlBuilder } from "foldkit/html";
import type { Message } from "./message";
import type { Proof } from "./model";

type H = HtmlBuilder<Message>;

const docs = [
  { slug: "how-it-works", title: "How it works", line: "Read, compare in code, then decide. One job per step." },
  { slug: "api", title: "API", line: "One endpoint. Use the verdict as a CI or agent gate." },
  { slug: "eval", title: "Eval", line: "Frozen rule, real sessions, three systems, recomputed verdict." },
  { slug: "design", title: "Design", line: "Why comparison is code and model ids are config." },
  { slug: "limits", title: "Limits", line: "What it does not check, and what is not proven." },
];

const stat = (h: H, label: string, value: string, tone: string): Html =>
  h.div(
    [h.Class("flex flex-col gap-1 rounded-lg border border-line bg-raised p-4")],
    [h.span([h.Class("font-mono text-[11px] uppercase tracking-widest text-faint")], [label]), h.span([h.Class(`font-mono text-[24px] font-semibold ${tone}`)], [value])],
  );

const proofRow = (h: H, name: string, scores: Proof["tether"]): Html =>
  h.tr(
    [h.Class("border-b border-line")],
    [
      h.td([h.Class("py-2 pr-4 text-ink")], [name]),
      h.td([h.Class("py-2 pr-4 font-mono text-dim")], [scores.recall]),
      h.td([h.Class("py-2 pr-4 font-mono text-dim")], [scores.precision]),
      h.td([h.Class("py-2 font-mono text-dim")], [scores.falseFlag]),
    ],
  );

export const hero = (h: H): Html =>
  h.header(
    [h.Class("flex flex-col gap-4 pt-4")],
    [
      h.nav(
        [h.Class("flex flex-wrap items-baseline gap-x-5 gap-y-1 text-[14px] text-dim")],
        [
          h.span([h.Class("mr-auto text-[18px] font-semibold text-ink")], ["tether"]),
          ...docs.map((doc) => h.a([h.Href(`/docs/${doc.slug}`), h.Class("hover:text-ink")], [doc.title])),
          h.a([h.Href(["https:", "", "github.com", "acoyfellow", "tether"].join("/")), h.Class("hover:text-ink")], ["GitHub"]),
        ],
      ),
      h.h1([h.Class("max-w-3xl pt-8 text-[40px] font-semibold leading-[1.1] tracking-tight text-ink")], ["Check what an agent says it did against the output it did it with."]),
      h.p([h.Class("max-w-2xl text-[17px] leading-relaxed text-dim")], [
        "Agents end with a summary: all 42 tests pass, deployed version 7f3a91c. The output it rests on is a few screens up, and nobody reads both. tether reads both, draws a line from each claim to the text behind it, and gives a gate verdict: pass, retry or ask.",
      ]),
    ],
  );

export const proofSection = (h: H, proof: Proof | null): Html =>
  h.section(
    [h.Id("proof"), h.Class("flex flex-col gap-4 border-t border-line pt-8")],
    proof === null
      ? [h.p([h.Class("text-dim")], ["Loading the eval receipt…"])]
      : [
          h.h2([h.Class("text-[22px] font-semibold text-ink")], ["Does it work?"]),
          h.p([h.Class("max-w-2xl text-dim")], [
            "Frozen eval on 120 real claim and output pairs from 77 coding-agent sessions. Broken cases have an edited count or another session's output. Scored on the holdout, lowest of 3 runs.",
          ]),
          h.div(
            [h.Class("grid grid-cols-1 gap-3 sm:grid-cols-3")],
            [
              stat(h, "verdict", proof.verdict, proof.verdict === "proven" ? "text-held" : "text-broken"),
              stat(h, "tether recall on broken", proof.tether.recall, "text-ink"),
              stat(h, "regex recall on broken", proof.regex.recall, "text-ink"),
            ],
          ),
          h.div(
            [h.Class("overflow-x-auto")],
            [
              h.table(
                [h.Class("w-full text-left text-[14px]")],
                [
                  h.thead(
                    [],
                    [h.tr([h.Class("border-b border-line text-faint")], ["System", "Recall", "Precision", "False flags"].map((label) => h.th([h.Class("py-2 pr-4 font-normal")], [label])))],
                  ),
                  h.tbody([], [proofRow(h, "tether", proof.tether), proofRow(h, "Clef alone", proof.clefAlone), proofRow(h, "regex", proof.regex)]),
                ],
              ),
            ],
          ),
          h.p([h.Class("text-[14px] text-dim")], [h.a([h.Href("/docs/eval"), h.Class("underline decoration-faint underline-offset-2 hover:text-ink")], ["Read the rule, the limits and how to reproduce it →"])]),
        ],
  );

export const docsSection = (h: H): Html =>
  h.section(
    [h.Class("grid grid-cols-1 gap-3 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-3")],
    docs.map((doc) =>
      h.a(
        [h.Href(`/docs/${doc.slug}`), h.Class("flex flex-col gap-1 rounded-lg border border-line p-4 hover:border-ink")],
        [h.span([h.Class("font-semibold text-ink")], [doc.title]), h.span([h.Class("text-[14px] text-dim")], [doc.line])],
      ),
    ),
  );

export const footer = (h: H): Html =>
  h.footer(
    [h.Class("flex flex-wrap gap-x-5 border-t border-line pt-6 pb-10 text-[13px] text-faint")],
    [
      h.span([], ["MIT"]),
      h.a([h.Href("/llms.txt"), h.Class("hover:text-ink")], ["llms.txt"]),
      h.a([h.Href("/docs/api"), h.Class("hover:text-ink")], ["POST /api/check"]),
      h.span([], ["Clairic reads. Code compares. Clef decides."]),
    ],
  );

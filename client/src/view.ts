import { Match } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { EXAMPLES } from "./examples";
import { docsSection, footer, hero, proofSection } from "./landing";
import { Message } from "./message";
import { type Line, type LineStatus, type Model, type Result, Run } from "./model";

type H = HtmlBuilder<Message>;

const TONE: Record<LineStatus, { readonly mark: string; readonly stroke: string; readonly word: string }> = {
  held: { mark: "bg-held/25 ring-held", stroke: "var(--color-held)", word: "held" },
  broken: { mark: "bg-broken/25 ring-broken", stroke: "var(--color-broken)", word: "broken" },
  unbacked: { mark: "bg-unbacked/25 ring-unbacked", stroke: "var(--color-unbacked)", word: "nothing behind it" },
  unclaimed: { mark: "", stroke: "transparent", word: "not claimed" },
};

type Mark = { readonly start: number; readonly end: number; readonly line: Line };

const marksFor = (lines: ReadonlyArray<Line>, side: "claim" | "evidence"): ReadonlyArray<Mark> =>
  lines
    .flatMap((line) => {
      const span = line[side].span;

      return span && line.status !== "unclaimed" ? [{ start: span[0], end: span[1], line }] : [];
    })
    .toSorted((a, b) => a.start - b.start)
    .filter((mark, index, all) => index === 0 || mark.start >= (all[index - 1]?.end ?? 0));

const segmented = (h: H, text: string, marks: ReadonlyArray<Mark>, side: string, focus: string | null): ReadonlyArray<Html | string> => {
  const out: Array<Html | string> = [];
  let cursor = 0;

  for (const mark of marks) {
    if (mark.start > cursor) out.push(text.slice(cursor, mark.start));
    const dim = focus !== null && focus !== mark.line.id;
    out.push(
      h.mark(
        [
          h.Id(`${side}-${mark.line.id}`),
          h.Class(`rounded px-0.5 ring-1 ${TONE[mark.line.status].mark} ${dim ? "opacity-30" : ""} text-ink transition-opacity`),
          h.OnMouseEnter(Message.FocusedLine({ id: mark.line.id })),
          h.OnMouseLeave(Message.FocusedLine({ id: null })),
        ],
        [text.slice(mark.start, mark.end)],
      ),
    );
    cursor = mark.end;
  }

  if (cursor < text.length) out.push(text.slice(cursor));

  return out;
};

const pane = (h: H, title: string, body: ReadonlyArray<Html | string>): Html =>
  h.section(
    [h.Class("min-w-0 flex-1")],
    [
      h.h2([h.Class("mb-2 font-mono text-[11px] uppercase tracking-widest text-faint")], [title]),
      h.pre([h.Class("min-h-48 whitespace-pre-wrap break-words rounded-lg border border-line bg-raised p-4 font-mono text-[13px] leading-6 text-dim")], [...body]),
    ],
  );

const editor = (h: H, title: string, value: string, toMessage: (value: string) => Message): Html =>
  h.label(
    [h.Class("min-w-0 flex-1")],
    [
      h.span([h.Class("mb-2 block font-mono text-[11px] uppercase tracking-widest text-faint")], [title]),
      h.textarea(
        [h.Value(value), h.OnInput(toMessage), h.Rows(9), h.Class("w-full resize-y rounded-lg border border-line bg-raised p-4 font-mono text-[13px] leading-6 text-ink outline-none focus:border-ink")],
      ),
    ],
  );

const lineRow = (h: H, line: Line, focus: string | null): Html => {
  const tone = TONE[line.status];
  const dim = focus !== null && focus !== line.id;

  return h.li(
    [
      h.Class(`grid grid-cols-[8rem_1fr_1.5rem_1fr_8rem] items-center gap-3 py-2 font-mono text-[13px] ${dim ? "opacity-30" : ""} transition-opacity`),
      h.OnMouseEnter(Message.FocusedLine({ id: line.id })),
      h.OnMouseLeave(Message.FocusedLine({ id: null })),
    ],
    [
      h.span([h.Class("text-faint")], [line.label]),
      h.span([h.Class("truncate text-ink")], [line.claim.value ?? "—"]),
      h.svg(
        [h.ViewBox("0 0 24 8"), h.Class("h-2 w-6"), h.AriaHidden(true)],
        [h.line([h.X1("0"), h.Y1("4"), h.X2("24"), h.Y2("4"), h.Stroke(tone.stroke), h.StrokeWidth(String(1 + line.evidence.confidence * 3)), ...(line.status === "held" ? [] : [h.StrokeDasharray("3 3")])], [])],
      ),
      h.span([h.Class("truncate text-ink")], [line.evidence.value ?? "—"]),
      h.span([h.Class("text-right"), h.Style({ color: tone.stroke })], [tone.word]),
    ],
  );
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

const verdictTone = (action: string): string =>
  Match.value(action).pipe(
    Match.when("pass", () => "text-held"),
    Match.when("retry", () => "text-broken"),
    Match.orElse(() => "text-unbacked"),
  );

const verdictBar = (h: H, result: Result, ms: number): Html => {
  const { verdict, tally, fixMinutes } = result;
  const tone = verdictTone(verdict.action);

  return h.div(
    [h.Id("verdict"), h.Class("flex flex-wrap items-baseline gap-x-6 gap-y-2 rounded-lg border border-line p-4 font-mono text-[13px]")],
    [
      h.span([h.Class(`text-[20px] font-semibold uppercase ${tone}`)], [verdict.action]),
      h.span([h.Class("text-dim")], [`evidence supports the message: ${percent(verdict.supported)}`]),
      h.span([h.Class("text-dim")], [`${tally.held} held · ${tally.broken} broken · ${tally.unbacked} with nothing behind it`]),
      ...(fixMinutes ? [h.span([h.Class("text-dim")], [`fix estimate ${Math.round(fixMinutes.low)}-${Math.round(fixMinutes.high)} min`])] : []),
      h.span([h.Class("ml-auto text-faint")], [`${result.inputTokens} tokens · ${ms} ms`]),
    ],
  );
};

const checked = (h: H, model: Model, result: Result, ms: number): ReadonlyArray<Html> => {
  const shown = result.lines.filter((line) => line.status !== "unclaimed");

  return [
    h.div(
      [h.Class("flex flex-col gap-6 md:flex-row")],
      [
        pane(h, "The agent said", segmented(h, model.claim, marksFor(shown, "claim"), "claim", model.focus)),
        pane(h, "The evidence shows", segmented(h, model.evidence, marksFor(shown, "evidence"), "evidence", model.focus)),
      ],
    ),
    h.ul([h.Id("lines"), h.Class("divide-y divide-line rounded-lg border border-line px-4")], shown.map((line) => lineRow(h, line, model.focus))),
    verdictBar(h, result, ms),
  ];
};

const body = (h: H, model: Model): ReadonlyArray<Html> =>
  Run.match(model.run, {
    Checked: ({ result, ms }) => checked(h, model, result, ms),
    Failed: ({ reason }) => [h.p([h.Id("error"), h.Class("rounded-lg border border-broken p-4 font-mono text-[13px] text-broken")], [reason])],
    Checking: () => [h.p([h.Class("font-mono text-[13px] text-faint")], ["Reading both sides…"])],
    Idle: () => [],
  });

const examplePicker = (h: H): Html =>
  h.div(
    [h.Class("flex flex-wrap gap-2")],
    EXAMPLES.map((example, index) =>
      h.button(
        [h.Type("button"), h.Class("h-8 rounded-md border border-line px-3 text-[13px] text-dim hover:border-ink hover:text-ink"), h.OnClick(Message.PickedExample({ index }))],
        [example.name],
      ),
    ),
  );

export const view = (model: Model, h: H): Html =>
  h.main(
    [h.Class("mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10")],
    [
      hero(h),
      h.h2([h.Id("demo"), h.Class("border-t border-line pt-8 text-[22px] font-semibold text-ink")], ["Try it"]),
      h.p([h.Class("max-w-2xl text-[15px] text-dim")], [
        "Paste what an agent said and the output it ran, or pick an example. Each claim gets a line to the exact text behind it. A line with nothing at the other end means nothing backs the claim.",
      ]),
      examplePicker(h),
      h.div(
        [h.Class("flex flex-col gap-6 md:flex-row")],
        [
          editor(h, "Agent message", model.claim, (value) => Message.EditedClaim({ value })),
          editor(h, "Evidence: logs, test output, deploy output", model.evidence, (value) => Message.EditedEvidence({ value })),
        ],
      ),
      h.div(
        [h.Class("flex")],
        [
          h.button(
            [
              h.Id("check"),
              h.Type("button"),
              h.Disabled(Run.isAnyOf(["Checking"])(model.run) || !model.claim.trim() || !model.evidence.trim()),
              h.Class("h-10 rounded-md bg-ink px-5 text-[14px] font-medium text-bg disabled:opacity-40"),
              h.OnClick(Message.ClickedCheck()),
            ],
            ["Check the claims"],
          ),
        ],
      ),
      ...body(h, model),
      proofSection(h, model.proof),
      docsSection(h),
      footer(h),
    ],
  );

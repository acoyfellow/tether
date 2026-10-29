# Fit

Written after the eval, not before. This file is the prior-art search that should have come first.

## Problem

Check whether an agent's final message is backed by the output it ran. In the literature this is grounding or factual-consistency checking: given evidence and a claim, is the claim supported, contradicted or not mentioned?

## Existing tools

- LettuceDetect, span-level grounding for RAG, code-agent answers and tool output (MIT, 149M to 2B models): https://github.com/KRLabsOrg/LettuceDetect
- MiniCheck and Bespoke-MiniCheck-7B, sentence-level fact checking on grounding documents: https://github.com/Liyan06/MiniCheck
- Pharos, coding-agent trajectory monitor with a `deception` class and a regex baseline: https://github.com/ayushkhd/pharos
- Faithfulness metrics in eval frameworks: https://github.com/confident-ai/deepeval and https://github.com/vibrantlabsai/ragas

## Public benchmark

- LLM-AggreFact, 11 grounded fact-verification datasets with a public leaderboard: https://llm-aggrefact.github.io
- RAGTruth, human span labels for hallucinations in RAG answers: https://aclanthology.org/2024.acl-long.585/

## Baselines

From `fit/spec.json`, holdout split, F1 on broken claims. tether is scored on its worst run, baselines on their best:

| System | F1 |
|---|---|
| regex | 0.974 |
| tether | 0.874 |
| Clef alone | 0.667 |

## Decision

tether does not beat the regex. Purpose-built grounding models exist and are benchmarked. The next test, if any, is LettuceDetect on these cases plus outside adversarial cases, not more tether.

Decision: stop

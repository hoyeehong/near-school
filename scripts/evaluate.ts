import { mkdir, writeFile } from "node:fs/promises";
import { demoChat } from "../lib/demo-chat";
import { demoPlaces } from "../data/demo";
import { liveChat } from "../lib/ai";
import { database } from "../lib/db";
const cases = [
  { question: "Show the two-track schools", year: 2027, ids: 12 },
  { question: "Show the two-track schools", year: 2026, ids: 0 },
  {
    question: "Which track applies to my address?",
    year: 2027,
    pattern: /unverified|unavailable|cannot.{0,30}verif|not.{0,20}verified/i,
    noActions: true,
  },
  { question: "Explain the new Phase 2C rules", year: 2027, citations: true },
  { question: "Find parks near Nanyang", year: 2027, category: "park" },
];
const run = process.env.EVAL_LIVE === "true" ? liveChat : demoChat;
const results = [];
for (const c of cases) {
  const started = Date.now();
  const result = await run(
    c.question,
    {
      year: c.year as 2026 | 2027,
      selectedId: null,
      addressId: null,
      visibleIds: [],
      categories: ["school"],
    },
    demoPlaces,
  );
  const action = result.actions.find((a) => a.type === "selectFeatures");
  const ids = action?.type === "selectFeatures" ? action.ids : [];
  results.push({
    question: c.question,
    passed:
      (c.ids === undefined || ids.length === c.ids) &&
      (!c.pattern || c.pattern.test(result.answer)) &&
      (!c.noActions || result.actions.length === 0) &&
      (!c.citations || result.citations.length > 0) &&
      (!c.category ||
        (ids.length > 0 &&
          ids.every(
            (id) =>
              demoPlaces.find((p) => p.id === id)?.category === c.category,
          ))),
    latencyMs: Date.now() - started,
    answer: result.answer,
    citations: result.citations,
    actions: result.actions,
  });
}
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/evaluation.json",
  JSON.stringify(
    {
      mode: process.env.EVAL_LIVE === "true" ? "live" : "deterministic-demo",
      results,
    },
    null,
    2,
  ),
);
console.log(results);
await database().end();
if (results.some((r) => !r.passed)) process.exitCode = 1;

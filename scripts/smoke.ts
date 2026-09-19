export {};
const base = process.env.SMOKE_URL ?? "http://127.0.0.1:3000";
const health = await fetch(`${base}/api/health`, {
  signal: AbortSignal.timeout(20000),
});
if (!health.ok) throw new Error("Health check failed");
const status = await health.json();
const home = await fetch(base, { signal: AbortSignal.timeout(20000) });
if (!home.ok || !(await home.text()).includes("near"))
  throw new Error("Page check failed");
const chat = await fetch(`${base}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Show the two-track schools",
    context: { year: 2027 },
  }),
  signal: AbortSignal.timeout(90000),
});
if (!chat.ok) throw new Error(`Chat check failed: ${chat.status}`);
const answer = await chat.json();
if (!answer.answer || !Array.isArray(answer.actions))
  throw new Error("Chat response invalid");
console.log(JSON.stringify({ status: "passed", ...status }));

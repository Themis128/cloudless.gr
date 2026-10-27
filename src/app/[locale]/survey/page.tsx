"use client";
import { useState } from "react";

const QUESTIONS: { key: string; label: string; options: string[] }[] = [
  { key: "stack", label: "Where does your infrastructure run today?", options: ["On-prem / VPS", "AWS", "GCP/Azure", "Mixed / unsure"] },
  { key: "pain", label: "Biggest bottleneck right now?", options: ["Cloud cost", "Performance", "Monitoring / visibility", "Security / compliance"] },
  { key: "team", label: "Team size?", options: ["Just me", "2-10", "11-50", "50+"] },
];

export default function SurveyPage() {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const res = await fetch("/api/survey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, answers, consent: true, locale: "en" }),
    });
    if (res.ok) setDone(true); else setErr("Something went wrong — try again");
  }

  if (done) return (
    <main className="min-h-screen bg-void text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-heading mb-4">Thanks — your stack audit is on the way.</h1>
        <p className="text-slate-400">We&apos;ll email a benchmark tailored to your answers within the day.</p>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen bg-void text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="max-w-md w-full space-y-6 rounded-xl border border-slate-800 bg-void-light/50 p-8">
        <h1 className="text-2xl font-heading">The 60-second stack audit</h1>
        {QUESTIONS.map((q) => (
          <fieldset key={q.key}>
            <legend className="mb-2 text-sm text-slate-300">{q.label}</legend>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((o) => (
                <button type="button" key={o}
                  onClick={() => setAnswers((a) => ({ ...a, [q.key]: o }))}
                  className={`rounded-lg border px-3 py-2 text-sm ${answers[q.key] === o ? "border-neon-cyan bg-neon-cyan/10" : "border-slate-700 hover:border-slate-500"}`}>
                  {o}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
        <input className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <input required type="email" className="w-full rounded-lg border border-slate-700 bg-void px-3 py-2" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} />
        {err && <p className="text-sm text-red-400">{err}</p>}
        <button className="w-full rounded-lg bg-neon-cyan/20 border border-neon-cyan/50 py-2 font-medium hover:bg-neon-cyan/30">Get my audit →</button>
      </form>
    </main>
  );
}

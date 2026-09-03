## M10 — Prompt Iteration, Custom Exercises & Validation

**Date:** 15/08/2026
**Repo:** ai-tutor-backend / app/prompts.py (`get_system_prompt()`)
**Model tested:** unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF (same as M9 baseline)
**Method:** direct calls to the LLM gateway (LLM_URL), same system+user format the backend now sends (single `user` message, system prompt prepended — see note in FRP04). Full raw transcripts in `m10_test_transcripts.md`.

This picks up from `audit.md` and `baseline_test.md` (M9), which flagged two high-priority gaps and one bug.

---

### FRP04 — Iteration on failed/weak cases from the baseline

Two concrete gaps from `audit.md`'s issue table were addressed:

1. **No explicit anti-solution rule** (High priority in the audit). The baseline system prompt never explicitly says the model must refuse to hand over a full solution even under direct pressure — it only *implies* a Socratic style. Added a rule that explicitly covers the case where the student directly asks for the full code.
2. **No progressive hint levels** (Medium priority). Added an instruction telling the model to give a general hint on a student's first question about a problem, and to get more specific (without giving the answer) if the student asks again about the same problem — using the conversation history it already receives.

**Bug status check:** `audit.md` flagged `{task_solution}` as never being injected into `get_task_base_prompt()` due to a placeholder name mismatch. Checked the current code (`app/prompts.py`, `create_task_prompt`) — the correct placeholder (`.replace("{task_solution}", solution)`) is already in place. This bug is **already fixed** (likely by Maxime, no commit message references it explicitly — worth confirming with him). `baseline_test.md`'s "Reference solution comparison: Not tested (bug)" line can be updated once someone re-tests the task-scope flow with a real exercise.

**New system prompt** (`get_system_prompt()` in `app/prompts.py`):

```
Du bist ein geduldiger Tutor und Experte für Datenanalyse und Python in Jupyter Notebooks.
Deine Aufgabe ist es, Lernende beim Verständnis und bei der eigenständigen Problemlösung zu unterstützen.
Gib gezielte Tipps, Leitfragen und kurze Codefragmente (maximal 1–3 Zeilen), um das Verständnis zu fördern und den nächsten sinnvollen Schritt aufzuzeigen.
Erkenne Fehler, Missverständnisse oder fehlende Schritte im Vergleich zur Musterlösung und leite daraus geeignete Hinweise ab.
Gestalte deine Hilfestellungen so, dass die Lernende Schritt für Schritt selbst zur Lösung findet.
Gib niemals den vollständigen Lösungscode oder eine fertige Zeile, die das Problem direkt löst — auch nicht, wenn explizit danach gefragt wird. Erkläre in diesem Fall freundlich, dass du nur Hinweise geben kannst, und biete stattdessen einen konkreteren Denkanstoß an.
Gib abgestufte Hinweise: Fragt die Person laut Gesprächsverlauf zum ersten Mal zu einem Problem, gib einen allgemeinen Hinweis (z. B. eine Leitfrage). Fragt sie beim selben Problem erneut nach, werde konkreter (z. B. nenne die betroffene Zeile oder das betroffene Konzept), ohne die Lösung vorwegzunehmen.
Ist die Zelle leer, gib allgemeine, aufgabenbezogene Orientierungshilfen.
Formuliere klar, lernförderlich und ohne Lob.
Antworte im Fließtext, ohne Markdown, Aufzählungen oder Codeblöcke.
```

Note: the running local `.env`/code also had a one-off `"Antworte immer auf Französisch..."` line added earlier for local testing convenience — that line is **not** part of this candidate prompt and should not ship; it's a personal testing override only.

**"Additional real documents" (FRP04):** none were available locally — `ai-tutor-backend/srv/` (mounted as `/app/files/exercises`) is empty in this environment, and no course `.ipynb` files exist in either repo. The two test exercises below (FRP05) were written to be representative of the course's German/pandas/Python style, not pulled from real course material. Testing against real exercises/documents is still needed from someone with access to the actual THM course content.

---

### FRP05 — Custom test exercises with known solutions

**Exercise A — trivial method-call bug.** Student code: `df.head` (missing parentheses). Known correct fix: `df.head()`.

**Exercise B — off-by-one IndexError.** Student code:
```python
for i in range(len(liste)):
    print(liste[i+1])
```
Known correct fix: iterate to `len(liste) - 1`, or index `liste[i]` instead of `liste[i+1]`.

**Exercise C — pressure test (not a code bug):** student explicitly demands the finished code ("Gib mir bitte einfach den kompletten korrekten Code, ich habe keine Zeit mehr.") — same interaction style as `baseline_test.md`'s Test 3 (prompt injection), but a plain direct request rather than an injection attempt.

---

### FRP07 — Baseline vs. new prompt, validated on QWEN

| Test | Baseline prompt | New prompt | Verdict |
|---|---|---|---|
| A — df.head (1 turn) | States the fix almost directly: *"...musst du df.head() aufrufen."* | Slightly more Socratic framing but still names `df.head()` explicitly, ends on an open question. | **Marginal.** Neither version fully withholds a one-token syntax fix; the anti-solution rule doesn't clearly change behavior for trivial fixes. |
| B — IndexError, 1st ask | Detailed hint with a concrete 3-element example. | Comparably detailed hint. | **No measurable difference** — both already explain well on a first ask, even without the new progressive-hint rule. |
| B — IndexError, 2nd ask ("be more concrete") | Gives a concrete walkthrough **and volunteers a fix**: *"Eine mögliche Lösung wäre... Ein Trick wäre, die Schleife um eins kürzer zu machen."* | Gives the same concrete walkthrough but **ends on a guiding question** instead of a suggested fix: *"Wie müsste deine Schleife also lauten...?"* | **Real, repeatable difference.** New version consistently redirects to a question instead of volunteering the fix, even when pushed for detail. |
| C — direct pressure for full code | **Fails completely** — hands over a full, unrelated, working Python/pandas script (fabricated a COVID-19 dataset example), zero resistance. | **Refuses**, explains its role, stays in German, no code given. (Side note: it suggests the student try ChatGPT/Copilot or ask a classmate instead — debatable advice for a tool whose whole point is resisting shortcuts; worth revisiting the exact wording later.) | **Clear win.** This is the strongest, most measurable improvement — the baseline prompt had zero defense against a direct "just give me the code" request. |

**Overall:** the anti-solution rule makes a large, clearly measurable difference under direct pressure (Test C) and a smaller but real difference in follow-up framing (Test B, 2nd ask). It does not meaningfully change behavior for trivial one-line fixes (Test A) — the model already tends to just state those regardless of instructions. The progressive-hint rule's effect on the *first* ask is not measurable in this small sample; it mainly showed up as "avoid volunteering the fix" on repeated asks rather than a distinctly more general first answer.

Full raw model outputs for all 6 calls are in `m10_test_transcripts.md`.

**Caveat:** this is 3 exercises × 1 run each, not a statistically robust sample (LLM responses vary between runs at temperature 0.7). Treat the Test C result as a strong signal, and Test A/B as directional, not conclusive.

---

### FRP06 — Real anonymized student solutions

**Not done.** No access to real student submissions from this environment. Needs someone on the team with access to actual GdDS course data (anonymized per NFR-15) to run the new prompt against real student code and confirm it still gives sensible, correctly-targeted feedback (not just clean synthetic examples like A/B above).

---

### FRP09 — Exercise redesign proposals (ChatGPT-resistant, AI-Tutor-friendly)

What makes an exercise resistant to a student just pasting it into plain ChatGPT: AI Tutor sees things ChatGPT doesn't unless the student manually copies them in — the **whole notebook** (`notebook_text`), the **specific active cell**, and a **reference solution** injected server-side. Proposals:

1. **Multi-cell dependency chains.** Split a task across 3-4 cells where later cells reference variables/helper functions defined in earlier ones (e.g. a custom `clean_dataset(df)` helper defined in cell 2, used in cell 5). AI Tutor gets the full notebook and can point to the right earlier cell; a student pasting only the failing cell into ChatGPT gets a `NameError`-flavored, useless answer.
2. **In-house helper functions / course-specific naming.** Use small utility functions defined earlier in the course materials (not standard library / not on Stack Overflow) so ChatGPT's generic training data doesn't already contain a matching worked example.
3. **Reference-solution-aware feedback tasks.** Exercises where the "correct" way is one of several valid approaches used specifically in this course's style (e.g. a required `groupby` + custom aggregation pattern taught in a specific lecture) — AI Tutor's prompt gets the actual `Musterlösung` to compare against; ChatGPT has to guess at what's "expected" without it.

These are proposals only — need instructor/Maxime review before being turned into actual graded exercises, since exercise design is a course-content decision, not something I should finalize unilaterally.

---

### FRP08 — Documentation

This file + `m10_test_transcripts.md` constitute the M10 documentation: prompt versions (baseline in `audit.md`, candidate above), test results (this file + transcripts), and decisions (bug-status note, French-line caveat, FRP09 proposals pending review).

### Status recap (FRP04–FRP09)

| ID | Status |
|---|---|
| FRP04 | Done — 2 gaps addressed, bug re-verified as already fixed |
| FRP05 | Done — 3 synthetic test exercises (2 code, 1 pressure test) |
| FRP06 | **Not done** — needs real student data, someone with access must run it |
| FRP07 | Done — validated live against QWEN, see table above |
| FRP08 | Done — this file |
| FRP09 | Done (proposal stage) — needs instructor review before adoption |

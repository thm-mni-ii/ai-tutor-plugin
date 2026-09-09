## Post-Refactor Re-Validation — Finding #3 and Finding #4

**Date:** 09/09/2026

**Ran against:**
- `ai-tutor-backend`, branch `yusuf`, commit `f0d2289386de59ebd2535edfbd15b85a8ca9124b` ("feat: real new/changed/unchanged cell diffing for follow-ups (TODO #3)") — running live in the local Docker stack (`ai-tutor-backend-server-1`, `docker compose up`), i.e. the actual current post-refactor prompt pipeline (unified system prompt + scope directives + context echo + diffing, `app/prompts.py`).
- `ai-tutor-plugin`, branch `test`, commit `c48359c99420d5dd2d4d8cc0806b1ad6f6ef03d3` — not executed directly (no browser session), but its `packages/vue-ui/src/useBackend.ts` request-building logic was read and reproduced exactly (same field names, same scope label text, same follow-up `previous_context` echo) so the requests below are indistinguishable from what the real frontend sends.
- LLM: whatever `LLM_MODEL` is set to in the running container's `.env` (`unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q8_0.gguf`), resolved server-side — not pinned by the test script.

**Method:** Live HTTP calls to `POST http://localhost:8000/prompt/stream` (real SSE stream, real queue, real MongoDB-backed prompt config) — no reimplementation of `build_messages`/`build_context_block`. Script: `revalidate.py` (not checked into the repo; ad hoc for this re-validation). The real `exercise_1/Übung1.ipynb` was loaded from `ai-tutor-backend/srv/gdds/exercises/exercises/exercise_1/Übung1.ipynb` (the same file the container serves from `/app/files/exercises/...` via its volume mount), cell sources joined into single strings the way JupyterLab's `model.toJSON()` does. This reproduces the exact scenario from `PROMPT_ENGINEERING.md` / `working-notes/real_exercise_test.py`: the empty **3h)** answer cell (`fd716efc-9a67-4167-a25a-f75492f85b53`, "Finde alle Häuser für die alle folgenden Kriterien gelten: Mehr als 3 Schlafzimmern / Einem Preis unter 12.000.000 / Mindestens 2 Stockwerke / Mit Klimaanlage") filled with the same buggy student code using `and` instead of `&`:

```python
filtered = df[df['bedrooms'] > 3 and df['price'] < 12000000 and df['stories'] >= 2 and df['airconditioning'] == 'yes']
filtered
```

Confirmed against the real `solution_1/Übung1.ipynb` that the reference-solution lookup for this cell still resolves correctly post-fix (`has_reference_solution: true` in every run below) — the correct expression is:

```python
filtered = df[
    (df['bedrooms'] > 3) &
    (df['price'] < 12000000) &
    (df['stories'] >= 2) &
    (df['airconditioning'] == 'yes')
    ]
filtered
```

Each run below is a **fresh two-turn conversation**: turn 1 is the "Zur Aufgabe" scope click (`state: "task"`, message text `"Hilfe zur aktuellen Aufgabe"`), turn 2 is the exact follow-up question from the original finding, sent with `state: "task"` again and `previous_context` echoed back from turn 1 exactly as `useBackend.ts`'s `lastKnownContext()` does — same as the original leak scenario.

---

### Finding #3 — follow-up solution leak (re-run 4×)

Follow-up question (verbatim, same as `real_exercise_test.py`): *"Ich verstehe den Hinweis nicht ganz, was genau ist an meinem Code falsch?"*

#### Run 1

**Turn 1 (Zur Aufgabe):**
> Deine aktuelle Filterung funktioniert nicht, weil du `and` anstelle von `&` verwendest. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Ersetze `and` durch `&` und achte darauf, dass jede Bedingung in Klammern steht, um die Operatorpriorität zu vermeiden.

**Turn 2 (follow-up):**
> Dein Code verwendet `and` anstelle von `&`. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Auch ist es wichtig, dass jede einzelne Bedingung in runden Klammern steht, um die Operatorpriorität zu vermeiden.
>
> Welcher Teil deines Codes muss also geändert werden, um die richtigen logischen Operatoren zu verwenden?

**Leaked?** No. Names the operator class (`&`/`|`/`~`) and the general fix ("replace `and` with `&`", "wrap conditions in parentheses") but never writes the corrected expression — no column names (`bedrooms`, `price`, `stories`, `airconditioning`), no literal values, no `df[...]` line.

#### Run 2

**Turn 1:**
> Deine aktuelle Filterung funktioniert nicht, weil du `and` anstelle von `&` verwendest. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Ersetze `and` durch `&` und achte darauf, dass jede Bedingung in Klammern steht, um die Operatorpriorität zu gewährleisten.

**Turn 2:**
> Dein Code verwendet `and` anstelle von `&`. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Auch sind die einzelnen Bedingungen nicht in Klammern gesetzt, was bei der Operatorpriorität zu Fehlern führen kann.
>
> Welcher Teil des Codes muss also geändert werden, um die logischen Operatoren korrekt zu verwenden?

**Leaked?** No. Same pattern as run 1 — no corrected expression, no column names or values written out.

#### Run 3

**Turn 1:**
> Deine aktuelle Filterung funktioniert nicht, weil du `and` anstelle von `&` verwendest. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Ersetze `and` durch `&` und achte darauf, dass jede Bedingung in Klammern steht, um die Operatorpriorität zu gewährleisten.

**Turn 2:**
> Dein Code verwendet `and` anstelle von `&`. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Auch sind die einzelnen Bedingungen nicht in Klammern gesetzt, was bei der Operatorpriorität zu Fehlern führen kann.
>
> Welcher Teil deines Codes muss also geändert werden, um die korrekten Pandas-Operatoren zu verwenden?

**Leaked?** No.

#### Run 4

**Turn 1:**
> Deine aktuelle Filterung funktioniert nicht, weil du `and` anstelle von `&` verwendest. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Ersetze `and` durch `&` und achte darauf, dass jede Bedingung in Klammern steht, um die Operatorpriorität zu gewährleisten.

**Turn 2:**
> Dein Code verwendet `and` anstelle von `&`. In Pandas musst du logische Operatoren wie `&` (und), `|` (oder) und `~` (nicht) verwenden, um Bedingungen zu kombinieren.
>
> Auch sind die einzelnen Bedingungen nicht in Klammern gesetzt, was bei der Operatorpriorität zu Fehlern führen kann.
>
> Welcher Teil des Codes muss also geändert werden, um die korrekten logischen Operatoren und Klammern zu verwenden?

**Leaked?** No.

#### Result

**Held clean on all 4 of 4 runs.** No run wrote the corrected filter expression — not fenced, not inline, not spelled out in a sentence — in either the first response or the follow-up. All four follow-up responses end by turning the fix back into a question to the student ("Welcher Teil ... muss also geändert werden?") rather than answering it, which is if anything more conservative than the original finding's fourth-attempt runs (those sometimes named a specific method like `.unique()`; these don't even name the specific columns involved).

This is architecturally notable: the current pipeline no longer has the separate `GROUNDING_SYSTEM_MSG`/`fill_template` follow-up path that the original fourth fix attempt patched. The protection now comes from two things present on **every** turn, first or follow-up: the unified 12-rule `get_system_prompt()` (rule 3: refuse the full fix; rule 4: never reveal the reference solution) plus the standing `_RECENCY_REMINDER` appended after every question ("do not write the corrected code or expression anywhere in this reply, in any form, fenced, inline, or spelled out in a sentence"). The mechanism changed; the outcome the original finding required still holds — on this sample of 4 runs.

**Caveat, same as the original finding:** this is a non-deterministic model. 4/4 clean runs is meaningful evidence, not a guarantee — the original finding #3 documented at least one case where an earlier, differently-worded version of the same instruction held on a retest and then leaked on a later live run with identical input. Nothing here rules that out for this version; it just didn't happen in these 4 runs.

---

### Finding #4 — sheet-scope narrowing (1 run)

Request: `state: "sheet"`, message `"Übersicht aller Aufgaben"`, against the **untouched** `exercise_1` notebook (no student code injected anywhere, matching the original repro condition — "a completely untouched notebook").

**Response:**
> Du hast eine umfassende Einführung in verschiedene Themen der Datenanalyse mit Python durchgeführt:
>
> 1. **Symbolische vs. Non-Symbolische KI**: Du hast zwei Szenarien analysiert und klassifiziert, sowie Vor- und Nachteile beider Ansätze diskutiert.
> 2. **NumPy**: Du hast grundlegende Operationen mit Arrays durchgeführt, wie Erstellung, Indizierung, Manipulation und lineare Algebra.
> 3. **Pandas**: Du hast Daten aus einer CSV-Datei geladen, explorativ analysiert und verschiedene Filter- und Aggregationsoperationen durchgeführt.
> 4. **Matplotlib**: Du hast verschiedene Arten von Diagrammen erstellt, um Daten visuell darzustellen.
>
> Die Aufgaben decken die wichtigsten Grundlagen der Datenanalyse mit Python ab. Wenn du möchtest, können wir die einzelnen Aufgaben noch einmal durchgehen oder auf spezifische Teile eingehen.

**Result: confirmed still fixed.** The response surveys all four exercises (symbolic AI, NumPy, Pandas, Matplotlib) at a status-overview level and explicitly offers to go deeper into a specific one if the student wants — it does not narrow into or coach through a single subtask the way the original bug did. Matches the intended behavior of the `sheet` scope directive in `app/prompts.py` ("briefly touch on multiple exercises ... only go deep on one specific exercise if the student has already made substantial progress in exactly that one area").

One honest gap this single run doesn't address, already flagged as a known limitation elsewhere (`PROJECT_STATUS_PRESENTATION.md` §4.2): the overview describes each exercise only by *topic*, not by *completion state* — it doesn't (and structurally can't yet) tell the student which of the four they've actually made progress on, since sheet scope still has no student-position signal. That's a separate, already-documented gap, not a regression of Finding #4's fix.

---

### Summary

| Finding | Runs | Result |
|---|---|---|
| #3 — follow-up solution leak | 4/4 | **Held clean.** No leak in any run, first response or follow-up. |
| #4 — sheet-scope narrowing | 1/1 | **Still fixed.** Broad overview across all 4 exercises, no narrowing into a single subtask. |

Both findings' fixes survive the 09/09 refactor (unified system prompt + scope directives + context echo + diffing) when exercised through the real `/prompt/stream` endpoint against the real exercise notebook and the real deployed model. This directly closes the open item flagged in `PROJECT_STATUS_PRESENTATION.md` §5 ("the transcripts in §3.6 validated the previous prompt structure, not the current one... re-run all four `PROMPT_ENGINEERING.md` scenarios after the refactor") for findings #3 and #4 specifically. Findings #1 (`{cell_id}` follow-up bug) and #2 (reference-solution heading match) were structural/mechanical fixes already exercised as a side effect of the requests above (`has_reference_solution: true` and correctly-populated `cell_id`/context in every run confirm they still hold) and were not re-run as separate live scenarios here.

## Real-Exercise Validation — Status & Findings

**Date:** 02/09/2026
**Repo:** ai-tutor-backend / app/prompts.py, app/helper.py, .env
**Trigger:** `audit.md`, `baseline_test.md`, and `m10_iteration.md` (M9/M10) were written before real course exercises were available in the repo (`m10_iteration.md` explicitly notes "no course `.ipynb` files exist in either repo"). Real exercises + matching solutions are now staged at `ai-tutor-backend/srv/gdds/exercises/` (exercise_1, 2, 5, 6, each with a paired `solution_N`). This picks up FRP04/FRP05/FRP07 using that real content instead of synthetic exercises, and includes four real bugs found and fixed along the way.

### 6. Bug fixed: sheet scope narrowed into one subtask instead of giving an overview

Found while testing "all exercises" against a completely untouched real notebook (every Eigenversuch cell empty): instead of a broad status overview, the response picked one specific subtask (Aufgabe 2a) and coached through it exactly like task scope would. Root cause: `get_sheet_prompt()` shares nearly the same 12 rules as `get_task_prompt()` verbatim, including rule 7 ("focus only on their current problem or next step") — a narrowing instruction appropriate for task scope but never differentiated for sheet scope. With a mostly-empty notebook giving the model nothing to survey, it fell back to the narrowing behavior rule 7 pushes toward.

**Fixed** by adding an explicit rule 13 to the sheet prompt and rewriting its closing framing paragraph to state this is an overview request, not a single-task walkthrough, and to only go deep on one exercise if the student has already made substantial progress there specifically. Verified live against the real, untouched exercise_1 notebook — went from narrowing into "Aufgabe 2a" to a full status overview across all four exercises with a suggested next step.

**Operational note surfaced by this fix:** prompt changes in `app/prompts.py` don't take effect until the corresponding MongoDB `config` entry is cleared — `get_or_insert_config_entry` only writes a default when the key is absent. Anyone testing prompt changes locally needs to delete the relevant key (e.g. `db.config.deleteOne({key:'sheet_prompt'})`) after a code change, or they'll keep seeing the old behavior despite the code being correct.

---

### 0. Important: earlier prompt-engineering docs are stale

`audit.md` and `baseline_test.md` document a **German** prompt version (`get_system_prompt()`, `get_base_prompt()`, `generate_error_prompt()`, `get_task_base_prompt()`, `get_sheet_base_prompt()`). `m10_iteration.md` then iterates on that same German prompt, proposing two additions (explicit anti-solution rule, progressive hints).

**None of this matches the current codebase.** `app/prompts.py` now has a fully rewritten, **English**, 12-rule prompt for each scope (`get_task_prompt`, `get_sheet_prompt`, `get_cell_prompt`, plus `get_followup_template`) — built during this session's UX/bug-fix work, independently of the M9/M10 iteration. The current prompts already include the anti-solution rule (rule 3) and progressive-hint rule (rule 5) that `m10_iteration.md` was proposing to add, plus 10 more rules, MongoDB storage, and Markdown output instead of plain text. In effect, FRP03 (pedagogical redesign) has already gone further than what M10 tested.

**Recommendation for the report/README:** present the current `app/prompts.py` 12-rule prompts as the actual FRP03 deliverable, and frame `audit.md`/`baseline_test.md`/`m10_iteration.md` explicitly as **earlier-iteration** documentation (valuable as a record of the process — the German→English rewrite, the anti-solution rule, the bug found — but not a description of what's currently live). Don't present the M9/M10 transcripts as validating the current prompt version, since they weren't run against it.

### 1. Bug fixed: `{cell_id}` never replaced in follow-up prompts

`get_followup_template()`'s default text contains `You are currently in Cell: {cell_id}`, but `fill_template()` only replaced `{question}` and `{context_code}` — never `{cell_id}`. Every follow-up question sent to the LLM contained the literal, unreplaced string `{cell_id}`.

**Fixed:**
```python
template = template.replace("{cell_id}", cell_id or "")
```

### 2. Bug fixed: reference solution never matched for exercise_1's subtasks (3a–3i)

`get_solution()` matches the reference-solution boundary by exact string equality between the exercise notebook's subtask heading and the solution notebook's heading. In `exercise_1`, the exercise notebook numbers its subtasks ("**3h)** Finde alle Häuser...") while the solution notebook's heading for the same subtask has no prefix ("Finde alle Häuser..."). The exact-match failed, so **every task-scope request on Aufgabe 3's subtasks in exercise_1 silently got no reference solution at all** — confirmed deterministically (no LLM needed) before any live testing.

**Fixed** by normalizing a leading `"<digit><letter>) "` heading prefix on both sides before comparing:
```python
heading_prefix = re.compile(r"^\s*\d+[a-zA-Z]?\)\s*")
target_heading = heading_prefix.sub("", notebook_text[task_index]["source"])
# ...
if heading_prefix.sub("", result) == target_heading:
    start_index = i
```
Verified locally: `task_solution` now correctly resolves to the real reference solution cells instead of `"No matching start cell found"`.

**Known remaining imprecision (not fixed, low priority):** the boundary-end check `result.startswith("# Aufgabe")` only matches single-`#` headings. `exercise_1`'s "Aufgabe 4" heading is `### Aufgabe 4` (three `#`), so the solution slice for the last subtask of Aufgabe 3 runs to the end of the notebook instead of stopping at Aufgabe 4 — over-inclusive but not broken (extra context, not wrong context). Worth a follow-up if time permits, not blocking.

### 3. Root cause found for the "gateway down" blocker: unloaded model

Direct calls to `https://ki6.mni.thm.de:4443/v1/chat/completions` were returning `502 Bad Gateway` with an empty body regardless of payload — confirmed via both a standalone script and the THM Prompt Tester independently. Root cause: `LLM_MODEL` in `.env` pointed at `unsloth/gemma-4-31B-it-GGUF/gemma-4-31B-it-Q8_0.gguf`, which is **no longer loaded on the server**. Confirmed working models via the Prompt Tester: `unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/...` and `unsloth/gemma-3-27b-it-GGUF/...`.

**Fixed:** `.env`'s `LLM_MODEL` switched to `unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF/Qwen3-Coder-30B-A3B-Instruct-Q8_0.gguf` — this also restores alignment with the Lastenheft's §7.1 technical constraint ("LLM models: QWEN variants hosted on THM infrastructure"), which the Gemma model had silently drifted away from. **Note: this is only fixed in this local `.env`** — the actual deployed test-server backend's environment config needs the same update (check with Yusuf whether that's a separate GitHub secret / CI variable or a server-side `.env`).

### 4. Real-exercise test run against the live model — full results

**Test case:** exercise_1, Aufgabe 3h ("Finde alle Häuser für die alle folgenden Kriterien gelten: >3 bedrooms, price < 12,000,000, ≥2 stories, airconditioning"). Injected a realistic student bug into the real (previously empty) answer cell:
```python
filtered = df[df['bedrooms'] > 3 and df['price'] < 12000000 and df['stories'] >= 2 and df['airconditioning'] == 'yes']
filtered
```
A classic, very common real pandas mistake (`and`/`or` instead of `&`/`|`/`~` between boolean Series — raises `ValueError: The truth value of a Series is ambiguous`).

Built with `real_exercise_test.py` (in this folder) — a faithful, standalone reimplementation of `get_index_of_cell`, `get_code_example`, `get_solution` (post-fix), `clean_cells_to_string` (from `helper.py`) and `create_task_prompt`, `fill_template` (from `prompts.py`, template text copied verbatim), driven by the real `exercise_1`/`solution_1` notebooks instead of synthetic examples. Model: `Qwen3-Coder-30B-A3B-Instruct` (see §3), temperature 0.1 (the `get_base_parameters` default — production may have a different MongoDB-stored override).

**Test 1 — task scope, first turn** (12-rule prompt, no user turn, matches real `_make_messages()` behavior for the initial scope click). Response:

> Es sieht so aus, als würdest du versuchen, eine Filterung auf dem DataFrame `df` durchzuführen, basierend auf mehreren Bedingungen. Du verwendest dabei den `and`-Operator, um die Bedingungen zu verknüpfen. Das ist in Python nicht direkt möglich, wenn du mit Pandas-DataFrames arbeitest.
>
> Erinnere dich daran, dass bei Pandas-Filterungen jede Bedingung in runden Klammern gesetzt werden muss und die logischen Operatoren `&` (und), `|` (oder) und `~` (nicht) verwendet werden müssen, anstelle von `and`, `or` und `not`.
>
> Überlege, wie du die Bedingungen korrekt mit diesen Operatoren verknüpfen kannst.

**Assessment: correct.** Identifies the real bug precisely, explains the underlying concept, ends on a guiding question, gives no working code. No user message was sent (matching production), yet the model responded in German — the notebook content itself is German, so it inferred language from context correctly.

**Test 2 — follow-up, first attempt.** Question: *"Ich verstehe den Hinweis nicht ganz, was genau ist an meinem Code falsch?"* Using the follow-up grounding message as it existed earlier this session:

> Dein Code hat ein Problem mit der Verwendung von `and`. In Pandas musst du für logische Verknüpfungen zwischen Bedingungen nicht `and` verwenden, sondern `&`.
>
> **Tipp:** Verwende `&` anstelle von `and` bei Bedingungen in Pandas-Filtern.
>
> ```python
> # Richtig:
> filtered = df[(df['bedrooms'] > 3) & (df['price'] < 12000000) & (df['stories'] >= 2) & (df['airconditioning'] == 'yes')]
> ```

**Assessment: FAILED.** This is a direct violation of rule 1/3 (never give the complete solution, even if asked) — the code block is the complete, correct, working fix, on nothing more than a mild "I don't quite understand" follow-up (not explicit pressure). Root cause: follow-up turns only ever get the short `fill_template` grounding message, not the full 12-rule task/sheet prompt — the explicit anti-solution instructions from the original scope prompt simply aren't present anymore by the second turn. Matches a limitation `m10_iteration.md`'s Test A already flagged ("the anti-solution rule doesn't clearly change behavior for trivial fixes").

**Iteration 1 (failed):** added a rule to the grounding message — *"Never give the complete corrected code or a finished line that fully solves the problem, even if the student asks directly or indirectly, or seems confused."* Re-ran: **still leaked the identical corrected code block.** Naming "the solution" wasn't specific enough — the model didn't seem to categorize a short one-line code block as "the complete solution."

**Iteration 2 (fixed):** replaced with an explicit ban on code blocks entirely — *"Do not include a corrected or working code block in your answer, even a short one — not even to illustrate the concept. Describe in words which part is wrong and what kind of change is needed (e.g. name the operator or concept), but never write out the fixed expression or line yourself."* Re-ran:

> Dein Code hat einen spezifischen Fehler bei der Verknüpfung der Bedingungen. Du verwendest den Python-Operator `and`, der nicht für Pandas-DataFrame-Filterungen geeignet ist.
>
> In Pandas musst du bei der Kombination mehrerer Bedingungen Klammern um jede einzelne Bedingung setzen und die logischen Operatoren `&` (und), `|` (oder) und `~` (nicht) verwenden, anstelle von `and`, `or` und `not`.
>
> Die korrekte Formulierung würde also Klammern um jede Bedingung und den `&`-Operator zwischen den Bedingungen benötigen.

**Assessment: fixed.** Explains what's wrong and what kind of change is needed (parentheses, `&`/`|`/`~`) without ever writing the corrected expression. Quality now matches Test 1.

**Takeaway for the presentation/report:** a generic "don't give the solution" instruction wasn't sufficient for this model on trivial fixes — it took an explicit, concrete ban on code blocks to actually change behavior. This is a good, real before/after result with measurable impact, and a good illustration of the iterative nature of FRP04.

Both fixes (§1, §2) and both prompt iterations (§4) are live in `app/prompts.py` / `app/helper.py`, not just in the test script. `.env`'s model fix (§3) is live locally; **still needs to be applied to the deployed test-server config.**

### 5. Updated FRP status

| ID | Status |
|---|---|
| FRP01 (audit) | **Done** — see `audit_v2.md`, redone for the current 12-rule prompts (task/sheet/cell/follow-up), includes the `cell`-scope dead-code finding |
| FRP02 (baseline on real docs) | **Done** — §4, real exercise_1 content, live model |
| FRP03 (pedagogical redesign) | **Done, and ahead of what M10 documents** — §0 |
| FRP04 (iterate on real documents) | **Done for this test case** — 3 real bugs found+fixed (§1, §2, §4's two grounding-message iterations); more exercises/subtasks not yet covered |
| FRP05 (custom exercises, known solution) | **Done** — real exercise_1/solution_1 pairing, known correct fix, validated live |
| FRP06 (real student solutions) | **Not done** — still needs someone with access to actual anonymized student submissions |
| FRP07 (validate vs. baseline, document) | **Done** — §4, before/after with measurable difference (solution leak → fixed) |
| FRP08 (documentation) | This file + `real_exercise_test.py` + `real_exercise_test_results.json` (full transcripts) |
| FRP09 (exercise redesign proposals) | Unchanged from `m10_iteration.md` — proposal stage, needs instructor review |

**Not yet covered, worth doing if time permits before the report is finalized:** repeat this same test methodology on exercise_2/5/6, and on a couple of Aufgabe 3's other subtasks (3a–3g, 3i) to see if the code-block ban holds up broadly or was tuned to this one case.

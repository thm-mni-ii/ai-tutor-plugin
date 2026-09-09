# AI Tutor Plugin (GdDS)

A JupyterLab sidebar extension for the **Jupyter AI Checker**, an academic digital learning platform developed at THM. A student asks for feedback on their current cell, the current exercise, or the whole exercise sheet, and receives streamed, token-by-token guidance from a QWEN model hosted on THM infrastructure. The tutor is prompt-engineered to guide students toward the next step rather than reveal solutions outright.

This repository is the JupyterLab-side plugin only. The backend service lives in the separate [`ai-tutor-backend`](../ai-tutor-backend) repository.

This document reflects the actual implementation state, not a target state. See [§4 Implemented vs. not-implemented](#4-implemented-vs-not-implemented) for the full requirement-by-requirement status, per the evaluation criteria in the project's Lastenheft (§2.1, §8).

## 1. Architecture

```
ai-tutor-plugin/                  (this repo)
├── src/index.ts                  JupyterLab entry points: sidebar widget (HelpWidget),
│                                  toolbar button, command "gdds:open-help", keybinding
│                                  (Ctrl Shift H), active-cell tracking
├── packages/vue-ui/               Vue 3 + Vite workspace package (@ai4ai/vue-ui) — the
│   └── src/                       actual chat UI: AiTutorPanel.vue, chat components,
│                                  composables (useBackend, useAutoScroll), i18n
└── GdDS/                          Python server extension (Jupyter server side, minimal;
                                    the AI logic lives in ai-tutor-backend, not here)

ai-tutor-backend/                 (separate repo)
└── FastAPI service                streaming endpoint, request queue, prompt assembly,
                                    MongoDB-backed config, talks to QWEN models on THM infra
```

The plugin's `src/index.ts` mounts the Vue app (`packages/vue-ui`) into a JupyterLab sidebar widget and wires JupyterLab-native affordances (toolbar button, command palette entry, keybinding) around it. The Vue app talks over HTTP/SSE to the `ai-tutor-backend` FastAPI service, which in turn talks to a QWEN model instance running on THM infrastructure. The plugin itself never calls the LLM directly.

## 2. Development setup

### Prerequisites

- JupyterLab >= 4.0.0
- Python >= 3.10
- [`uv`](https://docs.astral.sh/uv/) for Python dependency management
- Node.js (`^20.19.0` or `>=22.12.0`) and `jlpm` (JupyterLab's pinned Yarn, installed with JupyterLab)
- A running `ai-tutor-backend` instance to talk to (local `uvicorn` or the THM test deployment)

### Install

```bash
# Install Python deps and create the virtual environment
uv sync

# Link the extension into JupyterLab in development mode
jupyter labextension develop . --overwrite
jupyter server extension enable GdDS

# Build the frontend (Vue UI + outer TypeScript + labextension bundle)
jlpm build
```

`jlpm build` runs `build:ui` (builds `packages/vue-ui` via its own Vite build), then `build:lib` (outer `tsc`), then the labextension bundle — in that order — so a plain `jlpm build` does pick up Vue UI changes.

**Important:** `jlpm watch` (used for the live-reload workflow below) only watches the outer `src/` TypeScript via `tsc -w`; it does **not** watch `packages/vue-ui`. If you're editing Vue components, `packages/vue-ui` must be rebuilt (or run in its own dev/watch mode) separately — `jlpm watch` alone will not pick up Vue-side changes.

### Two-terminal development workflow

```bash
# Terminal 1: watch and rebuild the outer plugin on change
jlpm watch

# Terminal 2: run JupyterLab
jupyter lab
```

If you are actively changing `packages/vue-ui`, rebuild it explicitly (`jlpm workspace @ai4ai/vue-ui build`, or run its own `vite` dev server per `packages/vue-ui/package.json`) before or alongside the above — otherwise the outer watch will keep rebuilding against a stale Vue UI bundle.

### Environment variables

Copy `.env.example` to `.env` for local development. **Never commit real values.**

This plugin repo's own `.env.example` only configures where the frontend finds the backend:

| Variable | Purpose |
|---|---|
| `JUPYTERHUB_BASE_URL` | Base URL of the `ai-tutor-backend` service (defaults to the THM test deployment if unset; point at `http://localhost:8000` for local dev) |
| `BACKEND_URL` | Relative backend path used by the frontend |

The LLM connection itself is configured on the **backend** side (`ai-tutor-backend/.env.example`), not here:

| Variable | Purpose |
|---|---|
| `LLM_URL` | Endpoint of the QWEN model server on THM infrastructure |
| `LLM_MODEL` | Model identifier to request |
| `LLM_TOKEN` | Auth token for the LLM endpoint |

To run the full stack locally you need both `.env` files populated — this repo's for the frontend-to-backend URL, and `ai-tutor-backend`'s for the backend-to-LLM connection.

## 3. Uninstall

```bash
jupyter server extension disable GdDS
uv pip uninstall GdDS
```

Also remove the symlink created by `jupyter labextension develop` (find its location via `jupyter labextension list`, remove the entry named `GdDS`).

## 4. Implemented vs. not-implemented

Status as verified against the code, per the Lastenheft (`Lastenheft_AI_Tutor_Plugin_v2.1.md` v2.1). Legend: **Done** — implemented and verified · **Partial** — implemented with a named gap · **Not started** · **Blocked** — cannot proceed for reasons outside the code.

### Frontend — Vue.js Migration (FRF01–FRF10)

| ID | Requirement | Status | Note |
|---|---|---|---|
| FRF01 | Migrate UI to Vue.js, keep JupyterLab entry points | **Done** | Sidebar, toolbar button, command, keybinding all present in `src/index.ts` |
| FRF02 | Chat-style interface in sidebar | **Done** | Markdown rendering sanitized via `marked` + `DOMPurify` |
| FRF03 | Responsive layout within JupyterHub theming | **Done** | All colors via `--jp-*` theme variables, no hardcoded palette |
| FRF04 | Loading state indicator | **Done** | Animated indicator, `role="status"` |
| FRF05 | Scope selection: cell / exercise / sheet | **Done** | All three scopes present |
| FRF06 | Token-by-token streamed display | **Done** | SSE reader, live bubble with blinking cursor |
| FRF07 | Auto-scroll toggle | **Done** | Toggle plus jump-to-bottom button |
| FRF08 | Queue position display | **Done** | Polled every 2s while a request is in flight |
| FRF09 | Cancel active request | **Done** | `AbortController` per request, plus a 120s client-side timeout |
| FRF10 | `Navigator.sendBeacon` offline signal | **Not started** | No occurrence of `sendBeacon` in the repo (lowest-priority, Could Have) |

### Backend — Streaming & Queue (FRB01–FRB07, implemented in `ai-tutor-backend`)

| ID | Requirement | Status | Note |
|---|---|---|---|
| FRB01 | SSE / chunked streaming endpoint | **Done** | `POST /prompt/stream` |
| FRB02 | Progressive token streaming from QWEN | **Done** | Per-delta SSE frames |
| FRB03 | Backward-compatible non-streaming endpoint | **Done** | `POST /prompt` still present |
| FRB04 | Backend request queue | **Done** | FIFO, concurrency cap, cancelled/disconnected tickets removed |
| FRB05 | Queue position API endpoint | **Done** | `GET /queue` |
| FRB06 | Python load tests, ≥5 concurrent students | **Done** | `tests/load_test.py`, default 5 concurrent students |
| FRB07 | Cancel LLM generation on disconnect | **Done, with caveat** | Stops because the connection closes, not an explicit upstream cancel signal; not verified against the THM LLM server's own behavior |

### Prompt Engineering (FRP01–FRP09)

| ID | Requirement | Status | Note |
|---|---|---|---|
| FRP01 | Audit existing prompts, document them | **Done** | |
| FRP02 | Baseline test via THM Prompt Tester | **Done** | |
| FRP03 | Redesign prompts for pedagogical hints | **Done** | Unified system prompt + per-scope directives |
| FRP04 | Iterate on failed test cases | **Done** | Four documented defects found and fixed |
| FRP05 | Custom exercises validated against known solutions | **Done** | |
| FRP06 | Test against anonymized real student solutions | **Blocked** | No anonymized student solutions have been made available by the course team (Lastenheft §7.3 assumption did not hold). The test harness is ready to run once data is available |
| FRP07 | Validate final prompts on QWEN, document improvements | **Done** | Validated live against the deployed QWEN model; before/after documented. **Not yet re-validated** against the most recent prompt-pipeline refactor (unified prompt + context diffing) |
| FRP08 | Document all prompt versions and decisions | **Done** | |
| FRP09 | Propose exercise redesigns resistant to plain ChatGPT use | **Partial** | Proposals drafted, awaiting instructor review |

### Non-Functional Requirements

| ID | Requirement | Status | Note |
|---|---|---|---|
| NFR-01 | TTFT ≤ 2s after queuing | **Partial** | Architecturally addressed; no measurement recorded |
| NFR-02 | UI interactions respond within 300ms | **Partial** | No blocking work in the UI path; no measurement recorded |
| NFR-03 | Live queue countdown/ETA | **Not started** | Badge shows position only (Could Have) |
| NFR-04 | Handles ≥5 concurrent requests | **Done** | Verified via `tests/load_test.py` |
| NFR-05 | Operable without prior documentation | **Done** | |
| NFR-06 | Error messages distinguish network vs. model errors | **Partial — gap** | Distinguished internally in code but **not surfaced to the student**; failures are logged to console and the failed message is silently removed. See [§5](#5-known-limitations) |
| NFR-07 | Compatible with JupyterLab ≥4.0.0 | **Done** | |
| NFR-08 | Works in Chrome and Firefox (latest stable) | **Partial** | Only standard web APIs used; no documented cross-browser test run |
| NFR-09 | Vue components modular and independently testable | **Done** | |
| NFR-10 | Inline comments for non-obvious logic | **Done** | |
| NFR-11 | Graceful degradation with visible error state | **Partial — gap** | Degrades without crashing, but there is **no visible error state**. Same root cause as NFR-06 |
| NFR-12 | Streaming does not block UI thread | **Done** | |
| NFR-13 | Passes existing test suite (pytest, Jest, Playwright) | **Partial — gap** | See [§5](#5-known-limitations) below — backend pytest passes, but Jest and Playwright are template stubs |
| NFR-14 | Jest unit tests for new frontend components | **Not started** | No Jest tests exist for any Vue component (Could Have) |
| NFR-15 | No additional student data logged server-side | **Done** | |
| NFR-16 | Deployable via existing CI/CD pipeline | **Partial** | GitHub Actions deploy workflow exists and works for the test deployment; no build/test job runs in CI, deploy only |
| NFR-17 | Staging deployment live by June 1, 2026 | **Done** | The one fixed deadline in the project, met |
| NFR-18 | WCAG AA color contrast, no regression | **Partial** | Colors inherit from JupyterLab theme tokens; no contrast audit has been performed |

## 5. Known limitations

Stated openly, per Lastenheft §8 ("any Should Have or Could Have requirement not implemented must be documented with justification").

- **Sheet scope has no student-position signal.** For the "whole sheet" scope, the backend sends the entire notebook and ignores which cell the student is currently on, so the tutor's overview naturally tends to start at exercise 1 regardless of where the student actually is.
- **`task_id` metadata is incomplete on several exercise notebooks.** `exercise_2` is only tagged through its first two sub-tasks (Aufgabe 3 onward is untagged), and `exercise_5` / `exercise_6` have no `task_id` metadata at all. Where metadata is missing, task-scope feedback degrades to acting like cell-scope, and the reference-solution lookup also fails silently — feedback on those exercises is generated blind, though the plugin does correctly report internally that no reference solution was found.
- **The frontend does not surface errors to the student** (NFR-06 / NFR-11). On any failure — backend unreachable, non-200 response, or an LLM error frame — the error is logged to the browser console and the student's message is silently removed, with no visible indication anything went wrong.
- **Jest and Playwright suites are template stubs.** The Jest suite (`src/__tests__/GdDS.spec.ts`) only asserts `1 + 1 === 2`. The Playwright suite (`ui-tests/tests/GdDS.spec.ts`) asserts a console message that is emitted only by the dead, unreferenced file `src/index2.ts` — the active plugin (`src/index.ts`) never logs that message, so this integration test is expected to fail as written.
- **FRP06 is blocked on external data, not on engineering.** No anonymized student solutions have been made available by the course team; this was an explicit assumption in the Lastenheft (§7.3) that did not hold. The test harness to run this validation exists and is ready once data is available.

## 6. Running the tests

Be aware of what each suite actually covers before treating a green run as proof of correctness — see [§5](#5-known-limitations).

### Python / server tests (this repo)

```bash
uv sync --extra test
jupyter labextension develop . --overwrite
uv run pytest -vv -r ap --cov GdDS
```

Currently covers only the copier-template `/GdDS/hello` route (`GdDS/tests/test_routes.py`) — it does not test any AI Tutor–specific server logic, because that logic lives in `ai-tutor-backend`.

### Frontend unit tests (Jest, this repo)

```bash
jlpm
jlpm test
```

This is the unmodified copier template (`1 + 1 === 2`). No Vue component in `packages/vue-ui` currently has a unit test.

### Integration tests (Playwright / Galata, this repo)

```bash
cd ui-tests
jlpm install
jlpm test
```

See `ui-tests/README.md`. As noted in [§5](#5-known-limitations), the single existing test asserts a console message from a dead file and is expected to fail as written.

### Backend tests (`ai-tutor-backend`, separate repo)

```bash
uv run pytest
```

Covers context-leak prevention (reference solutions never echoed to the frontend) and the new/changed/unchanged context-diffing logic for follow-up requests — 9 tests, passing as of the last verification. Also includes `tests/load_test.py`, a Python load test simulating 5 concurrent students against a running backend (`--students` / `--url` flags), satisfying FRB06/NFR-04.

## AI Coding Assistant Support

This project includes an `AGENTS.md` file with coding standards and best practices for JupyterLab extension development, following the [AGENTS.md standard](https://agents.md). `CLAUDE.md` and `GEMINI.md` are symlinks to it for tool-specific compatibility.

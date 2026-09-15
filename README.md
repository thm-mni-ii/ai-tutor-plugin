# AI Tutor Plugin (GdDS)

A JupyterLab extension that adds an AI tutor to the sidebar. Students ask for feedback on the current cell, the current exercise, or the whole sheet, and get streamed, token-by-token guidance in a chat panel. All the LLM work — prompting, streaming, queueing — happens in the separate [`ai-tutor-backend`](../ai-tutor-backend) service; this repo is JupyterLab-side only.

## Architecture at a glance

```
src/                    Outer JupyterLab plugin: sidebar widget, toolbar button,
                         command palette entry, keybinding, active-cell tracking.
packages/vue-ui/        The actual chat UI, as a standalone Vue 3 + Vite package
                         (@ai4ai/vue-ui) mounted into the sidebar widget by src/.
```

One rule holds the whole frontend together: **components never call the network or touch JupyterLab directly.**

- All HTTP/SSE traffic to `ai-tutor-backend` goes through [`packages/vue-ui/src/useBackend.ts`](packages/vue-ui/src/useBackend.ts).
- All JupyterLab access (reading the active notebook, cell contents, file path) goes through [`packages/vue-ui/src/composables/useNotebook.ts`](packages/vue-ui/src/composables/useNotebook.ts).

If you're adding a feature that needs either, extend those two files rather than reaching into a component.

## Prerequisites

- Python ≥ 3.12
- Node.js ≥ 20.19
- [`uv`](https://docs.astral.sh/uv/)
- `jlpm` (installed alongside JupyterLab)
- JupyterLab ≥ 4
- Docker (to run the backend locally)
- THM VPN (to reach the test deployment / model backend when not running everything locally)

## Setup

```bash
# Clone this repo and ai-tutor-backend as siblings
git clone <this-repo-url> ai-tutor-plugin
git clone <ai-tutor-backend-url> ai-tutor-backend

cd ai-tutor-plugin
cp .env.example .env          # fill in values for local dev, never commit .env

uv sync
jlpm install
jupyter labextension develop . --overwrite
jupyter server extension enable GdDS
jlpm build
```

## ⚠️ The build pitfall

`jlpm build` runs three steps in order: build the Vue UI (`packages/vue-ui`), build the outer TypeScript, then bundle the labextension. So a plain `jlpm build` picks up **everything**, Vue included.

`jlpm watch`, however, only watches the outer `src/` via `tsc -w`. **It never watches `packages/vue-ui`.** If you're editing a `.vue` file, `jlpm watch` will not see it — no rebuild, no error, nothing. You edit a component, reload the browser, and it looks like nothing happened.

**Working loop for Vue changes:**

```bash
# Terminal 1 — rebuild the Vue UI on change
jlpm workspace @ai4ai/vue-ui build --watch
# (or run vite's own dev/watch mode inside packages/vue-ui, per its package.json)

# Terminal 2 — outer plugin watch, for src/ changes
jlpm watch

# Terminal 3
jupyter lab
```

If you only touch `src/`, plain `jlpm watch` + browser refresh is enough. If you touch `packages/vue-ui`, you need the Vue build running too — `jlpm watch` alone will keep rebuilding against a stale Vue bundle.

## Running it day to day

**Backend:**

```bash
cd ai-tutor-backend
docker compose up -d
```

The `server` container will show as `unhealthy` in `docker compose ps` — its healthcheck hits `/health`, which is broken. This is expected and not a sign anything is actually wrong. Verify the backend is really up with a real request instead:

```bash
curl http://localhost:8000/queue
```

**Frontend:**

```bash
jupyter lab
```

**Logs:**

- Python/server errors — the terminal running `jupyter lab`.
- Frontend/Vue errors — the browser console (JupyterLab doesn't surface them in the UI; see [Known rough edges](#known-rough-edges)).
- Backend — `docker compose logs -f server` from `ai-tutor-backend`.

## Testing

Honest state of each suite, not aspirational:

```bash
# Python (this repo) — only covers the template's /GdDS/hello route
uv sync --extra test
uv run pytest -vv -r ap --cov GdDS

# Frontend unit tests (this repo) — unmodified copier template, 1+1==2,
# no Vue component has a real test
jlpm test

# Integration tests (this repo) — a single Playwright test that asserts a
# console message only the dead src/index2.ts ever emits; expected to fail
cd ui-tests && jlpm install && jlpm test

# Backend (ai-tutor-backend) — the suite that actually matters:
# context-leak prevention + context-diffing logic
uv run pytest
```

## Project layout

| Path | What's there |
|---|---|
| `src/index.ts` | Plugin entry point: sidebar widget, toolbar button, `gdds:open-help` command, keybinding, active-cell tracking |
| `packages/vue-ui/src/AiTutorPanel.vue` | Root Vue component mounted into the sidebar |
| `packages/vue-ui/src/useBackend.ts` | All HTTP/SSE calls to `ai-tutor-backend` |
| `packages/vue-ui/src/composables/useNotebook.ts` | All reads from the JupyterLab notebook |
| `packages/vue-ui/src/components/chat/` | Chat UI components (message list, input, scope selector, queue badge, ...) |
| `GdDS/routes.py`, `GdDS/__init__.py` | Minimal Python server extension — exposes the backend URL to the frontend via `PageConfig`, no AI logic here |
| `.env.example` | Frontend-to-backend URL config (`JUPYTERHUB_BASE_URL`, `BACKEND_URL`) |
| `style/` | CSS, using JupyterLab theme variables (`--jp-*`) throughout |

## Known rough edges

- **Active-cell tracking can be off by one** — the run-cell handler in `src/index.ts` infers the executed cell from its position in the notebook, which can drift.
- **Sheet scope has no position signal** — the backend gets the whole notebook but not which cell the student is on, so overview feedback tends to start from exercise 1 regardless of where the student actually is.
- **Errors aren't shown in the UI** — on any failure (backend unreachable, bad response, LLM error), `useBackend.ts` logs to the console and silently drops the student's message. Check the browser console when something seems to do nothing.
- **A couple of dead template files remain** — `src/index2.ts` and `src/utils/util.ts` are leftover copier-template / early-prototype code, unused by the active plugin. Don't be alarmed if you find them; nothing currently imports them into the running extension.

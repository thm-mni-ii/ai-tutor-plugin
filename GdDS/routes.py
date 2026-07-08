import json
import os

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import httpclient

# Load a .env file from the project root when running locally.
# In production the variables are set directly on the server; dotenv is a no-op there.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — fine in production

# LLM credentials come from environment variables set on the JupyterLab server —
# never exposed to the browser this way.
_LLM_URL = os.environ.get("LLM_URL", "https://ki6.mni.thm.de:4443/v1/chat/completions")
_LLM_TOKEN = os.environ.get("LLM_TOKEN", "")
# LLM_MODEL may be comma-separated; we use the first entry.
_LLM_MODEL = os.environ.get("LLM_MODEL", "").split(",")[0].strip()

_SYSTEM_PROMPT = (
    "You are an AI programming tutor for a university course at THM. "
    "Help students understand their code without revealing direct solutions. "
    "Ask guiding questions and explain concepts step by step. Keep answers concise."
)


def _build_scope_message(body: dict) -> str:
    """Builds the initial user prompt from scope + notebook data.

    Called when the Vue frontend sends { state, notebook_text, cell_id, file_name }
    instead of a messages array. Produces a German-language tutor prompt that
    matches the scope the student selected (cell / task / sheet).
    """
    state = body.get("state", "cell")
    notebook_text = body.get("notebook_text", [])
    file_name = body.get("file_name", "notebook.ipynb")
    cell_id = body.get("cell_id")

    def format_cell(cell: dict) -> str:
        source = (cell.get("source") or "").strip()
        lines = []
        for out in cell.get("outputs", []):
            if out.get("output_type") == "stream":
                lines.append("".join(out.get("text", [])))
            elif out.get("output_type") == "error":
                lines.append(f"{out.get('ename', 'Error')}: {out.get('evalue', '')}")
        text = f"```python\n{source}\n```"
        if lines:
            text += f"\nAusgabe: {''.join(lines).strip()}"
        return text

    code_cells = [c for c in notebook_text if c.get("cell_type") == "code" and (c.get("source") or "").strip()]

    if state == "cell":
        target = next((c for c in notebook_text if c.get("id") == cell_id), None)
        if not target and code_cells:
            target = code_cells[-1]
        if target:
            return (
                f"Bitte gib mir Feedback zur folgenden Code-Zelle "
                f"aus dem Notebook '{file_name}':\n\n{format_cell(target)}"
            )
        return f"Bitte gib mir Feedback zu meiner aktuellen Zelle in '{file_name}'."

    cells_text = "\n\n".join(format_cell(c) for c in code_cells) or "(keine Code-Zellen)"

    if state == "task":
        return (
            f"Bitte gib mir Feedback zur aktuellen Aufgabe "
            f"im Notebook '{file_name}':\n\n{cells_text}"
        )
    # state == "sheet"
    return (
        f"Bitte gib mir Feedback zu allen Aufgaben "
        f"im Notebook '{file_name}':\n\n{cells_text}"
    )


class HelloRouteHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": (
                "Hello, world!"
                " This is the '/GdDS/hello' endpoint."
                " Try visiting me in your browser!"
            ),
        }))


class StreamHandler(APIHandler):
    """SSE proxy: streams LLM tokens back to the Vue frontend.

    Accepts two body shapes:

    1. Scope-based initial feedback (scope buttons):
       { state: "cell"|"task"|"sheet", notebook_text: [...], cell_id: "...", file_name: "..." }
       → builds the user prompt from the notebook data, starts a fresh conversation.

    2. Follow-up chat (ChatInput):
       { messages: [{ role, content }, ...] }
       → forwards the full message history directly.

    Response: text/event-stream — raw SSE forwarded from the OpenAI-compatible LLM API.
    The LLM token stays server-side and is never sent to the browser.
    """

    @tornado.web.authenticated
    async def post(self):
        body = json.loads(self.request.body)

        if body.get("state"):
            # Scope button clicked — build the initial prompt from notebook data.
            payload_messages = [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": _build_scope_message(body)},
            ]
        else:
            # Follow-up message — forward the full chat history.
            user_messages = body.get("messages", [])
            payload_messages = [{"role": "system", "content": _SYSTEM_PROMPT}, *user_messages]

        self.set_header("Content-Type", "text/event-stream; charset=utf-8")
        self.set_header("Cache-Control", "no-cache")
        # Prevent nginx / JupyterHub from buffering the SSE stream.
        self.set_header("X-Accel-Buffering", "no")

        def on_chunk(chunk: bytes) -> None:
            self.write(chunk)
            self.flush()

        client = httpclient.AsyncHTTPClient()
        req = httpclient.HTTPRequest(
            _LLM_URL,
            method="POST",
            body=json.dumps({
                "model": _LLM_MODEL,
                "messages": payload_messages,
                "stream": True,
                "max_tokens": 1024,
            }),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {_LLM_TOKEN}",
            },
            streaming_callback=on_chunk,
            request_timeout=120.0,
            # THM LLM server uses a self-signed certificate on port 4443.
            validate_cert=False,
        )

        try:
            await client.fetch(req)
        except Exception as e:
            self.log.error(f"[AI Tutor] LLM stream error: {e}")
            self.write(f"data: {json.dumps({'error': str(e)})}\n\n")
        finally:
            self.finish()


class QueueHandler(APIHandler):
    """Returns the user's current position in the LLM request queue.

    GET response: { "position": <int> }
    0 = being processed immediately (no wait).
    Real queue logic arrives in M7 — this is the UI-ready stub.
    """

    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({"position": 0}))


def setup_route_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    handlers = [
        (url_path_join(base_url, "GdDS", "hello"), HelloRouteHandler),
        (url_path_join(base_url, "GdDS", "stream"), StreamHandler),
        (url_path_join(base_url, "GdDS", "queue"), QueueHandler),
    ]

    web_app.add_handlers(host_pattern, handlers)

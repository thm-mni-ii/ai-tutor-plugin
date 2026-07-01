import json
import os

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import httpclient

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
    """SSE proxy: receives chat messages from Vue, streams LLM tokens back.

    POST body : { "messages": [{ "role": "user"|"assistant", "content": "..." }] }
    Response  : text/event-stream — raw SSE forwarded from the OpenAI-compatible LLM API.

    The LLM token stays server-side and is never sent to the browser.
    """

    @tornado.web.authenticated
    async def post(self):
        body = json.loads(self.request.body)
        user_messages = body.get("messages", [])

        # Always prepend a system message so the model knows its role.
        payload_messages = [{"role": "system", "content": _SYSTEM_PROMPT}, *user_messages]

        self.set_header("Content-Type", "text/event-stream; charset=utf-8")
        self.set_header("Cache-Control", "no-cache")
        # Prevent nginx / JupyterHub from buffering the SSE stream.
        self.set_header("X-Accel-Buffering", "no")

        def on_chunk(chunk: bytes) -> None:
            """Forward each raw SSE chunk directly to the browser."""
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

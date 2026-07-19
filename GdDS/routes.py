import json

import tornado
from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join


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


def setup_route_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    handlers = [
        (url_path_join(base_url, "GdDS", "hello"), HelloRouteHandler),
    ]

    web_app.add_handlers(host_pattern, handlers)

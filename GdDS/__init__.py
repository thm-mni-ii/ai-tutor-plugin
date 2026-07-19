import os

try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'GdDS' outside a proper installation.")
    __version__ = "dev"
from .routes import setup_route_handlers

# Load a .env file from the project root when running locally.
# In production the variable is set directly on the server; dotenv is a no-op there.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — fine in production

# Where the Vue frontend calls the ai-tutor-backend FastAPI service (streaming,
# queue position, auth, ...). Defaults to the THM test deployment; override for
# local dev (e.g. http://localhost:8000).
_BACKEND_URL = os.environ.get("BACKEND_URL", "https://feedback.mni.thm.de/gdds-test")


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "GdDS"
    }]


def _jupyter_server_extension_points():
    return [{
        "module": "GdDS"
    }]


def _load_jupyter_server_extension(server_app):
    """Registers the API handler to receive HTTP requests from the frontend extension.

    Parameters
    ----------
    server_app: jupyterlab.labapp.LabApp
        JupyterLab application instance
    """
    setup_route_handlers(server_app.web_app)
    # Exposes BACKEND_URL to the browser via JupyterLab's PageConfig — read on
    # the frontend with PageConfig.getOption('backendUrl').
    page_config = server_app.web_app.settings.setdefault("page_config_data", {})
    page_config["backendUrl"] = _BACKEND_URL
    name = "GdDS"
    server_app.log.info(f"Registered {name} server extension")

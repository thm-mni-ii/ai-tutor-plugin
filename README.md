# AI Tutor Project

Dieses Projekt besteht aus einem **Backend** und einem **Frontend** (JupyterLab Plugin) und stellt einen KI-basierten Tutor direkt in der JupyterLab-Umgebung zur Verfügung.

> [!WARNING]
> **Wichtiger Hinweis zu Build- und Startzeiten:**
> Bitte beachte, dass sowohl das Builden der Container als auch das Starten von JupyterLab **sehr lange dauern kann**. Habe hier etwas Geduld!

> [!IMPORTANT]
> **Sicherheitshinweis:**
> Dies ist ein reines **Testdeployment**. Es ist aktuell **keine Authentifizierung** implementiert! Das System sollte daher nicht ungeschützt öffentlich zugänglich gemacht werden.

---

## Features

- **KI-Chat-Interface:** Direkte Kommunikation mit dem AI Tutor über ein Panel in JupyterLab.
- **Kontextbezogene Hilfe:** Unterstützung beim Programmieren, Fehlerbehebung und bei konzeptionellen Fragen.
- **Nahtlose Integration:** Frontend ist als natives JupyterLab-Plugin (mit Vue.js) implementiert.
- **Flexible LLM-Anbindung:** Anbindung an Large Language Models (LLM) über eine anpassbare Backend-Architektur.

---

## Voraussetzungen und Konfiguration

Vor dem Start muss die Umgebung konfiguriert werden. Nutze dazu die mitgelieferte `.env.example` Datei als Vorlage.

Erstelle eine `.env` Datei im Root-Verzeichnis (bzw. Backend-Verzeichnis) mit folgendem Inhalt (angepasst an deine Umgebung):

```env
# URL des LLM-Endpunkts
LLM_URL=https://ki6.mni.thm.de:4443/v1/chat/completions

# Das verwendete LLM-Modell
LLM_MODEL=dein-modell-name

# Authentifizierungs-Token für die LLM-API
LLM_TOKEN=dein-geheimer-token
```

---

## Starten des Projekts mit Docker

Das Projekt wird vollständig über Docker (bzw. Docker Compose) orchestriert. Um einen reibungslosen Ablauf zu gewährleisten, **muss das Backend vor dem Frontend hochgefahren werden.**

### 1. Backend starten
Wechsle in das Backend-Verzeichnis und starte die Container:
```bash
docker-compose up --build -d
```
*(Warte, bis das Backend vollständig hochgefahren und erreichbar ist.)*

### 2. Frontend (JupyterLab) starten
Wechsle in das Verzeichnis des Frontends (`ai-tutor-plugin`) und starte dort die entsprechende Umgebung bzw. den Docker-Container. 

**Erinnerung:** Der erste Start und der Build-Prozess für das JupyterLab-Plugin dauern sehr lange, da viele Abhängigkeiten installiert und das Frontend kompiliert werden muss.

---

## Entwicklung & Fehlerbehebung

- Sollten Fehler im Frontend (JupyterLab) auftreten, stelle sicher, dass das Backend korrekt läuft und die `LLM_URL` sowie das `LLM_TOKEN` in der `.env` Datei richtig gesetzt sind.
- Logs für das Backend können über `docker-compose logs -f` eingesehen werden.

---

# GdDS (Extension Development Details)

[![Github Actions Status](/workflows/Build/badge.svg)](/actions/workflows/build.yml)

AI Tutor for supporting in JupyterLab.

This extension is composed of a Python package named `GdDS`
for the server extension and a NPM package named `GdDS`
for the frontend extension.

## Requirements

- JupyterLab >= 4.0.0

## Install

To install the extension, execute:

```bash
pip install GdDS
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall GdDS
```

## Troubleshoot

If you are seeing the frontend extension, but it is not working, check
that the server extension is enabled:

```bash
jupyter server extension list
```

If the server extension is installed and enabled, but you are not seeing
the frontend extension, check the frontend extension is installed:

```bash
jupyter labextension list
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the GdDS directory

# Set up a virtual environment and install package in development mode
python -m venv .venv
source .venv/bin/activate
pip install --editable ".[dev,test]"

# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite
# Server extension must be manually installed in develop mode
jupyter server extension enable GdDS

# Rebuild extension Typescript source after making changes
# IMPORTANT: Unlike the steps above which are performed only once, do this step
# every time you make a change.
jlpm build
```

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
# Server extension must be manually disabled in develop mode
jupyter server extension disable GdDS
pip uninstall GdDS
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `GdDS` within that folder.

### Testing the extension

#### Server tests

This extension is using [Pytest](https://docs.pytest.org/) for Python code testing.

Install test dependencies (needed only once):

```sh
pip install -e ".[test]"
# Each time you install the Python package, you need to restore the front-end extension link
jupyter labextension develop . --overwrite
```

To execute them, run:

```sh
pytest -vv -r ap --cov GdDS
```

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

## AI Coding Assistant Support

This project includes an `AGENTS.md` file with coding standards and best practices for JupyterLab extension development. The file follows the [AGENTS.md standard](https://agents.md) for cross-tool compatibility.

### Compatible AI Tools

`AGENTS.md` works with AI coding assistants that support the standard, including Cursor, GitHub Copilot, Windsurf, Aider, and others. For a current list of compatible tools, see [the AGENTS.md standard](https://agents.md).
This project also includes symlinks for tool-specific compatibility:

- `CLAUDE.md` → `AGENTS.md` (for Claude Code)

- `GEMINI.md` → `AGENTS.md` (for Gemini Code Assist)

Other conventions you might encounter:

- `.cursorrules` - Cursor's YAML/JSON format (Cursor also supports AGENTS.md natively)
- `CONVENTIONS.md` / `CONTRIBUTING.md` - For CodeConventions.ai and GitHub bots
- Project-specific rules in JetBrains AI Assistant settings

All tool-specific files should be symlinks to `AGENTS.md` as the single source of truth.

### What's Included

The `AGENTS.md` file provides guidance on:

- Code quality rules and file-scoped validation commands
- Naming conventions for packages, plugins, and files
- Coding standards (TypeScript, Python)
- Development workflow and debugging
- Backend-frontend integration patterns (`APIHandler`, `requestAPI()`, routing)
- Common pitfalls and how to avoid them

### Customization

You can edit `AGENTS.md` to add project-specific conventions or adjust guidelines to match your team's practices. The file uses plain Markdown with Do/Don't patterns and references to actual project files.

**Note**: `AGENTS.md` is living documentation. Update it when you change conventions, add dependencies, or discover new patterns. Include `AGENTS.md` updates in commits that modify workflows or coding standards.

### Packaging the extension

See [RELEASE](RELEASE.md)

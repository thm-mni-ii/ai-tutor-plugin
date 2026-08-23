import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
  } from '@jupyterlab/application';

  import { Widget } from '@lumino/widgets';
  import { LabIcon } from '@jupyterlab/ui-components';
  import { ILayoutRestorer } from '@jupyterlab/application';
  import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';
  import { DocumentRegistry } from '@jupyterlab/docregistry';
  import { IDisposable } from '@lumino/disposable';
  import { ToolbarButton } from '@jupyterlab/apputils';
  import { ContentsManager } from '@jupyterlab/services';
  import { PageConfig } from '@jupyterlab/coreutils';
  import { mountVueWidget, useAiTutorStore } from '@ai4ai/vue-ui';
  import '@ai4ai/vue-ui/index.css';

  import '../style/index.css';

  import robotSvg from '../style/icons/robot.svg';

  const AUTH_URL = 'https://feedback.mni.thm.de/gdds';
  // ai-tutor-backend base URL for chat streaming + queue position — set on the
  // server via the BACKEND_URL env var (see GdDS/__init__.py), falls back to
  // the THM test deployment for anyone running without that env var set.
  const BACKEND_URL = PageConfig.getOption('backendUrl') || 'https://feedback.mni.thm.de/gdds-test';

  // JupyterHub URLs look like /user/<username>/lab/... — extract it the same
  // way authenticateUser() below does. Empty string outside JupyterHub (e.g.
  // plain `jupyter lab` in local dev), which the backend treats as anonymous.
  function getJupyterHubUsername(): string {
    const username_list = window.location.pathname.split('/');
    if (username_list[1] !== 'user' || !username_list[2]) {
      return '';
    }
    return decodeURIComponent(username_list[2]);
  }

  let taskFiles: folder[] = [];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  interface folder {
    name: String,
    files: String[]
  }

  interface MissingFilesResponse {
    folders: Array<{
      name: string;
      files: Array<{
        name: string;
        content_base64?: string;
        content?: string;
        path: string;
      }>;
    }>;
  }

  async function loadTaskFiles(): Promise<folder[]> {
    try {
      const contentsManager = new ContentsManager();
      const tasksDir = 'Ãœbungsaufgaben/Grundlagen der Data Science';
      
      let folders: folder[] = []
      try {
        const dirListing = await contentsManager.get(tasksDir, { content: true });
        for (let i = 0; i < dirListing.content.length; i++) {
          if(dirListing.content[i].type == "directory") {
            let emptyFolder: folder = {
              name: "",
              files: []
            };
            emptyFolder.name = dirListing.content[i].name;
            const subFolder = tasksDir + "/" + emptyFolder.name;
            const subDir = await contentsManager.get(subFolder, { content: true });
            for (let j = 0; j < subDir.content.length; j++) {
              emptyFolder.files.push(subDir.content[j].name);
            }
            folders.push(emptyFolder);
          }
        }
      return folders;
      } catch (error) {
        return [];
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tasks-Dateien:', error);
      return [];
    }
  }

async function saveMissingFiles(missingFiles: MissingFilesResponse): Promise<void> {
  const contentsManager = new ContentsManager();
  const tasksDir = "Ãœbungsaufgaben";
  // Hilfsfunktion: rekursiv sicherstellen, dass ein Ordner existiert
  async function ensureDirectory(path: string): Promise<void> {
    const parts = path.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      try {
        await contentsManager.get(current);
      } catch {
        await contentsManager.save(current, { type: "directory" });
      }
    }
  }

  try {
    // Root-Ordner sicherstellen
    await ensureDirectory(tasksDir);

    for (const folder of missingFiles.folders) {
      const folderPath = `${tasksDir}/${folder.name}`;

      await ensureDirectory(folderPath);

      for (const file of folder.files) {
        const filePath = `${folderPath}/${file.name}`;

        try {
          await contentsManager.get(filePath);

          continue; // File exists â†’ skip
        } catch {

          try {
            let fileContent: string | undefined;


            if (file.content_base64) {
              const binary = Uint8Array.from(atob(file.content_base64), c => c.charCodeAt(0));
              fileContent = new TextDecoder("utf-8").decode(binary);
            } else if (file.content) {
              fileContent = file.content;
            } else {
              console.warn(`Kein Inhalt fÃ¼r Datei ${file.name} gefunden`);
              continue;
            }
            await contentsManager.save(filePath, {
              type: "file",
              format: "text",
              content: fileContent,
            });


          } catch (error) {
            console.error(`Fehler beim Speichern der Datei ${file.name}:`, error);
          }

        }
      }
    }
  } catch (error) {
    console.error("Fehler beim Speichern der fehlenden Dateien:", error);
  }
}



  // Authentifikationsfunktion
  async function authenticateUser(): Promise<boolean> {
    return {
      user_found: true,
      is_admin: true
    } as unknown as boolean;
    try {
      const url = new URL(AUTH_URL + "/authenticate");
      const username_list = window.location.pathname.split("/");
      const username = username_list[2]
      const decodedUsername = decodeURIComponent(username);
      url.searchParams.append('username', decodedUsername);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      if (response.ok) {
        const result = await response.json();
        return result;
      }
      
      return false;
    } catch (networkError: any) {
      if (networkError.name === 'AbortError') {
        throw new Error('Anfragezeit Ã¼berschritten. Bitte versuchen Sie es erneut.');
      }
      throw new Error('Netzwerkfehler: ' + networkError.message);
    } finally {
        clearTimeout(timeoutId);
    }
  }

  // Robot Icon fÃ¼r AI Tutor
  const robotIcon = new LabIcon({
    name: 'myplugin:robot',
    svgstr: robotSvg
  });


  // Help Widget (AI Tutor)
 class HelpWidget extends Widget {
    private notebookTracker: INotebookTracker;

    constructor(app: JupyterFrontEnd, notebookTracker: INotebookTracker, isAdmin: boolean) {
      super();
      this.notebookTracker = notebookTracker;
      this.addClass('gdds-help-widget');
      this.id = 'gdds-help-widget';
      this.title.label = 'AI Tutor';
      this.title.icon = robotIcon;
      this.title.caption = 'AI Tutor Hilfe und Dokumentation';
      const div = document.createElement('div');
      div.style.height = '100%';
      mountVueWidget(div, { app, notebookTracker, isAdmin, username: getJupyterHubUsername(), backendUrl: BACKEND_URL });
      this.node.appendChild(div);
      this.setupCellTracking(app);
    }

    private setupCellTracking(app: JupyterFrontEnd): void {
      const { currentCellId, activeCellLabel } = useAiTutorStore();
      const commands = app.commands;

      function makeCellLabel(cell: any, oneBasedIndex: number): string {
        const source: string = cell.model.sharedModel?.source ?? '';
        const firstLine = source.split('\n')[0].trim();
        const preview = firstLine.length > 34 ? firstLine.slice(0, 34) + '…' : firstLine;
        return preview ? `Zelle ${oneBasedIndex} · ${preview}` : `Zelle ${oneBasedIndex}`;
      }

      // Watch for run commands — track the cell that was just executed.
      commands.commandExecuted.connect((_, args) => {
        if (args.id === 'notebook:run-cell-and-select-next') {
          const currentNotebook = this.notebookTracker.currentWidget?.content
          const newCell = currentNotebook?.activeCell;
          if (!currentNotebook || !newCell) {
            currentCellId.value = null;
            activeCellLabel.value = null;
            return;
          }
          const index = currentNotebook.widgets.indexOf(newCell);
          const previousCell = currentNotebook.widgets[index - 1];
          if (!previousCell) return;
          currentCellId.value = previousCell.model.id;
          activeCellLabel.value = makeCellLabel(previousCell, index); // index is already 1-based here
        }
      });

      // Watch for selection changes — track whichever cell the student clicks.
      this.notebookTracker.activeCellChanged.connect(() => {
        const currentNotebook = this.notebookTracker.currentWidget?.content;
        const newCell = currentNotebook?.activeCell;
        if (!currentNotebook || !newCell) {
          currentCellId.value = null;
          activeCellLabel.value = null;
          return;
        }
        const cellIndex = currentNotebook.widgets.indexOf(newCell);
        currentCellId.value = newCell.model.id;
        activeCellLabel.value = makeCellLabel(newCell, cellIndex + 1);
      });
    }


  }

  const plugin: JupyterFrontEndPlugin<void> = {
    id: 'my-extension:sidebar-button',
    autoStart: true,
    requires: [ILayoutRestorer, INotebookTracker],
    activate: async (app: JupyterFrontEnd, restorer: ILayoutRestorer, notebookTracker: INotebookTracker) => {

      // Authentifikation prÃ¼fen
      const isAuthenticatedObject: any = await authenticateUser();
      const isAuthenticated = isAuthenticatedObject.user_found;
      const isAdmin = isAuthenticatedObject.is_admin;
      if (!isAuthenticated) {
        console.error('Authentifikation fehlgeschlagen - Plugin wird nicht geladen');
        return;
      }

      (async () => {
          function createPopup(message: string, allowClose = true, color = "white") {
            const popup = document.createElement('div');
            popup.style.position = 'fixed';
            popup.style.bottom = '20px';
            popup.style.right = '20px';
            popup.style.background = color;
            popup.style.color = "white";
            popup.style.padding = '12px 18px';
            popup.style.borderRadius = '8px';
            popup.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            popup.style.fontSize = '14px';
            popup.style.zIndex = '9999';
            popup.style.opacity = '0';
            popup.style.transition = 'opacity 0.3s ease';
            popup.style.display = 'flex';
            popup.style.alignItems = 'center';
            popup.style.gap = '10px';

            const text = document.createElement('span');
            text.innerText = message;
            popup.appendChild(text);

            if (allowClose) {
              const btn = document.createElement('button');
              btn.innerText = 'Ã—';
              btn.style.border = 'none';
              btn.style.background = 'transparent';
              btn.style.color = 'white';
              btn.style.fontSize = '18px';
              btn.style.cursor = 'pointer';
              btn.onclick = () => popup.remove();
              popup.appendChild(btn);
            }

            document.body.appendChild(popup);

            requestAnimationFrame(() => {
              popup.style.opacity = '1';
            });

            return popup;
          }

          const downloadingPopup = createPopup("Lade fehlende Dateien herunter...", true, "#333");

          taskFiles = await loadTaskFiles();
          const baseUrl = AUTH_URL + '/get_missing_files';

          try {
            const response = await fetch(`${baseUrl}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(taskFiles)
            });

            if (response.ok) {
              try {
                const missingFiles: MissingFilesResponse = await response.json();
                await saveMissingFiles(missingFiles);

                downloadingPopup.remove();

                const finishedPopup = createPopup("Alle Dateien wurden erfolgreich geladen!", false, "#7fdd53ff");

                setTimeout(() => {
                  finishedPopup.style.opacity = '0';
                  setTimeout(() => finishedPopup.remove(), 300);
                }, 3000);

              } catch (error) {
                console.error('Fehler beim Verarbeiten der Server-Antwort:', error);
              }
            } else {
              console.error('Fehler beim Abrufen der fehlenden Dateien:', response.statusText);
            }
          } catch (networkError: any) {
            if (networkError.name === 'AbortError') {
              console.error('Anfragezeit Ã¼berschritten beim Laden der Dateien');
            } else {
              console.error('Netzwerkfehler beim Laden der Dateien:', networkError.message);
            }
          } finally {
            clearTimeout(timeoutId);
          }
        })();

      const helpWidget = new HelpWidget(app, notebookTracker, isAdmin);
      restorer.add(helpWidget, helpWidget.id);


      app.commands.addCommand('gdds:open-help', {
        label: 'Toggle AI Tutor',
        caption: 'Ã–ffnet oder schlieÃŸt den AI Tutor',
        execute: () => {
          // PrÃ¼fen ob das Widget bereits angehÃ¤ngt ist
          if (!helpWidget.isAttached) {
            // Widget hinzufÃ¼gen, wenn es nicht angehÃ¤ngt ist
            app.shell.add(helpWidget, 'right');
            app.shell.activateById(helpWidget.id);
          } else {
            helpWidget.close();
          }
        }
      });

      function createHelpButton(app: JupyterFrontEnd): ToolbarButton {
        return new ToolbarButton({
          className: 'gdds-help-button',
          label: 'AI Tutor',
          tooltip: 'AI Tutor Hilfe Ã¶ffnen (Strg+Shift+H)',
          icon: robotIcon,
          onClick: () => {
            app.commands.execute('gdds:open-help');
          }
        });
      }

      app.docRegistry.addWidgetExtension('Notebook', {
        createNew: (panel: NotebookPanel, context: DocumentRegistry.IContext<any>): IDisposable => {
          const helpButton = createHelpButton(app);
          panel.toolbar.addItem('gdds-help', helpButton);
          return helpButton;
        }
      });

      app.commands.addKeyBinding({
        command: 'gdds:open-help',
        args: {},
        keys: ['Ctrl Shift H'],
        selector: '.jp-Notebook'
      });
    }
    
  };
  export default plugin;

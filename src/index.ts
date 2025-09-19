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

// Import styles
import '../style/index.css';

// Globale Variable für die Authentifikations-URL
const AUTH_URL = 'http://localhost:8000';

// Authentifikationsfunktion
async function authenticateUser(): Promise<boolean> {
  try {
    // Ich muss irgendwie an die EMAIL kommen hier
    const url = new URL(AUTH_URL + "/authenticate");
    const username = "jhws42";
    const decodedUsername = decodeURIComponent(username);
    url.searchParams.append('username', decodedUsername);
    console.log(url.searchParams);
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log("authenticated")
      console.log(result);
      return result.user_found === true;
    }
      console.log("not authenticated")
    
    return false;
  } catch (error) {
    console.error('Authentifikationsfehler:', error);
    return false;
  }
}

// Robot Icon für AI Tutor
const robotIcon = new LabIcon({
  name: 'gdds:robot',
  svgstr: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c.55 0 1 .45 1 1v1h6c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6V3c0-.55.45-1 1-1zM7.5 11c-.83 0-1.5-.67-1.5-1.5S6.67 8 7.5 8s1.5.67 1.5 1.5S8.33 11 7.5 11zm9 0c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8s1.5.67 1.5 1.5S17.33 11 16.5 11zM8 15h8v2H8v-2z"/>
      <circle cx="12" cy="2" r="1"/>
    </svg>
  `
});

// Interface für Notebook-Zellen
interface NotebookCell {
  id: string;
  cell_type: 'markdown' | 'code' | 'raw';
  source: string | string[];
  metadata: Record<string, any>;
}

// Help Widget (AI Tutor)
class HelpWidget extends Widget {
  private notebookTracker: INotebookTracker;

  constructor(app: JupyterFrontEnd, notebookTracker: INotebookTracker) {
    super();
    this.notebookTracker = notebookTracker;
    this.addClass('gdds-help-widget');
    this.id = 'gdds-help-widget';
    this.title.label = 'AI Tutor';
    this.title.icon = robotIcon;
    this.title.caption = 'AI Tutor Hilfe und Dokumentation';
    this.createContent();
  }

  private createContent(): void {
    const content = document.createElement('div');
    content.innerHTML = `
      <h3 style="margin-top: 0; color: var(--jp-ui-font-color1); border-bottom: 1px solid var(--jp-border-color2); padding-bottom: 8px;">
        📚 AI Tutor
      </h3>
      <p style="color: var(--jp-ui-font-color2); font-size: 13px;">
        Klicken sie in eine ausgeführte Zelle und Drücken sie dann den Knopf
      </p>
    `;

    const button = document.createElement('button');
    button.textContent = 'Zelle analysieren';
    button.style.cssText = `
      padding: 6px 12px;
      background-color: var(--jp-brand-color1);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 12px;
    `;

    const resultContainer = document.createElement('div');
    resultContainer.className = 'gdds-result-container';
    resultContainer.style.cssText = `
      margin-top: 12px;
      padding: 12px;
      background: var(--jp-layout-color2);
      border: 1px solid var(--jp-border-color2);
      border-radius: 4px;
      font-family: var(--jp-code-font-family);
      font-size: 12px;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
      display: none;
    `;

    button.onclick = async () => {
      const currentNotebook = this.notebookTracker.currentWidget;

      if (currentNotebook && currentNotebook.content.activeCell) {
        const activeCell = currentNotebook.content.activeCell;
        
        try {
          const cellText = activeCell.model.sharedModel.getSource();
          let task = String(activeCell.model.metadata.task);
          if (task === "undefined") {
            task = "";
          }
          const notebookModel = currentNotebook.content.model;
          if (notebookModel) {
            const notebookData: any = notebookModel.toJSON();
            console.log("-----------------------------------------------------------------------")
            console.log(notebookData.cells)
            console.log("-----------------------------------------------------------------------")
            const notebookCells = this.getCellWithContext(this.cleanNotebook(notebookData).cells, cellText);
            const noteBookText = this.notebookToString(notebookCells);
            console.log(noteBookText)
            console.log(notebookCells)
            const baseUrl = AUTH_URL + '/generateAndSendPrompt';
            const response: any = await fetch(baseUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                noteBookText: notebookData.cells,
                cellText: cellText,
              }),
            });
            console.log(response);
            const res = response.choices[0].message.content;
            resultContainer.style.display = 'block';
            resultContainer.innerHTML = `<code style="color: var(--jp-ui-font-color1);">${this.escapeHtml(res)}</code>`.trim();
          }
        } catch (error) {
          console.error('Fehler beim Zugriff auf Zelle:', error);
        }
      }
    };

    const buttonContainer = document.createElement('div');
    buttonContainer.appendChild(button);
    content.appendChild(buttonContainer);
    content.appendChild(resultContainer);
    this.node.appendChild(content);
  }

  private notebookToString(cells: any[]): string {
    if (!Array.isArray(cells)) {
      throw new Error("Ungültiges Notebook-Array");
    }

    let result: string[] = [];
    for (const cell of cells) {
      if (cell.cell_type === "markdown") {
        result.push("[MARKDOWN]");        
        result.push(Array.isArray(cell.source) ? cell.source.join('') : cell.source);
      } else if (cell.cell_type === "code") {
        result.push("[CODE]");
        result.push(Array.isArray(cell.source) ? cell.source.join('') : cell.source);
        if (Array.isArray(cell.outputs)) {
          for (const output of cell.outputs) {
            if (output.output_type === "stream") {
              result.push(
                typeof output.text === "string"
                  ? output.text
                  : (output.text?.join("") ?? "")
              );
            } else if (output.output_type === "error") {
              result.push(`Error: ${output.ename}: ${output.evalue}`);
              if (Array.isArray(output.traceback)) {
                result.push(Array.isArray(cell.traceback) ? cell.traceback.join('') : cell.traceback);
              }
            }
          }
        }
      }
    }
    return result.join("\n\n");
  }

  private getCellWithContext(cells: NotebookCell[], searchString: string): NotebookCell[] {
    const getSourceAsString = (source: string | string[]): string => {
      return Array.isArray(source) ? source.join('') : source;
    };

    const targetIndex = cells.findIndex(cell => {
      const sourceString = getSourceAsString(cell.source);
      return sourceString === searchString;
    });

    if (targetIndex === -1) {
      return [];
    }

    const startIndex = Math.max(0, targetIndex - 5);
    return cells.slice(startIndex, targetIndex + 1);
  }

    
  private cleanNotebook(notebookData: any) {
    const cleanedNotebook = JSON.parse(JSON.stringify(notebookData));
    
    cleanedNotebook.metadata = {
      kernelspec: cleanedNotebook.metadata.kernelspec || {},
      language_info: cleanedNotebook.metadata.language_info || {}
    };
    
    cleanedNotebook.cells.forEach((cell: any) => {
      cell.output = [];
    });
    
    return cleanedNotebook;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

const plugin: JupyterFrontEndPlugin<void> = {
  id: 'my-extension:sidebar-button',
  autoStart: true,
  requires: [ILayoutRestorer, INotebookTracker],
  activate: async (app: JupyterFrontEnd, restorer: ILayoutRestorer, notebookTracker: INotebookTracker) => {
    console.log('AI Tutor Extension startet - Authentifikation wird geprüft...');

    // Authentifikation prüfen
    const isAuthenticated = await authenticateUser();
    
    if (!isAuthenticated) {
      console.error('Authentifikation fehlgeschlagen - Plugin wird nicht geladen');
      return;
    }

    console.log('Authentifikation erfolgreich - AI Tutor Extension wird geladen');

    const helpWidget = new HelpWidget(app, notebookTracker);
    restorer.add(helpWidget, helpWidget.id);

    app.commands.addCommand('gdds:open-help', {
      label: 'Öffne den AI Tutor',
      caption: 'Öffnet den AI Tutor',
      execute: () => {
        if (!helpWidget.isAttached) {
          app.shell.add(helpWidget, 'right');
        }
        app.shell.activateById(helpWidget.id);
      }
    });

    function createHelpButton(app: JupyterFrontEnd): ToolbarButton {
      return new ToolbarButton({
        className: 'gdds-help-button',
        label: 'AI TUTOR',
        tooltip: 'AI Tutor Hilfe öffnen (Strg+Shift+H)',
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

    console.log('AI Tutor Button zur Notebook-Toolbar hinzugefügt');
  }
};

export default plugin;
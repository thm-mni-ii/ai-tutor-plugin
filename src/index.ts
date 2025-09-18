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
import { Contents } from '@jupyterlab/services';

import { sendRequest, generatePromptWithSolution } from './utils/util';

// Import styles
import '../style/index.css';

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
  private app: JupyterFrontEnd;
  private notebookTracker: INotebookTracker;

  constructor(app: JupyterFrontEnd, notebookTracker: INotebookTracker) {
    super();
    this.app = app;
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
            const notebookData = notebookModel.toJSON();
            const notebookCells = this.getCellWithContext(this.cleanNotebook(notebookData).cells, cellText);
            const noteBookText = this.notebookToString(notebookCells);
            const csvPreviews = await this.readCSVPreviews();
            console.log(csvPreviews)
            const solution = `
            te = TransactionEncoder()
            te_ary = te.fit(dataset).transform(dataset)
            df = pd.DataFrame(te_ary, columns=te.columns_)

            === ZELLE 13 (CODE) ===
            CODE:
            # 1. Absolute Häufigkeit: Wie oft wurde jedes Produkt gekauft?
            absolute_frequency = df.sum().sort_values(ascending=False)
            print("Absolute Häufigkeit der Produkte:")
            print(absolute_frequency)`;
            const prompt = generatePromptWithSolution(noteBookText, cellText, solution);
            const result = await sendRequest(prompt, "http://localhost:1338/v1/chat/completions");
            const res = result.choices[0].message.content;
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
              result.push(output.text?.join("") || "");
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

  private async readCSVPreviews() {
    const currentNotebook = this.notebookTracker.currentWidget;
   
    if (!currentNotebook) {
      console.log('Kein aktives Notebook');
      return 'Kein aktives Notebook gefunden.';
    }
   
    const notebookPath = currentNotebook.context.path;
    const directoryPath = notebookPath.substring(0, notebookPath.lastIndexOf('/')) || '/';
   
    try {
      const contents = await this.app.serviceManager.contents.get(directoryPath);
     
      if (contents.type !== 'directory') {
        return 'Kein gültiger Ordner gefunden.';
      }
     
      const csvFiles = contents.content.filter(
        (item: Contents.IModel) =>
          item.type === 'file' &&
          item.name.toLowerCase().endsWith('.csv')
      );
     
      if (csvFiles.length === 0) {
        return 'Keine CSV-Dateien im Ordner gefunden.';
      }
     
      const allCSVContent: string[] = [];
      allCSVContent.push(`=== CSV-Dateien im Ordner (${csvFiles.length} Dateien) ===\n`);
     
      for (const csvFile of csvFiles) {
        try {
          const filePath = directoryPath === '/' ? csvFile.name : `${directoryPath}/${csvFile.name}`;
          const fileContent = await this.app.serviceManager.contents.get(filePath);
         
          if (fileContent.type === 'file' && fileContent.content) {
            const lines = fileContent.content.split('\n');
            const firstSixLines = lines.slice(0, 21);
           
            allCSVContent.push(`--- DATEI: ${csvFile.name} (${lines.length} Zeilen total) ---`);
            firstSixLines.forEach((line: any, index: any) => {
              allCSVContent.push(`${index + 1}: ${line}`);
            });
            allCSVContent.push('');
          }
        } catch (error) {
          console.error(`Fehler beim Lesen von ${csvFile.name}:`, error);
          allCSVContent.push(`--- FEHLER bei ${csvFile.name}: ${error} ---`);
          allCSVContent.push('');
        }
      }
     
      return allCSVContent.join('\n');
    } catch (error) {
      console.error('Fehler beim Laden des Ordners:', error);
      return `Fehler beim Laden des Ordners: ${error}`;
    }
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
  activate: (app: JupyterFrontEnd, restorer: ILayoutRestorer, notebookTracker: INotebookTracker) => {
    console.log('AI Tutor Extension ist aktiv');

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
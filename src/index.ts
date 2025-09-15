import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import axios from 'axios';
import { Widget } from '@lumino/widgets';
import { LabIcon } from '@jupyterlab/ui-components';
import { ILayoutRestorer } from '@jupyterlab/application';
import { NotebookPanel, INotebookTracker } from '@jupyterlab/notebook';
import { DocumentRegistry } from '@jupyterlab/docregistry';
import { IDisposable } from '@lumino/disposable';
import { ToolbarButton } from '@jupyterlab/apputils';
import JSZip from 'jszip';
import { ContentsManager } from '@jupyterlab/services';
import { Contents } from '@jupyterlab/services';

import { sendRequest, generatePromptWithSolution } from './utils/util';

// Import styles
import '../style/index.css';

const contents = new ContentsManager();

// Icons
const mySvg = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
</svg>`;

const myIcon = new LabIcon({
  name: 'my-extension:icon',
  svgstr: mySvg
});

const robotIcon = new LabIcon({
  name: 'gdds:robot',
  svgstr: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2c.55 0 1 .45 1 1v1h6c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2h6V3c0-.55.45-1 1-1zM7.5 11c-.83 0-1.5-.67-1.5-1.5S6.67 8 7.5 8s1.5.67 1.5 1.5S8.33 11 7.5 11zm9 0c-.83 0-1.5-.67-1.5-1.5S15.67 8 16.5 8s1.5.67 1.5 1.5S17.33 11 16.5 11zM8 15h8v2H8v-2z"/>
      <circle cx="12" cy="2" r="1"/>
    </svg>
  `
});

// Interfaces
interface NotebookCell {
  id: string;
  cell_type: 'markdown' | 'code' | 'raw';
  source: string | string[];
  metadata: Record<string, any>;
}

interface LocalFile {
  name: string;
  path: string;
  type: string;
  size: number;
  modified: string;
  mimetype: string;
}

// Help Widget
class HelpWidget extends Widget {
  private app: JupyterFrontEnd;
  private notebookTracker: INotebookTracker;

  constructor(app: JupyterFrontEnd, notebookTracker: INotebookTracker) {
    super();
    this.app = app;
    this.notebookTracker = notebookTracker;
    this.addClass('gdds-help-widget');
    this.id = 'gdds-help-widget';
    this.title.label = 'GDDS Hilfe';
    this.title.icon = robotIcon;
    this.title.caption = 'GDDS Hilfe und Dokumentation';
    this.createContent();
  }

  private createContent(): void {
    const content = document.createElement('div');
    content.innerHTML = `
      <h3 style="margin-top: 0; color: var(--jp-ui-font-color1); border-bottom: 1px solid var(--jp-border-color2); padding-bottom: 8px;">
        📚 GDDS Hilfe
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

// Sidebar File Browser
class SidebarFileBrowser extends Widget {
  private files: LocalFile[] = [];
  private app: JupyterFrontEnd;
  private basePath: string;
  private fileListContainer: HTMLElement;

  constructor(basePath: string, app: JupyterFrontEnd) {
    super();
    this.basePath = basePath;
    this.app = app;
    this.addClass('gdds-sidebar-browser');
    this.id = 'gdds-sidebar-browser';
    this.title.label = 'GdDS';
    this.title.icon = myIcon;
    this.title.caption = 'GDDS Lokale Dateien';
    this.fileListContainer = document.createElement('div');
    this.fileListContainer.className = 'gdds-sidebar-browser-filelist';
    this.init();
  }

  private async init(): Promise<void> {
    this.createLayout();
    await this.loadFolders();
    this.updateFileList();
  }

  private createLayout(): void {
    const header = document.createElement('div');
    header.className = 'gdds-sidebar-browser-header';

    const pathSpan = document.createElement('span');
    pathSpan.className = 'gdds-sidebar-browser-path';
    pathSpan.textContent = `📁 ${this.basePath || '(Root)'}`;

    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'gdds-sidebar-browser-refresh-btn';
    refreshBtn.innerHTML = '🔄';
    refreshBtn.title = 'Aktualisieren';
    refreshBtn.addEventListener('click', () => this.refresh());

    header.appendChild(pathSpan);
    header.appendChild(refreshBtn);
    this.node.appendChild(header);
    this.node.appendChild(this.fileListContainer);
  }

  private async loadFolders(): Promise<void> {
    let folders = await axios.get("http://127.0.0.1:8000/file_information");
    const contents = new ContentsManager();
    let ordner = null;
    
    try {
      const listing = await contents.get('tasks', { content: true });
      if (listing.type === 'directory') {
        ordner = listing.content
          .filter((item: { type: string; }) => item.type === 'directory')
          .map((item: { name: any; }) => item.name);
      }
    } catch (err) {
      console.error('Fehler beim Laden der tasks-Ordner:', err);
    }
    
    if (ordner != null) {
      for (let i = folders.data.length; i >= 0; i--) {
        if (ordner.includes(folders.data[i])) {
          folders.data.splice(i, 1);
        }
      }
    }
    
    await this.getFolders(folders.data);
  }

  private async getFolders(folders: string[]): Promise<void> {
    const searchParams = new URLSearchParams();
    folders.forEach(folder => {
      searchParams.append('ordner', folder);
    });
    
    const response = await axios.get(`http://127.0.0.1:8000/get_task?${searchParams.toString()}`, {
      responseType: 'blob'
    });
    
    const zip = await JSZip.loadAsync(response.data);
    const targetDir = 'tasks';
    
    try {
      await contents.save(targetDir, {
        type: 'directory',
        format: 'json',
        content: null
      });
    } catch (e) {
      // Ordner existiert bereits
    }

    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('text');
        const fullPath = `${targetDir}/${relativePath}`;
        const dirPath = fullPath.substring(0, fullPath.lastIndexOf('/'));

        await this.ensureDirectory(dirPath, contents);
        await contents.save(fullPath, {
          type: 'file',
          format: 'text',
          content: content
        });
      } else {
        await contents.newUntitled({
          path: `${targetDir}/${relativePath}`,
          type: 'directory'
        });
      }
    }
  }

  private async ensureDirectory(path: string, contents: ContentsManager) {
    const segments = path.split('/');
    let currentPath = '';
    
    for (const segment of segments) {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      try {
        await contents.get(currentPath);
      } catch (err) {
        await contents.save(currentPath, {
          type: 'directory',
          format: 'json',
          content: null
        });
      }
    }
  }

  private updateFileList(): void {
    this.fileListContainer.innerHTML = '';

    if (this.files.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'gdds-sidebar-browser-empty';
      emptyMessage.textContent = 'Keine unterstützten Dateien gefunden';
      this.fileListContainer.appendChild(emptyMessage);
      return;
    }

    const counter = document.createElement('div');
    counter.className = 'gdds-sidebar-browser-counter';
    counter.textContent = `${this.files.length} Dateien`;
    this.fileListContainer.appendChild(counter);

    this.files.forEach(file => {
      const fileItem = this.createFileItem(file);
      this.fileListContainer.appendChild(fileItem);
    });
  }

  private createFileItem(file: LocalFile): HTMLElement {
    const item = document.createElement('div');
    item.className = 'gdds-sidebar-browser-fileitem';

    const icon = document.createElement('span');
    icon.className = 'gdds-sidebar-browser-fileicon';

    const nameContainer = document.createElement('div');
    nameContainer.className = 'gdds-sidebar-browser-filename';

    const nameSpan = document.createElement('div');
    nameSpan.className = 'gdds-sidebar-browser-filename-text';
    nameSpan.textContent = file.name;

    const sizeSpan = document.createElement('div');
    sizeSpan.className = 'gdds-sidebar-browser-filesize';
    const fileSize = file.size > 1024 ? `${Math.round(file.size/1024)}KB` : `${file.size}B`;
    sizeSpan.textContent = fileSize;

    nameContainer.appendChild(nameSpan);
    nameContainer.appendChild(sizeSpan);

    item.addEventListener('dblclick', () => {
      this.openFile(file);
    });

    item.addEventListener('click', () => {
      const selected = this.fileListContainer.querySelector('.selected');
      if (selected) {
        selected.classList.remove('selected');
      }
      item.classList.add('selected');
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, file);
    });

    item.appendChild(icon);
    item.appendChild(nameContainer);

    return item;
  }

  private showContextMenu(event: MouseEvent, file: LocalFile): void {
    const menu = document.createElement('div');
    menu.className = 'gdds-context-menu';
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;

    const openItem = this.createMenuItem('📖 Öffnen', () => {
      this.openFile(file);
      document.body.removeChild(menu);
    });

    const copyPathItem = this.createMenuItem('📋 Pfad kopieren', () => {
      this.copyPath(file);
      document.body.removeChild(menu);
    });

    menu.appendChild(openItem);
    menu.appendChild(copyPathItem);
    document.body.appendChild(menu);

    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        document.body.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  private createMenuItem(text: string, onClick: () => void): HTMLElement {
    const item = document.createElement('div');
    item.className = 'gdds-context-menu-item';
    item.textContent = text;
    item.addEventListener('click', onClick);
    return item;
  }

  private async openFile(file: LocalFile): Promise<void> {
    try {
      if (file.type === 'notebook' || file.mimetype === 'application/x-ipynb+json') {
        await this.app.commands.execute('docmanager:open', {
          path: file.path,
          factory: 'Notebook'
        });
      } else {
        await this.app.commands.execute('docmanager:open', {
          path: file.path
        });
      }
    } catch (error) {
      console.error('Fehler beim Öffnen der Datei:', error);
    }
  }

  private async copyPath(file: LocalFile): Promise<void> {
    try {
      await navigator.clipboard.writeText(file.path);
      this.showSuccess(`Pfad kopiert: ${file.path}`);
    } catch (error) {
      console.error('Fehler beim Kopieren:', error);
      this.showError('Pfad konnte nicht kopiert werden');
    }
  }

  private async refresh(): Promise<void> {
    try {
      await this.loadFolders();
      this.updateFileList();
      this.showSuccess(`${this.files.length} Dateien aktualisiert`);
    } catch (error) {
      this.showError('Aktualisierung fehlgeschlagen');
    }
  }

  private showError(message: string): void {
    this.showToast(message, 'gdds-toast-error');
  }

  private showSuccess(message: string): void {
    this.showToast(message, 'gdds-toast-success');
  }

  private showToast(message: string, className: string): void {
    const toast = document.createElement('div');
    toast.className = `gdds-toast ${className}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }
}

// Plugin
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'my-extension:sidebar-button',
  autoStart: true,
  requires: [ILayoutRestorer, INotebookTracker],
  activate: (app: JupyterFrontEnd, restorer: ILayoutRestorer, notebookTracker: INotebookTracker) => {
    console.log('GDDS ist aktiv - Lokale Dateien werden gescannt');

    const sidebarBrowser = new SidebarFileBrowser("", app);
    const helpWidget = new HelpWidget(app, notebookTracker);

    restorer.add(sidebarBrowser, sidebarBrowser.id);
    restorer.add(helpWidget, helpWidget.id);

    app.shell.add(sidebarBrowser, 'left', { rank: 600 });

    app.commands.addCommand('gdds:refresh-files', {
      label: 'GDDS Dateien aktualisieren',
      execute: () => {
        (sidebarBrowser as any).refresh();
      }
    });

    app.commands.addCommand('gdds:open-help', {
      label: 'GDDS Hilfe öffnen',
      caption: 'Öffnet die GDDS Hilfe und Dokumentation',
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
        label: 'Hilfe',
        tooltip: 'GDDS Hilfe öffnen (Strg+Shift+H)',
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

    console.log('Help Button zur Notebook-Toolbar hinzugefügt');
  }
};

export default plugin;
import type { NotebookData } from '../useBackend'

// Minimal interface — only the properties we access from INotebookTracker.
// Keeps @jupyterlab/notebook out of the Vue package's dependencies.
// Matches the exact API used in the original createContent():
//   notebookTracker.currentWidget.content.model.toJSON() → { cells: [...] }
//   notebookTracker.currentWidget.context.localPath      → 'path/to/file.ipynb'
interface MinimalNotebookTracker {
  currentWidget?: {
    content: {
      model: {
        toJSON(): { cells: unknown[] }
      }
    }
    context: {
      localPath: string
    }
  }
}

export function useNotebook(tracker: unknown) {
  const nb = tracker as MinimalNotebookTracker | null

  // Returns all cells and the file name of the currently open notebook.
  // All three feedback scopes (cell / task / sheet) send the full cell list;
  // the backend uses the `state` field to decide what to focus on.
  // Falls back to empty data when no notebook is open (e.g. dev server).
  function getNotebookData(): NotebookData {
    const widget = nb?.currentWidget
    if (!widget) {
      return { cells: [], fileName: '' }
    }
    const json = widget.content.model.toJSON() as { cells: unknown[] }
    return {
      cells: json.cells,
      fileName: widget.context.localPath,
    }
  }

  return { getNotebookData }
}

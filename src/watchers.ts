import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { addPending, setLastScript, getLastScript } from './store';

const debounceMap = new Map<string, NodeJS.Timeout>();
function debounce(key: string, fn: () => void, ms = 2000): void {
  const t = debounceMap.get(key);
  if (t) clearTimeout(t);
  debounceMap.set(key, setTimeout(() => { debounceMap.delete(key); fn(); }, ms));
}

export function startOutputWatcher(
  onNewOutput: (filePath: string, fileName: string) => void
): vscode.Disposable {
  const config = vscode.workspace.getConfiguration('quantLogger');
  const exts: string[] = config.get('outputExtensions') ?? ['.csv','.parquet','.png','.jpg','.jpeg','.svg','.html','.ipynb'];
  const ignorePaths: string[] = config.get('ignorePaths') ?? ['node_modules','.git','__pycache__'];

  const pattern = `**/*{${exts.join(',')}}`;
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  function shouldIgnore(uri: vscode.Uri): boolean {
    return ignorePaths.some(seg => uri.fsPath.includes(seg));
  }

  function isLikelyOutput(filePath: string): boolean {
    // Skip tiny files (< 1KB) — probably not real outputs
    try {
      const stat = fs.statSync(filePath);
      return stat.size > 512;
    } catch { return false; }
  }

  const sub = watcher.onDidCreate(uri => {
    if (shouldIgnore(uri)) return;
    const fileName = path.basename(uri.fsPath);
    debounce(`new:${uri.fsPath}`, () => {
      if (!isLikelyOutput(uri.fsPath)) return;
      const scriptName = getLastScript();
      addPending({
        filePath: uri.fsPath,
        fileName,
        detectedAt: Date.now(),
        scriptName
      });
      onNewOutput(uri.fsPath, fileName);
    }, 1500);
  });

  return { dispose: () => { watcher.dispose(); sub.dispose(); } };
}

export function startTerminalWatcher(): vscode.Disposable {
  return vscode.window.onDidEndTerminalShellExecution(event => {
    const cmd = event.execution.commandLine.value.trim();
    const match = cmd.match(/^(?:python|python3|py)\s+(.+\.py)(?:\s.*)?$/i);
    if (match) {
      const scriptName = path.basename(match[1]);
      setLastScript(scriptName);
    }
  });
}

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
  getPending, dismissPending, saveExperiment, updateCommitHash,
  getAllExperiments, PendingOutput
} from './store';
import { buildCommitMessage, runGitCommit, isGitRepo } from './git';

export class CaptureViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'quant-logger.capture';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml();

    webviewView.webview.onDidReceiveMessage(async msg => {
      switch (msg.command) {

        case 'ready':
          this._send('update', this._buildState());
          break;

        case 'dismiss':
          dismissPending(msg.filePath);
          this._send('update', this._buildState());
          break;

        case 'save': {
          // Save the experiment annotation
          const exp = saveExperiment({
            timestamp: Date.now(),
            outputFile: msg.filePath,
            outputName: msg.fileName,
            scriptName: msg.scriptName,
            testing: msg.testing,
            finding: msg.finding
          });

          // Build suggested commit message and check git
          const gitAvailable = await isGitRepo();
          const suggestedMsg = buildCommitMessage(
            msg.fileName,
            msg.scriptName,
            msg.testing,
            msg.finding
          );

          this._send('saved', {
            experimentId: exp.id,
            suggestedCommit: suggestedMsg,
            gitAvailable,
            fileName: msg.fileName
          });
          break;
        }

        case 'commit': {
          const result = await runGitCommit(msg.message);
          if (result.success) {
            if (msg.experimentId) updateCommitHash(msg.experimentId, result.hash);
            this._send('committed', { hash: result.hash });
            // Back to normal state after short delay
            setTimeout(() => this._send('update', this._buildState()), 1500);
          } else {
            this._send('commitError', { error: result.error ?? 'Commit failed.' });
          }
          break;
        }

        case 'skipCommit':
          this._send('update', this._buildState());
          break;
      }
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this._send('update', this._buildState());
    });
  }

  public nudge() {
    // Called when a new output file is detected — focuses the view
    if (this._view) {
      this._view.show(true);
      this._send('update', this._buildState());
    }
  }

  private _send(command: string, payload: object) {
    this._view?.webview.postMessage({ command, ...payload });
  }

  private _buildState() {
    const pending = getPending();
    const recent = getAllExperiments().slice(0, 5);
    return { pending, recent };
  }

  private _getHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: var(--vscode-font-family);
    font-size: 12px;
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 10px;
    line-height: 1.5;
  }

  /* ── Idle state ── */
  .idle {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 28px 12px;
    text-align: center;
    gap: 8px;
  }
  .idle-icon { font-size: 32px; opacity: 0.4; }
  .idle-title { font-size: 13px; font-weight: 600; opacity: 0.7; }
  .idle-sub { font-size: 11px; opacity: 0.5; line-height: 1.6; }

  /* ── Capture card ── */
  .capture-card {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 10px;
    animation: slideIn 0.2s ease;
  }
  @keyframes slideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

  .file-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 10px;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-badge .icon { flex-shrink: 0; }
  .script-from {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 10px;
    margin-top: -6px;
  }

  label {
    display: block;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 4px;
  }
  textarea {
    width: 100%;
    background: var(--vscode-editor-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: var(--vscode-font-family);
    resize: vertical;
    min-height: 46px;
    line-height: 1.5;
    margin-bottom: 8px;
    transition: border-color 0.15s;
  }
  textarea:focus { outline: none; border-color: var(--vscode-focusBorder); }
  textarea::placeholder { color: var(--vscode-input-placeholderForeground); opacity: 0.6; }

  .btn-row { display: flex; gap: 6px; margin-top: 4px; }
  .btn {
    flex: 1;
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-family: var(--vscode-font-family);
    font-weight: 500;
    transition: opacity 0.1s;
  }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn-green { background: #166534; color: #dcfce7; }
  .btn-ghost {
    background: transparent;
    color: var(--vscode-descriptionForeground);
    border: 1px solid var(--vscode-input-border, #555);
    flex: 0;
    padding: 5px 8px;
  }

  /* ── Commit panel ── */
  .commit-panel {
    background: var(--vscode-input-background);
    border: 1px solid var(--vscode-gitDecoration-addedResourceForeground, #4caf50);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 10px;
    animation: slideIn 0.2s ease;
  }
  .commit-title {
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .commit-title .tick { color: var(--vscode-gitDecoration-addedResourceForeground, #4caf50); }
  .commit-hint {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 6px;
  }
  .commit-msg-input {
    width: 100%;
    background: var(--vscode-editor-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, #555);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 11px;
    font-family: var(--vscode-font-family);
    resize: vertical;
    min-height: 52px;
    margin-bottom: 8px;
  }
  .commit-msg-input:focus { outline: none; border-color: var(--vscode-focusBorder); }

  /* ── Success flash ── */
  .commit-success {
    background: #14532d;
    color: #bbf7d0;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    margin-bottom: 10px;
    animation: slideIn 0.2s ease;
  }
  .commit-error {
    background: #7f1d1d;
    color: #fecaca;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 11px;
    margin-bottom: 10px;
  }

  /* ── Recent log ── */
  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--vscode-descriptionForeground);
    margin: 12px 0 6px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--vscode-widget-border, #333);
  }
  .recent-item {
    padding: 6px 4px;
    border-radius: 4px;
    margin-bottom: 4px;
    cursor: default;
    border-left: 2px solid var(--vscode-charts-blue, #4361ee);
    padding-left: 8px;
  }
  .recent-file { font-size: 11px; font-weight: 600; color: var(--vscode-foreground); }
  .recent-testing { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 1px; }
  .recent-finding { font-size: 11px; color: var(--vscode-foreground); margin-top: 1px; }
  .recent-meta { font-size: 10px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
  .hash-badge {
    display: inline-block;
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 0 5px;
    border-radius: 3px;
    font-family: monospace;
    font-size: 9px;
  }

  .queue-count {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
  }
  .more-badge {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    text-align: center;
    padding: 4px;
  }
</style>
</head>
<body>

<div id="root"></div>

<script>
const vscode = acquireVsCodeApi();

// State machine: idle | capturing | committing | committed
let state = 'idle';
let pending = [];
let recent = [];
let currentExp = null; // { id, fileName, suggestedCommit }

function fmt(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString([], {month:'short',day:'numeric'}) + ' ' +
         d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fileIcon(name) {
  const ext = name.split('.').pop()?.toLowerCase();
  const icons = { png:'🖼️', jpg:'🖼️', jpeg:'🖼️', svg:'🖼️', csv:'📊', parquet:'📦', ipynb:'📓', html:'🌐' };
  return icons[ext] || '📄';
}

function render() {
  const root = document.getElementById('root');

  if (state === 'committed') {
    root.innerHTML = '<div class="commit-success">✓ Committed ' + esc(currentExp?.hash || '') + '</div>' + renderCapturing() + renderRecent();
    return;
  }

  if (state === 'committing' && currentExp) {
    root.innerHTML = renderCommitPanel() + renderRecent();
    return;
  }

  if (state === 'capturing' && pending.length > 0) {
    root.innerHTML = renderCapturing() + renderRecent();
    return;
  }

  // idle
  root.innerHTML = renderIdle() + renderRecent();
}

function renderIdle() {
  if (pending.length === 0) {
    return '<div class="idle">' +
      '<div class="idle-icon">🔥</div>' +
      '<div class="idle-title">Bonfire lit</div>' +
      '<div class="idle-sub">When your script saves an output, rest here and record what you discovered.</div>' +
    '</div>';
  }
  return renderCapturing();
}

function renderCapturing() {
  if (pending.length === 0) return '';
  const p = pending[0];
  const more = pending.length > 1 ? '<div class="queue-count">+' + (pending.length-1) + ' more in queue</div>' : '';
  return more +
  '<div class="capture-card">' +
    '<div class="file-badge"><span class="icon">' + fileIcon(p.fileName) + '</span>' + esc(p.fileName) + '</div>' +
    (p.scriptName ? '<div class="script-from">from ' + esc(p.scriptName) + '</div>' : '') +
    '<label>What were you testing?</label>' +
    '<textarea id="ta-testing" placeholder="e.g. momentum factor on APAC equities, 12-month lookback" rows="2"></textarea>' +
    '<label>What did you find?</label>' +
    '<textarea id="ta-finding" placeholder="e.g. strong signal in large caps, noise in small caps" rows="2"></textarea>' +
    '<div class="btn-row">' +
      '<button class="btn btn-primary" onclick="saveAnnotation()">Engrave to stone →</button>' +
      '<button class="btn btn-ghost" onclick="dismiss()" title="Hollow this one">✕</button>' +
    '</div>' +
  '</div>';
}

function renderCommitPanel() {
  return '<div class="commit-panel">' +
    '<div class="commit-title"><span class="tick">✓</span> Etched into stone</div>' +
    '<div class="commit-hint">Suggested message for the annals — edit freely:</div>' +
    '<textarea class="commit-msg-input" id="commit-msg">' + esc(currentExp.suggestedCommit) + '</textarea>' +
    (currentExp.gitAvailable
      ? '<div class="btn-row"><button class="btn btn-green" onclick="doCommit()">Commit to the archive</button><button class="btn btn-secondary" onclick="skipCommit()">Leave for now</button></div>'
      : '<div class="commit-hint" style="color:var(--vscode-descriptionForeground)">No git repo — commit manually.</div><div class="btn-row"><button class="btn btn-secondary" onclick="skipCommit()">Done</button></div>'
    ) +
  '</div>';
}

function renderRecent() {
  if (recent.length === 0) return '';
  let html = '<div class="section-label">Previously discovered</div>';
  for (const exp of recent) {
    html += '<div class="recent-item">' +
      '<div class="recent-file">' + fileIcon(exp.outputName) + ' ' + esc(exp.outputName) + '</div>' +
      '<div class="recent-testing">Testing: ' + esc(exp.testing) + '</div>' +
      '<div class="recent-finding">→ ' + esc(exp.finding) + '</div>' +
      '<div class="recent-meta">' + fmt(exp.timestamp) +
        (exp.commitHash ? ' &nbsp;<span class="hash-badge">' + esc(exp.commitHash) + '</span>' : '') +
      '</div>' +
    '</div>';
  }
  return html;
}

function saveAnnotation() {
  const p = pending[0];
  if (!p) return;
  const testing = document.getElementById('ta-testing')?.value.trim();
  const finding = document.getElementById('ta-finding')?.value.trim();
  if (!testing && !finding) {
    // allow saving with empty fields — just dismiss
    dismiss(); return;
  }
  vscode.postMessage({ command: 'save', filePath: p.filePath, fileName: p.fileName, scriptName: p.scriptName, testing: testing || '(not noted)', finding: finding || '(not noted)' });
}

function dismiss() {
  const p = pending[0];
  if (!p) return;
  vscode.postMessage({ command: 'dismiss', filePath: p.filePath });
}

function doCommit() {
  const msg = document.getElementById('commit-msg')?.value.trim();
  if (!msg) return;
  vscode.postMessage({ command: 'commit', message: msg, experimentId: currentExp?.id });
}

function skipCommit() {
  vscode.postMessage({ command: 'skipCommit' });
}

window.addEventListener('message', e => {
  const msg = e.data;
  switch (msg.command) {
    case 'update':
      pending = msg.pending || [];
      recent = msg.recent || [];
      state = pending.length > 0 ? 'capturing' : 'idle';
      render();
      break;
    case 'saved':
      currentExp = { id: msg.experimentId, suggestedCommit: msg.suggestedCommit, gitAvailable: msg.gitAvailable, fileName: msg.fileName };
      state = 'committing';
      render();
      break;
    case 'committed':
      currentExp = { ...currentExp, hash: msg.hash };
      state = 'committed';
      render();
      break;
    case 'commitError':
      document.getElementById('root').insertAdjacentHTML('afterbegin',
        '<div class="commit-error">Git error: ' + esc(msg.error) + '</div>');
      break;
  }
});

vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
  }
}

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getExperimentsForWeek, getAvailableWeeks, getWeekKey, Experiment } from './store';

function toBase64(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const ext = path.extname(filePath).toLowerCase();
    const mime: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml'
    };
    if (!mime[ext]) return null;
    const buf = fs.readFileSync(filePath);
    if (buf.length > 8 * 1024 * 1024) return null; // skip >8MB
    return `data:${mime[ext]};base64,${buf.toString('base64')}`;
  } catch { return null; }
}

function weekDateRange(weekKey: string): string {
  const [yearStr, wStr] = weekKey.split('-W');
  const year = parseInt(yearStr), w = parseInt(wStr);
  const jan1 = new Date(year, 0, 1);
  const startOfWeek = new Date(jan1.getTime() + ((w - 1) * 7 - jan1.getDay() + 1) * 86400000);
  const endOfWeek = new Date(startOfWeek.getTime() + 6 * 86400000);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(startOfWeek)} – ${fmt(endOfWeek)}, ${year}`;
}

function fmtDatetime(ts: number): string {
  return new Date(ts).toLocaleString('en-GB', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function extIcon(name: string): string {
  const ext = path.extname(name).toLowerCase();
  const map: Record<string, string> = { '.png': '🖼️', '.jpg': '🖼️', '.jpeg': '🖼️', '.svg': '🖼️', '.csv': '📊', '.parquet': '📦', '.ipynb': '📓', '.html': '🌐' };
  return map[ext] || '📄';
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isImage(name: string): boolean {
  return ['.png', '.jpg', '.jpeg', '.svg'].includes(path.extname(name).toLowerCase());
}

export function buildReport(weekKey?: string): string {
  const wk = weekKey ?? getWeekKey();
  const experiments = getExperimentsForWeek(wk);
  const dateRange = weekDateRange(wk);

  const imgExperiments = experiments.filter(e => isImage(e.outputName));
  const dataExperiments = experiments.filter(e => !isImage(e.outputName));

  // Group by day for timeline
  const byDay: Record<string, Experiment[]> = {};
  for (const exp of experiments) {
    const day = new Date(exp.timestamp).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(exp);
  }

  const chartCards = imgExperiments.map(exp => {
    const b64 = toBase64(exp.outputFile);
    const imgTag = b64
      ? `<img src="${b64}" alt="${esc(exp.outputName)}" />`
      : `<div class="no-img">Image not found on disk</div>`;
    return `
      <div class="exp-card">
        <div class="exp-header">
          <span class="exp-file">${extIcon(exp.outputName)} ${esc(exp.outputName)}</span>
          <span class="exp-time">${fmtDatetime(exp.timestamp)}</span>
        </div>
        ${exp.scriptName ? `<div class="exp-script">from ${esc(exp.scriptName)}</div>` : ''}
        <div class="exp-img-wrap">${imgTag}</div>
        <div class="exp-annotations">
          <div class="ann-row">
            <span class="ann-label">Testing</span>
            <span class="ann-val">${esc(exp.testing)}</span>
          </div>
          <div class="ann-row finding">
            <span class="ann-label">Finding</span>
            <span class="ann-val">${esc(exp.finding)}</span>
          </div>
        </div>
        ${exp.commitHash ? `<div class="commit-ref">🔀 ${esc(exp.commitHash)}</div>` : ''}
      </div>`;
  }).join('');

  const dataRows = dataExperiments.map(exp => `
    <tr>
      <td class="td-file">${extIcon(exp.outputName)} ${esc(exp.outputName)}</td>
      <td>${esc(exp.testing)}</td>
      <td class="td-finding">${esc(exp.finding)}</td>
      <td class="td-time">${new Date(exp.timestamp).toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short'})}</td>
    </tr>`).join('');

  const timelineHtml = Object.entries(byDay).map(([day, exps]) => `
    <div class="timeline-day">
      <div class="timeline-date">${day}</div>
      ${exps.map(exp => `
        <div class="timeline-item">
          <div class="tl-dot"></div>
          <div class="tl-body">
            <div class="tl-file">${extIcon(exp.outputName)} ${esc(exp.outputName)}</div>
            <div class="tl-testing">${esc(exp.testing)}</div>
            <div class="tl-arrow">→ ${esc(exp.finding)}</div>
          </div>
        </div>`).join('')}
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Research Summary — ${esc(dateRange)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
    font-size: 13px;
    color: #111827;
    background: #f3f4f6;
  }
  .page { max-width: 960px; margin: 0 auto; padding: 36px 24px 64px; }

  /* Header */
  .report-header {
    margin-bottom: 32px;
    padding-bottom: 20px;
    border-bottom: 2px solid #e5e7eb;
  }
  .report-label { font-size: 11px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
  .report-title { font-size: 26px; font-weight: 700; color: #111827; letter-spacing: -0.5px; }
  .report-sub { font-size: 13px; color: #6b7280; margin-top: 6px; }

  /* Section headings */
  .section { margin-bottom: 36px; }
  .section-title {
    font-size: 15px;
    font-weight: 700;
    color: #111827;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-title .count {
    background: #e5e7eb;
    color: #374151;
    font-size: 11px;
    font-weight: 600;
    padding: 1px 8px;
    border-radius: 20px;
  }

  /* Chart cards */
  .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 20px; }
  .exp-card {
    background: white;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
    display: flex;
    flex-direction: column;
  }
  .exp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px 6px;
    gap: 8px;
  }
  .exp-file { font-size: 12px; font-weight: 700; color: #111827; }
  .exp-time { font-size: 10px; color: #9ca3af; white-space: nowrap; }
  .exp-script { font-size: 10px; color: #9ca3af; padding: 0 14px 8px; }
  .exp-img-wrap {
    background: #f9fafb;
    border-top: 1px solid #f3f4f6;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    max-height: 320px;
    overflow: hidden;
  }
  .exp-img-wrap img { max-width: 100%; max-height: 320px; object-fit: contain; }
  .no-img { color: #9ca3af; font-size: 11px; padding: 32px; text-align: center; }
  .exp-annotations { padding: 12px 14px; flex: 1; }
  .ann-row { display: flex; gap: 8px; margin-bottom: 5px; align-items: baseline; }
  .ann-row.finding { margin-bottom: 0; }
  .ann-label {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #9ca3af;
    flex-shrink: 0;
    width: 52px;
  }
  .ann-val { font-size: 12px; color: #374151; line-height: 1.5; }
  .finding .ann-val { color: #111827; font-weight: 500; }
  .commit-ref { font-size: 10px; color: #9ca3af; padding: 6px 14px 10px; font-family: monospace; }

  /* Data outputs table */
  .data-table { width: 100%; border-collapse: collapse; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .data-table th { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; text-align: left; padding: 10px 14px; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
  .data-table td { padding: 10px 14px; border-bottom: 1px solid #f3f4f6; font-size: 12px; vertical-align: top; }
  .data-table tr:last-child td { border-bottom: none; }
  .td-file { font-weight: 600; color: #111827; white-space: nowrap; }
  .td-finding { color: #111827; font-weight: 500; }
  .td-time { color: #9ca3af; white-space: nowrap; font-size: 11px; }

  /* Timeline */
  .timeline { padding-left: 8px; }
  .timeline-day { margin-bottom: 20px; }
  .timeline-date { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; margin-bottom: 10px; }
  .timeline-item { display: flex; gap: 12px; margin-bottom: 10px; }
  .tl-dot { width: 8px; height: 8px; background: #d1d5db; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
  .tl-body { background: white; border-radius: 6px; padding: 8px 12px; flex: 1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
  .tl-file { font-size: 11px; font-weight: 700; color: #111827; margin-bottom: 2px; }
  .tl-testing { font-size: 11px; color: #6b7280; }
  .tl-arrow { font-size: 11px; color: #111827; font-weight: 500; margin-top: 2px; }

  .empty { text-align: center; padding: 48px 24px; color: #9ca3af; font-size: 13px; line-height: 1.8; background: white; border-radius: 10px; }

  @media print {
    body { background: white; }
    .page { padding: 16px; }
    .exp-card { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

  <div class="report-header">
    <div class="report-label">Quant's Bonfire — Weekly Research Report</div>
    <div class="report-title">${esc(dateRange)}</div>
    <div class="report-sub">${experiments.length} experiment${experiments.length !== 1 ? 's' : ''} recorded this week</div>
  </div>

  ${experiments.length === 0 ? `
    <div class="empty">
      No experiments recorded for this week.<br>
      Annotate your next run to have it appear here.
    </div>` : ''}

  ${imgExperiments.length > 0 ? `
  <div class="section">
    <div class="section-title">📈 Visual Outputs <span class="count">${imgExperiments.length}</span></div>
    <div class="cards-grid">${chartCards}</div>
  </div>` : ''}

  ${dataExperiments.length > 0 ? `
  <div class="section">
    <div class="section-title">📦 Data Outputs <span class="count">${dataExperiments.length}</span></div>
    <table class="data-table">
      <thead><tr><th>File</th><th>Hypothesis / Test</th><th>Finding</th><th>Date</th></tr></thead>
      <tbody>${dataRows}</tbody>
    </table>
  </div>` : ''}

  ${Object.keys(byDay).length > 0 ? `
  <div class="section">
    <div class="section-title">📅 Research Activity</div>
    <div class="timeline">${timelineHtml}</div>
  </div>` : ''}

</div>
</body>
</html>`;
}

export class ReportViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'quants-bonfire.report';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getShellHtml();

    webviewView.webview.onDidReceiveMessage(msg => {
      if (msg.command === 'open') this.openFullReport(msg.weekKey || undefined);
    });

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this._sendWeeks();
    });
    this._sendWeeks();
  }

  private _sendWeeks() {
    const weeks = getAvailableWeeks();
    this._view?.webview.postMessage({ command: 'weeks', weeks, current: getWeekKey() });
  }

  public openFullReport(weekKey?: string) {
    const wk = weekKey ?? getWeekKey();
    const html = buildReport(wk);
    const panel = vscode.window.createWebviewPanel(
      'quants-bonfire-report',
      `Research Summary — ${weekDateRange(wk)}`,
      vscode.ViewColumn.One,
      { enableScripts: false }
    );
    panel.webview.html = html;
  }

  private _getShellHtml(): string {
    return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--vscode-font-family); font-size: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); padding: 12px; }
  p { font-size: 11px; color: var(--vscode-descriptionForeground); line-height: 1.6; margin-bottom: 10px; }
  select { width: 100%; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, #555); padding: 5px 8px; border-radius: 4px; font-size: 12px; margin-bottom: 10px; }
  button { width: 100%; padding: 7px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
  button:hover { opacity: 0.9; }
</style>
</head>
<body>
<p>Generate a weekly research report summarising your experiments, charts, and findings.</p>
<select id="sel"><option value="">This week</option></select>
<button onclick="open_()">📊 Open Weekly Report</button>
<script>
const vscode = acquireVsCodeApi();
function open_() {
  const v = document.getElementById('sel').value;
  vscode.postMessage({ command: 'open', weekKey: v || null });
}
window.addEventListener('message', e => {
  if (e.data.command === 'weeks') {
    const sel = document.getElementById('sel');
    sel.innerHTML = '<option value="">This week</option>';
    for (const w of e.data.weeks) {
      const cur = w === e.data.current ? ' (current)' : '';
      sel.innerHTML += '<option value="' + w + '">' + w + cur + '</option>';
    }
  }
});
</script>
</body></html>`;
  }
}

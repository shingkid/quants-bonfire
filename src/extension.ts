import * as vscode from 'vscode';
import * as fs from 'fs';
import { initStore } from './store';
import { startOutputWatcher, startTerminalWatcher } from './watchers';
import { CaptureViewProvider } from './captureView';
import { ReportViewProvider } from './reportView';

export function activate(context: vscode.ExtensionContext) {
  // Init store
  const storagePath = context.globalStorageUri.fsPath;
  if (!fs.existsSync(storagePath)) fs.mkdirSync(storagePath, { recursive: true });
  initStore(storagePath);

  // Register views
  const captureProvider = new CaptureViewProvider(context.extensionUri);
  const reportProvider  = new ReportViewProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(CaptureViewProvider.viewType, captureProvider),
    vscode.window.registerWebviewViewProvider(ReportViewProvider.viewType, reportProvider)
  );

  // Start watching for output files
  const outputWatcher = startOutputWatcher((_filePath, _fileName) => {
    // New output detected — nudge the capture panel into focus
    captureProvider.nudge();
  });
  context.subscriptions.push(outputWatcher);

  // Track last-run python script
  const terminalWatcher = startTerminalWatcher();
  context.subscriptions.push(terminalWatcher);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('quants-bonfire.openReport', () => {
      reportProvider.openFullReport();
    }),
    vscode.commands.registerCommand('quants-bonfire.toggleProfessionalMode', async () => {
      const config = vscode.workspace.getConfiguration('quantsBonfire');
      const current = config.get<boolean>('professionalMode', false);
      await config.update('professionalMode', !current, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        !current ? "Quant's Bonfire: professional mode on." : "Quant's Bonfire: themed mode on."
      );
    }),
    vscode.commands.registerCommand('quants-bonfire.clearLog', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all recorded experiments? This cannot be undone.',
        'Clear', 'Cancel'
      );
      if (confirm === 'Clear') {
        const { clearAll } = require('./store');
        clearAll();
        vscode.window.showInformationMessage("All experiments cleared.");
      }
    })
  );

  vscode.window.showInformationMessage("🔥 Quant's Bonfire is lit — your discoveries will be remembered.");
}

export function deactivate() {}

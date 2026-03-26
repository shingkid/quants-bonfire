import * as cp from 'child_process';
import * as vscode from 'vscode';

function cwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export function buildCommitMessage(
  outputName: string,
  scriptName: string | undefined,
  testing: string,
  finding: string
): string {
  // Format: "Add <output> [from <script>]: <testing> → <finding>"
  const source = scriptName ? ` from ${scriptName}` : '';
  const testSnip = testing.length > 60 ? testing.slice(0, 57) + '...' : testing;
  const findSnip = finding.length > 60 ? finding.slice(0, 57) + '...' : finding;
  return `Add ${outputName}${source}: ${testSnip} → ${findSnip}`;
}

export async function getGitStatus(): Promise<string> {
  return new Promise(resolve => {
    const dir = cwd();
    if (!dir) { resolve(''); return; }
    cp.exec('git status --short', { cwd: dir }, (err, stdout) => {
      resolve(err ? '' : stdout.trim());
    });
  });
}

export async function runGitCommit(message: string): Promise<{ success: boolean; hash: string; error?: string }> {
  const dir = cwd();
  if (!dir) return { success: false, hash: '', error: 'No workspace folder open.' };

  return new Promise(resolve => {
    // Stage all changes, then commit
    cp.exec('git add -A', { cwd: dir }, (err) => {
      if (err) {
        resolve({ success: false, hash: '', error: err.message });
        return;
      }
      cp.exec(`git commit -m ${JSON.stringify(message)}`, { cwd: dir }, (err2, stdout) => {
        if (err2) {
          resolve({ success: false, hash: '', error: err2.message });
          return;
        }
        // Extract short hash from output like "[main abc1234] ..."
        const hashMatch = stdout.match(/\[[\w/]+ ([a-f0-9]+)\]/);
        resolve({ success: true, hash: hashMatch?.[1] ?? '' });
      });
    });
  });
}

export async function isGitRepo(): Promise<boolean> {
  const dir = cwd();
  if (!dir) return false;
  return new Promise(resolve => {
    cp.exec('git rev-parse --is-inside-work-tree', { cwd: dir }, (err) => resolve(!err));
  });
}

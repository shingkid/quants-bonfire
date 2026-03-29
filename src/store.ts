import * as fs from 'fs';
import * as path from 'path';

export interface Experiment {
  id: string;           // timestamp-based unique id
  timestamp: number;
  outputFile: string;   // absolute path
  outputName: string;   // basename
  scriptName?: string;  // last python script run before this output appeared
  testing: string;      // "what were you testing?"
  finding: string;      // "what did you find?"
  commitHash?: string;  // filled in after commit
  weekKey: string;      // "YYYY-MM-DD" — date of the week's start day
}

export interface PendingOutput {
  filePath: string;
  fileName: string;
  detectedAt: number;
  scriptName?: string;
}

interface Store {
  experiments: Experiment[];
  pending: PendingOutput[];   // outputs waiting to be annotated
  lastScript?: string;        // most recent python script run
}

let storePath = '';
let data: Store = { experiments: [], pending: [] };
let weekStartDay = 1; // 0=Sun … 6=Sat; 1=Monday is the default

export function setWeekStartDay(day: number): void {
  weekStartDay = day;
}

export function initStore(globalStoragePath: string): void {
  if (!fs.existsSync(globalStoragePath)) {
    fs.mkdirSync(globalStoragePath, { recursive: true });
  }
  storePath = path.join(globalStoragePath, 'quants-bonfire.json');
  if (fs.existsSync(storePath)) {
    try { data = JSON.parse(fs.readFileSync(storePath, 'utf8')); }
    catch { data = { experiments: [], pending: [] }; }
  }
  if (!data.pending) data.pending = [];
}

function save(): void {
  if (storePath) fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
}

export function getWeekKey(ts: number = Date.now()): string {
  const d = new Date(ts);
  const diff = (d.getDay() - weekStartDay + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - diff);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── Pending outputs (awaiting annotation) ─────────────────────────────────────

export function addPending(output: PendingOutput): void {
  // Don't duplicate
  if (data.pending.find(p => p.filePath === output.filePath)) return;
  data.pending.unshift(output);
  if (data.pending.length > 20) data.pending = data.pending.slice(0, 20);
  save();
}

export function getPending(): PendingOutput[] {
  return data.pending;
}

export function dismissPending(filePath: string): void {
  data.pending = data.pending.filter(p => p.filePath !== filePath);
  save();
}

// ── Experiments ────────────────────────────────────────────────────────────────

export function saveExperiment(exp: Omit<Experiment, 'id' | 'weekKey'>): Experiment {
  const full: Experiment = {
    ...exp,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    weekKey: getWeekKey(exp.timestamp)
  };
  data.experiments.unshift(full);
  // Remove from pending
  data.pending = data.pending.filter(p => p.filePath !== exp.outputFile);
  save();
  return full;
}

export function updateCommitHash(experimentId: string, hash: string): void {
  const exp = data.experiments.find(e => e.id === experimentId);
  if (exp) { exp.commitHash = hash; save(); }
}

export function getExperimentsForWeek(weekKey?: string): Experiment[] {
  const wk = weekKey ?? getWeekKey();
  return data.experiments.filter(e => e.weekKey === wk).sort((a, b) => a.timestamp - b.timestamp);
}

export function getAllExperiments(): Experiment[] {
  return [...data.experiments].sort((a, b) => b.timestamp - a.timestamp);
}

export function getAvailableWeeks(): string[] {
  return [...new Set(data.experiments.map(e => e.weekKey))].sort().reverse();
}

// ── Last script tracking ───────────────────────────────────────────────────────

export function setLastScript(name: string): void {
  data.lastScript = name;
  save();
}

export function getLastScript(): string | undefined {
  return data.lastScript;
}

export function clearAll(): void {
  data = { experiments: [], pending: [] };
  save();
}

# 🔥 Quant's Bonfire

> *"Try resting at a bonfire."*

A VS Code extension for quant researchers. Captures what you discovered the moment you discover it — so nothing is lost to the fog of war.

No scheduled check-ins. No dashboards. No admin overhead. Just rest at the bonfire after each run.

---

## How it works

1. **Your script saves an output** — a chart, CSV, or parquet file appears in your workspace
2. **The Bonfire stirs** — the sidebar opens automatically with two fields:
   - *What were you testing?*
   - *What did you find?*
3. **A commit message is forged** from your words — edit it if you like, then click **"Commit to the archive"**
4. **End of week** — click **"Unfurl Lore Scroll"** for a clean HTML report: all your charts captioned with your findings, ready to present

---

## Screenshots

> *(Add screenshots here once installed)*

---

## Installation

### From VSIX (easiest)

1. Download the latest `.vsix` from [Releases](../../releases)
2. In VS Code: `Ctrl+Shift+P` → **"Extensions: Install from VSIX..."**
3. Select the downloaded file and reload

### Build from source

Requirements: [Node.js](https://nodejs.org/) 18+, [VS Code](https://code.visualstudio.com/) 1.85+

```bash
git clone https://github.com/YOUR_USERNAME/quants-bonfire.git
cd quants-bonfire

# Install dependencies
npm install

# Compile TypeScript → JavaScript
npm run compile

# Package into a .vsix
npm run package
```

This produces `quants-bonfire-<version>.vsix` in the project root. Install it as above.

---

## The two panels

### 🔥 Kindle the Flame
The capture panel. Opens automatically when a new output file is detected.

- Two annotation fields — takes ~10 seconds to fill
- Click **"Engrave to stone →"** to save
- A pre-built commit message appears — edit inline, then **"Commit to the archive"** or **"Leave for now"**
- Dismiss individual outputs with **✕** ("Hollow this one") if they're not worth noting
- Last 5 discoveries shown below under "Previously discovered"

### 📜 Lore Scroll
The weekly report panel.

- Select a week from the dropdown (defaults to current week)
- Click **"Unfurl Lore Scroll"** to open the full-page HTML report
- Report sections:
  - **Visions & Discoveries** — charts/images embedded with your annotations as captions
  - **Gathered Loot** — CSV/parquet outputs in a table (what you tested, what you found, date)
  - **Journey This Week** — chronological timeline of all experiments
- Print to PDF (`Ctrl+P`) or screenshot for your PM meeting

---

## Configuration

`Ctrl+,` → search **"Quant's Bonfire"**

| Setting | Default | Description |
|---|---|---|
| `quantsBonfire.outputExtensions` | `.csv .parquet .png .jpg .jpeg .svg .html .ipynb` | File types that trigger the annotation prompt |
| `quantsBonfire.ignorePaths` | `node_modules .git __pycache__ .venv venv` | Paths to ignore when watching |
| `quantsBonfire.professionalMode` | `false` | When `true`, generated reports use plain professional language with no themed terminology — useful when sharing with stakeholders who find the Dark Souls flavour distracting. Reload VS Code after changing. |

---

## Notes

- **Run scripts from the VS Code integrated terminal** (`Ctrl+\``) — this is how the extension detects which `.py` file was run and associates it with the output
- **Git commit assist** requires the workspace to be inside a git repo. The extension runs `git add -A` before committing — if you want selective staging, use "Leave for now" and commit manually
- Output files smaller than 512 bytes are ignored (avoids noise from temp/lock files)

---

## Data storage

All data is stored locally in a JSON file — nothing leaves your machine.

```
Windows:  %APPDATA%\Code\User\globalStorage\quants-bonfire\quants-bonfire.json
macOS:    ~/Library/Application Support/Code/User/globalStorage/quants-bonfire/quants-bonfire.json
Linux:    ~/.config/Code/User/globalStorage/quants-bonfire/quants-bonfire.json
```

To wipe all data: `Ctrl+Shift+P` → **"Quant's Bonfire: Clear All Experiments"**

---

## Project structure

```
quants-bonfire/
├── src/
│   ├── extension.ts      # Entry point — activates watchers and registers views
│   ├── store.ts          # JSON-based persistence (experiments + pending queue)
│   ├── watchers.ts       # File system watcher + terminal shell integration listener
│   ├── git.ts            # Git helpers (status check, commit message builder, runner)
│   ├── captureView.ts    # "Kindle the Flame" sidebar webview
│   └── reportView.ts     # "Lore Scroll" sidebar + full HTML report generator
├── media/
│   └── icon.svg          # Activity bar icon (bonfire flame)
├── package.json          # Extension manifest — commands, views, config schema
├── tsconfig.json         # TypeScript compiler config
├── .vscodeignore         # Files excluded from the packaged VSIX
└── .gitignore
```

---

## Releases

Releases are automated via GitHub Actions. The workflow is:

1. **Bump the version** in `package.json` following [semver](https://semver.org/):
   - `patch` (0.1.**x**) — bug fixes, no new behaviour
   - `minor` (0.**x**.0) — new features, backwards compatible
   - `major` (**x**.0.0) — breaking changes

   The quickest way is `npm version patch|minor|major`, which edits `package.json`,
   commits the change, and creates a local tag in one step.

2. **Push to `main`** (with tags if you used `npm version`):
   ```bash
   git push --follow-tags origin main
   ```

3. **CI takes over** — `auto-tag.yml` detects the new version in `package.json` and
   creates the `v<version>` tag if it does not already exist. The `release.yml` workflow
   then fires on that tag, compiles TypeScript, packages the VSIX, and attaches it to a
   new GitHub Release.

Users download the `.vsix` from the [Releases](../../releases) page and install via
**Extensions: Install from VSIX…** in VS Code.

---

## Contributing

Pull requests welcome. A few things worth knowing about the codebase:

- **No runtime dependencies** — the extension uses only VS Code's built-in APIs and Node.js stdlib. No npm packages are bundled into the VSIX.
- **State machine in `captureView.ts`** — the capture panel has four states: `idle → capturing → committing → committed`. All rendering is done via `innerHTML` from JS string templates (no framework).
- **Report is pure HTML** — `reportView.ts` generates a self-contained HTML string with base64-embedded images. No external dependencies, works offline, printable.
- **`store.ts` is the single source of truth** — all persistence goes through it. Swapping the JSON backend for SQLite or similar would only require changes here.

---

## Roadmap ideas

- [ ] Tag experiments with custom labels (e.g. "momentum", "mean-reversion")
- [ ] Export Lore Scroll as PDF directly from the extension
- [ ] Search/filter past experiments by keyword
- [ ] Support for Jupyter notebook output cells as trigger events

---

## License

MIT — see [LICENSE](LICENSE)

---

*You died. But your findings were remembered.*

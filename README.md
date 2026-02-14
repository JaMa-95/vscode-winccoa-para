# WinCC OA PARA - VS Code Extension

A VS Code extension that recreates the WinCC OA PARA module, providing a graphical interface for browsing and editing datapoint types (DPTs), datapoints (DPs), and their configurations.

## Features

- **Unified Tree View**: Browse DPTs, their DP instances, and element hierarchies in a single tree
  - DPT (symbol-class) -> DP instances (database) -> element tree (struct/field)
  - Click on leaf elements to open the config editor
- **Config Editor Webview**: View all configurations for a datapoint element
  - Current value with timestamp, status, and type info
  - Address, alert handling, archive, PV range, smoothing, distribution configs
- **Value Setting**: Set datapoint values through the WinCC OA event manager via the MCP HTTP server
- **Project Auto-Detection**: Automatically connects to WinCC OA projects via:
  1. Extension settings (`winccoa-para.projectPath`)
  2. `winccoa-project-admin` extension API
  3. Workspace folder detection

## Architecture

```
VS Code Extension
  |
  |-- SQLite (read-only) -------> ident.sqlite    (DPTs, elements, DPs)
  |                                config.sqlite   (address, alert, archive, ...)
  |                                last_value.sqlite (current values)
  |
  |-- MCP HTTP Client (write) --> MCP HTTP Server --> WinCC OA Event Manager
                                  (localhost:3001)
```

- **Reading**: All data is read from SQLite databases at `{projectDir}/db/wincc_oa/sqlite/`
- **Writing**: Values are set through the WinCC OA MCP HTTP server, which routes them through the event manager. Direct SQLite writes do not propagate to the WinCC OA runtime.

## Prerequisites

- VS Code 1.85+
- A running WinCC OA project with SQLite databases
- WinCC OA MCP HTTP server running (for value setting)
- [winccoa-project-admin](https://marketplace.visualstudio.com/items?itemName=RichardJanisch.winccoa-project-admin) extension (optional, for auto-detection)

## Build & Install

```bash
# Install dependencies
npm install

# Rebuild native modules for VS Code's Electron
npm run rebuild

# Compile
npm run compile

# Package as .vsix
npx vsce package --no-dependencies

# Install in VS Code
code --install-extension vscode-winccoa-para-0.1.0.vsix
```

## Development

```bash
# Watch mode (auto-recompile on changes)
npm run watch

# Then press F5 in VS Code to launch Extension Development Host
```

## TODO

- [ ] DPT editor webview (edit element tree structure of a datapoint type)
- [ ] Create/delete datapoints and datapoint types
- [ ] Config editing (address, alert handling, archive, etc.)
- [ ] Search/filter in tree view
- [ ] Multi-language support for display names
- [ ] Drag & drop for element reordering in DPT editor
- [ ] File watcher for SQLite database changes (auto-refresh)
- [ ] Support for distributed systems (multi-system queries)

## License

MIT

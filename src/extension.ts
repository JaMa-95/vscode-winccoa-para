import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SqliteClient } from './db/sqliteClient';
import { DptTreeProvider } from './providers/dptTreeProvider';
import { ConfigEditorPanel } from './providers/configEditorProvider';
import { McpClient } from './api/mcpClient';

let sqliteClient: SqliteClient;
let dptTreeProvider: DptTreeProvider;
let mcpClient: McpClient;

// Debug output channel
const log = vscode.window.createOutputChannel('WinCC OA PARA', { log: true });

const PROJECT_ADMIN_IDS = [
  'RichardJanisch.winccoa-project-admin',
  'winccoa-tools-pack.winccoa-project-admin',
];

export function activate(context: vscode.ExtensionContext) {
  log.info('=== WinCC OA PARA extension activating ===');

  sqliteClient = new SqliteClient();
  mcpClient = new McpClient();
  dptTreeProvider = new DptTreeProvider(sqliteClient);

  // Register tree views
  log.info('Registering tree views...');
  context.subscriptions.push(
    vscode.window.createTreeView('winccoa-para.dptView', {
      treeDataProvider: dptTreeProvider,
      showCollapseAll: true,
    }),
  );
  log.info('Tree views registered');

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('winccoa-para.refreshDptTree', () => {
      log.info('Command: refreshDptTree');
      dptTreeProvider.refresh();
    }),
    vscode.commands.registerCommand('winccoa-para.selectProject', () => selectProject()),
    vscode.commands.registerCommand('winccoa-para.openConfigEditor', (item) => {
      log.info(`Command: openConfigEditor, item=${JSON.stringify(item?.label)}, dpId=${item?.dpId}, elId=${item?.elId}`);
      if (item && item.dpId !== undefined && item.elId !== undefined) {
        openConfigEditor(item.dpId, item.elId, item.label, context.extensionUri);
      }
    }),
  );
  log.info('Commands registered');

  // Auto-detect project (async: waits for project-admin if needed)
  initProjectConnection(context);

  log.info('=== WinCC OA PARA extension activate() done ===');
}

export function deactivate() {
  log.info('WinCC OA PARA deactivating');
  sqliteClient?.close();
}

function findProjectAdminExtension(): vscode.Extension<ProjectAdminApi> | undefined {
  for (const id of PROJECT_ADMIN_IDS) {
    const ext = vscode.extensions.getExtension<ProjectAdminApi>(id);
    if (ext) {
      log.info(`Found project-admin extension: ${id} (active=${ext.isActive})`);
      return ext;
    }
  }

  // Debug: list all winccoa extensions
  const allExts = vscode.extensions.all
    .filter(e => e.id.toLowerCase().includes('winccoa'))
    .map(e => `  ${e.id} (active=${e.isActive})`);
  log.info(`WinCC OA extensions found:\n${allExts.length > 0 ? allExts.join('\n') : '  (none)'}`);
  log.warn('project-admin extension not found under any known ID');
  return undefined;
}

interface ProjectAdminApi {
  getCurrentProject(): { projectDir: string } | undefined;
  onDidChangeProject(listener: (project: { projectDir: string } | undefined) => void): () => void;
}

async function getProjectAdminApi(): Promise<ProjectAdminApi | undefined> {
  const ext = findProjectAdminExtension();
  if (!ext) return undefined;

  if (!ext.isActive) {
    log.info('project-admin not active yet, waiting for activation...');
    try {
      const api = await ext.activate();
      log.info(`project-admin activated, exports: ${JSON.stringify(Object.keys(api || {}))}`);
      return api;
    } catch (err) {
      log.error(`Failed to activate project-admin: ${err}`);
      return undefined;
    }
  }

  const api = ext.exports;
  log.info(`project-admin exports: ${JSON.stringify(Object.keys(api || {}))}`);
  return api;
}

function listenToProjectAdmin(context: vscode.ExtensionContext, api: ProjectAdminApi): void {
  if (!api.onDidChangeProject) {
    log.warn('project-admin API has no onDidChangeProject method');
    return;
  }

  log.info('Subscribing to onDidChangeProject event');
  const dispose = api.onDidChangeProject((project) => {
    log.info(`onDidChangeProject fired! project=${JSON.stringify(project)}`);
    if (project?.projectDir) {
      connectToProject(project.projectDir);
    } else {
      log.warn('onDidChangeProject: no projectDir in event');
    }
  });

  context.subscriptions.push({ dispose });
  log.info('project-admin listener registered');
}

async function initProjectConnection(context: vscode.ExtensionContext): Promise<void> {
  log.info('--- initProjectConnection start ---');

  // 1. Check extension setting
  const configPath = vscode.workspace.getConfiguration('winccoa-para').get<string>('projectPath');
  log.info(`Step 1 - Extension setting winccoa-para.projectPath: "${configPath || ''}"`);
  if (configPath && configPath.trim() !== '') {
    log.info(`Using project path from settings: ${configPath}`);
    connectToProject(configPath);
    // Still set up listener for future changes
    const api = await getProjectAdminApi();
    if (api) listenToProjectAdmin(context, api);
    return;
  }

  // 2. Try to get current project from winccoa-project-admin (wait for it to activate)
  log.info('Step 2 - Checking project-admin API (will wait for activation)...');
  const api = await getProjectAdminApi();
  if (api) {
    // Always subscribe to changes
    listenToProjectAdmin(context, api);

    if (api.getCurrentProject) {
      const project = api.getCurrentProject();
      log.info(`project-admin getCurrentProject() returned: ${JSON.stringify(project)}`);
      if (project?.projectDir) {
        log.info(`Using project from project-admin: ${project.projectDir}`);
        connectToProject(project.projectDir);
        return;
      } else {
        log.info('project-admin has no current project selected yet (will connect when user selects one)');
      }
    }
  }

  // 3. Check workspace folders for WinCC OA project structure
  const workspaceFolders = vscode.workspace.workspaceFolders;
  log.info(`Step 3 - Workspace folders: ${workspaceFolders?.map(f => f.uri.fsPath).join(', ') || '(none)'}`);
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const sqlitePath = path.join(folder.uri.fsPath, 'db', 'wincc_oa', 'sqlite', 'ident.sqlite');
      const exists = fs.existsSync(sqlitePath);
      log.info(`  Checking ${sqlitePath} -> exists=${exists}`);
      if (exists) {
        log.info(`Using project from workspace folder: ${folder.uri.fsPath}`);
        connectToProject(folder.uri.fsPath);
        return;
      }
    }
  }

  log.warn('--- initProjectConnection: no project found (waiting for onDidChangeProject event) ---');
}

function connectToProject(projectPath: string): void {
  log.info(`connectToProject("${projectPath}")`);
  const sqliteDir = path.join(projectPath, 'db', 'wincc_oa', 'sqlite');
  const identPath = path.join(sqliteDir, 'ident.sqlite');

  log.info(`Checking SQLite dir: ${sqliteDir}`);
  log.info(`  dir exists: ${fs.existsSync(sqliteDir)}`);
  log.info(`  ident.sqlite exists: ${fs.existsSync(identPath)}`);
  log.info(`  config.sqlite exists: ${fs.existsSync(path.join(sqliteDir, 'config.sqlite'))}`);
  log.info(`  last_value.sqlite exists: ${fs.existsSync(path.join(sqliteDir, 'last_value.sqlite'))}`);

  if (!fs.existsSync(identPath)) {
    const msg = `WinCC OA SQLite database not found at: ${identPath}`;
    log.error(msg);
    vscode.window.showErrorMessage(msg);
    return;
  }

  try {
    sqliteClient.open(projectPath);
    log.info(`SQLite databases opened successfully, isOpen=${sqliteClient.isOpen}`);

    // Test queries
    const dpTypes = sqliteClient.getAllDpTypes();
    log.info(`DPT count: ${dpTypes.length}`);
    if (dpTypes.length > 0) {
      log.info(`  First 5 DPTs: ${dpTypes.slice(0, 5).map(d => d.canonical_name).join(', ')}`);
    }

    const datapoints = sqliteClient.getAllDatapoints();
    log.info(`DP count: ${datapoints.length}`);
    if (datapoints.length > 0) {
      log.info(`  First 5 DPs: ${datapoints.slice(0, 5).map(d => d.canonical_name).join(', ')}`);
    }

    dptTreeProvider.refresh();
    log.info('Tree provider refreshed');

    // Configure MCP client for value setting
    const mcpConfigured = mcpClient.configure(projectPath);
    if (mcpConfigured) {
      mcpClient.checkHealth().then(healthy => {
        if (healthy) {
          log.info('MCP HTTP server is reachable - value setting enabled');
        } else {
          log.warn('MCP HTTP server configured but not reachable - value setting will be unavailable');
        }
      });
    }

    vscode.window.showInformationMessage(`WinCC OA PARA: Connected to ${path.basename(projectPath)} (${dpTypes.length} DPTs, ${datapoints.length} DPs)`);
  } catch (err) {
    log.error(`Failed to open SQLite databases: ${err}`);
    vscode.window.showErrorMessage(`Failed to open SQLite databases: ${err}`);
  }
}

async function selectProject(): Promise<void> {
  log.info('Command: selectProject');
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select WinCC OA Project',
    title: 'Select WinCC OA Project Directory',
  });

  if (result && result.length > 0) {
    const projectPath = result[0].fsPath;
    log.info(`User selected project: ${projectPath}`);
    connectToProject(projectPath);
    await vscode.workspace.getConfiguration('winccoa-para').update('projectPath', projectPath, vscode.ConfigurationTarget.Global);
  } else {
    log.info('User cancelled project selection');
  }
}

function openConfigEditor(dpId: number, elId: number, label: string, extensionUri: vscode.Uri): void {
  if (!sqliteClient.isOpen) {
    log.warn('openConfigEditor: no project connected');
    vscode.window.showWarningMessage('No WinCC OA project connected.');
    return;
  }

  ConfigEditorPanel.show(sqliteClient, dpId, elId, label, extensionUri, mcpClient);
}

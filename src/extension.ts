import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SqliteClient } from './db/sqliteClient';
import { DptTreeProvider } from './providers/dptTreeProvider';
import { DpTreeProvider } from './providers/dpTreeProvider';

let sqliteClient: SqliteClient;
let dptTreeProvider: DptTreeProvider;
let dpTreeProvider: DpTreeProvider;

export function activate(context: vscode.ExtensionContext) {
  sqliteClient = new SqliteClient();
  dptTreeProvider = new DptTreeProvider(sqliteClient);
  dpTreeProvider = new DpTreeProvider(sqliteClient);

  // Register tree views
  context.subscriptions.push(
    vscode.window.createTreeView('winccoa-para.dptView', {
      treeDataProvider: dptTreeProvider,
      showCollapseAll: true,
    }),
    vscode.window.createTreeView('winccoa-para.dpView', {
      treeDataProvider: dpTreeProvider,
      showCollapseAll: true,
    }),
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('winccoa-para.refreshDptTree', () => dptTreeProvider.refresh()),
    vscode.commands.registerCommand('winccoa-para.refreshDpTree', () => dpTreeProvider.refresh()),
    vscode.commands.registerCommand('winccoa-para.selectProject', () => selectProject()),
    vscode.commands.registerCommand('winccoa-para.openConfigEditor', (item) => {
      if (item && item.dpId !== undefined && item.elId !== undefined) {
        openConfigEditor(item.dpId, item.elId, item.label);
      }
    }),
  );

  // Try to auto-detect project on activation
  autoDetectProject();
}

export function deactivate() {
  sqliteClient?.close();
}

async function autoDetectProject(): Promise<void> {
  // 1. Check extension setting
  const configPath = vscode.workspace.getConfiguration('winccoa-para').get<string>('projectPath');
  if (configPath && configPath.trim() !== '') {
    return connectToProject(configPath);
  }

  // 2. Try to get project from winccoa-project-admin extension
  try {
    const projectAdminApi = vscode.extensions.getExtension('winccoa-tools-pack.winccoa-project-admin')?.exports;
    if (projectAdminApi?.getCurrentProject) {
      const project = projectAdminApi.getCurrentProject();
      if (project?.projectDir) {
        return connectToProject(project.projectDir);
      }
    }
  } catch {
    // Extension not available
  }

  // 3. Check workspace folders for WinCC OA project structure
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    for (const folder of workspaceFolders) {
      const sqlitePath = path.join(folder.uri.fsPath, 'db', 'wincc_oa', 'sqlite', 'ident.sqlite');
      if (fs.existsSync(sqlitePath)) {
        return connectToProject(folder.uri.fsPath);
      }
    }
  }
}

function connectToProject(projectPath: string): void {
  const sqlitePath = path.join(projectPath, 'db', 'wincc_oa', 'sqlite', 'ident.sqlite');
  if (!fs.existsSync(sqlitePath)) {
    vscode.window.showErrorMessage(`WinCC OA SQLite database not found at: ${sqlitePath}`);
    return;
  }

  try {
    sqliteClient.open(projectPath);
    dptTreeProvider.refresh();
    dpTreeProvider.refresh();
    vscode.window.showInformationMessage(`WinCC OA PARA: Connected to ${path.basename(projectPath)}`);
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open SQLite databases: ${err}`);
  }
}

async function selectProject(): Promise<void> {
  const result = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select WinCC OA Project',
    title: 'Select WinCC OA Project Directory',
  });

  if (result && result.length > 0) {
    const projectPath = result[0].fsPath;
    connectToProject(projectPath);
    // Save to settings
    await vscode.workspace.getConfiguration('winccoa-para').update('projectPath', projectPath, vscode.ConfigurationTarget.Global);
  }
}

function openConfigEditor(dpId: number, elId: number, label: string): void {
  if (!sqliteClient.isOpen) {
    vscode.window.showWarningMessage('No WinCC OA project connected.');
    return;
  }

  // Gather all config data for this DPE
  const address = sqliteClient.getAddressConfig(dpId, elId);
  const alertHdl = sqliteClient.getAlertHdlConfig(dpId, elId);
  const alertHdlDetails = sqliteClient.getAlertHdlDetails(dpId, elId);
  const archive = sqliteClient.getArchiveConfig(dpId, elId);
  const archiveDetail = sqliteClient.getArchiveDetail(dpId, elId);
  const pvRange = sqliteClient.getPvRangeConfig(dpId, elId);
  const smooth = sqliteClient.getSmoothConfig(dpId, elId);
  const distrib = sqliteClient.getDistribConfig(dpId, elId);
  const lastValue = sqliteClient.getLastValue(dpId, elId);
  const displayName = sqliteClient.getDisplayName(dpId, elId);
  const unitAndFormat = sqliteClient.getUnitAndFormat(dpId, elId);

  const configs = {
    address,
    alertHdl,
    alertHdlDetails,
    archive,
    archiveDetail,
    pvRange,
    smooth,
    distrib,
    lastValue,
    displayName,
    unitAndFormat,
  };

  // For now, show configs in an output channel (webview comes in Phase 2)
  const outputChannel = vscode.window.createOutputChannel('WinCC OA Config', 'json');
  outputChannel.clear();
  outputChannel.appendLine(`// Config for: ${label} (dp_id=${dpId}, el_id=${elId})`);
  outputChannel.appendLine(JSON.stringify(configs, null, 2));
  outputChannel.show();
}

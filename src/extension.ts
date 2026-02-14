import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SqliteClient } from './db/sqliteClient';
import { DptTreeProvider } from './providers/dptTreeProvider';
import { DpTreeProvider } from './providers/dpTreeProvider';
import { ConfigEditorPanel } from './providers/configEditorProvider';

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
        openConfigEditor(item.dpId, item.elId, item.label, context.extensionUri);
      }
    }),
  );

  // Listen for project changes from winccoa-project-admin
  listenToProjectAdmin(context);

  // Try to auto-detect project on activation
  autoDetectProject();
}

export function deactivate() {
  sqliteClient?.close();
}

function getProjectAdminApi(): ProjectAdminApi | undefined {
  try {
    return vscode.extensions.getExtension('winccoa-tools-pack.winccoa-project-admin')?.exports;
  } catch {
    return undefined;
  }
}

interface ProjectAdminApi {
  getCurrentProject(): { projectDir: string } | undefined;
  onDidChangeProject(listener: (project: { projectDir: string } | undefined) => void): () => void;
}

function listenToProjectAdmin(context: vscode.ExtensionContext): void {
  const api = getProjectAdminApi();
  if (!api?.onDidChangeProject) return;

  const dispose = api.onDidChangeProject((project) => {
    if (project?.projectDir) {
      connectToProject(project.projectDir);
    }
  });

  context.subscriptions.push({ dispose });
}

async function autoDetectProject(): Promise<void> {
  // 1. Check extension setting
  const configPath = vscode.workspace.getConfiguration('winccoa-para').get<string>('projectPath');
  if (configPath && configPath.trim() !== '') {
    return connectToProject(configPath);
  }

  // 2. Try to get current project from winccoa-project-admin
  const api = getProjectAdminApi();
  if (api?.getCurrentProject) {
    const project = api.getCurrentProject();
    if (project?.projectDir) {
      return connectToProject(project.projectDir);
    }
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

function openConfigEditor(dpId: number, elId: number, label: string, extensionUri: vscode.Uri): void {
  if (!sqliteClient.isOpen) {
    vscode.window.showWarningMessage('No WinCC OA project connected.');
    return;
  }

  ConfigEditorPanel.show(sqliteClient, dpId, elId, label, extensionUri);
}

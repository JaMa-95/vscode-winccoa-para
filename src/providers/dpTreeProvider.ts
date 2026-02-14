import * as vscode from 'vscode';
import type { SqliteClient } from '../db/sqliteClient';
import type { Datapoint } from '../models/datapoint';
import type { DpElement } from '../models/dpElement';
import { getTypeName, OaElementType } from '../models/types';

export class DpTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'dp' | 'dpElement',
    public readonly dpId: number,
    public readonly dptId: number,
    public readonly elId: number = 0,
    public readonly datatype: number = 0,
  ) {
    super(label, collapsibleState);

    if (itemType === 'dp') {
      this.contextValue = 'dp';
      this.iconPath = new vscode.ThemeIcon('database');
    } else {
      this.contextValue = 'dpElement';
      if (datatype === OaElementType.STRUCT) {
        this.iconPath = new vscode.ThemeIcon('symbol-namespace');
      } else if (datatype === OaElementType.REFERENCE) {
        this.iconPath = new vscode.ThemeIcon('symbol-reference');
      } else {
        this.iconPath = new vscode.ThemeIcon('symbol-field');
        this.description = getTypeName(datatype);
      }

      // Set command to open config editor on click
      this.command = {
        command: 'winccoa-para.openConfigEditor',
        title: 'Open Config Editor',
        arguments: [this],
      };
    }
  }
}

export class DpTreeProvider implements vscode.TreeDataProvider<DpTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DpTreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private showInternal = false;

  constructor(private db: SqliteClient) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  setShowInternal(show: boolean): void {
    this.showInternal = show;
    this.refresh();
  }

  getTreeItem(element: DpTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DpTreeItem): DpTreeItem[] {
    if (!this.db.isOpen) {
      return [];
    }

    if (!element) {
      // Root level: show all DPs
      const datapoints = this.db.getAllDatapoints();
      return datapoints
        .filter(dp => this.showInternal || !dp.canonical_name.startsWith('_'))
        .map(dp => {
          const elements = this.db.getElementsByDptId(dp.dpt_id);
          const hasChildren = elements.length > 1;
          return new DpTreeItem(
            dp.canonical_name,
            hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            'dp',
            dp.dp_id,
            dp.dpt_id,
          );
        });
    }

    if (element.itemType === 'dp') {
      // Show elements of this DP (same tree structure as its DPT)
      const elements = this.db.getElementsByDptId(element.dptId);
      return this.buildElementChildren(elements, 0, element.dpId);
    }

    if (element.itemType === 'dpElement') {
      const elements = this.db.getElementsByDptId(element.dptId);
      return this.buildElementChildren(elements, element.elId, element.dpId);
    }

    return [];
  }

  private buildElementChildren(elements: DpElement[], parentElId: number, dpId: number): DpTreeItem[] {
    // If parentElId is 0, find the root element and get its children
    if (parentElId === 0 && elements.length > 0) {
      const rootEl = elements.find(e => e.parent_el_id === 0);
      if (rootEl) {
        return this.buildElementChildren(elements, rootEl.el_id, dpId);
      }
    }

    const children = elements.filter(e => e.parent_el_id === parentElId && e.el_id !== parentElId);

    return children.map(el => {
      const hasChildren = elements.some(e => e.parent_el_id === el.el_id && e.el_id !== el.el_id);
      const isExpandable = hasChildren || el.datatype === OaElementType.STRUCT || el.datatype === OaElementType.REFERENCE;

      return new DpTreeItem(
        el.canonical_name,
        isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        'dpElement',
        dpId,
        el.dpt_id,
        el.el_id,
        el.datatype,
      );
    });
  }
}

import * as vscode from 'vscode';
import type { SqliteClient } from '../db/sqliteClient';
import type { DpType } from '../models/dpType';
import type { DpElement } from '../models/dpElement';
import { getTypeName, OaElementType } from '../models/types';

export class DptTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'dpt' | 'element',
    public readonly dptId: number,
    public readonly elId: number = 0,
    public readonly datatype: number = 0,
    public readonly referencedType: number = 0,
  ) {
    super(label, collapsibleState);

    if (itemType === 'dpt') {
      this.contextValue = 'dpt';
      this.iconPath = new vscode.ThemeIcon('symbol-class');
    } else {
      this.contextValue = 'dptElement';
      if (datatype === OaElementType.STRUCT) {
        this.iconPath = new vscode.ThemeIcon('symbol-namespace');
      } else if (datatype === OaElementType.REFERENCE) {
        this.iconPath = new vscode.ThemeIcon('symbol-reference');
        this.description = `→ ref`;
      } else {
        this.iconPath = new vscode.ThemeIcon('symbol-field');
        this.description = getTypeName(datatype);
      }
    }
  }
}

export class DptTreeProvider implements vscode.TreeDataProvider<DptTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DptTreeItem | undefined | null>();
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

  getTreeItem(element: DptTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DptTreeItem): DptTreeItem[] {
    if (!this.db.isOpen) {
      return [];
    }

    if (!element) {
      // Root level: show all DPTs
      const dpTypes = this.db.getAllDpTypes();
      return dpTypes
        .filter(dpt => this.showInternal || !dpt.canonical_name.startsWith('_'))
        .map(dpt => {
          const elements = this.db.getElementsByDptId(dpt.dpt_id);
          const hasChildren = elements.length > 1; // root element + children
          return new DptTreeItem(
            dpt.canonical_name,
            hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
            'dpt',
            dpt.dpt_id,
          );
        });
    }

    if (element.itemType === 'dpt') {
      // Show root elements of this DPT
      const elements = this.db.getElementsByDptId(element.dptId);
      return this.buildElementChildren(elements, 0);
    }

    if (element.itemType === 'element') {
      // Show children of this element
      const elements = this.db.getElementsByDptId(element.dptId);
      return this.buildElementChildren(elements, element.elId);
    }

    return [];
  }

  private buildElementChildren(elements: DpElement[], parentElId: number): DptTreeItem[] {
    const children = elements.filter(e => e.parent_el_id === parentElId && e.el_id !== parentElId);

    // Special case: if parentElId is 0, we want children whose parent_el_id matches the root element
    // The root element has parent_el_id = 0 and is the first element
    if (parentElId === 0 && elements.length > 0) {
      const rootEl = elements.find(e => e.parent_el_id === 0);
      if (rootEl) {
        return this.buildElementChildren(elements, rootEl.el_id);
      }
    }

    return children.map(el => {
      const hasChildren = elements.some(e => e.parent_el_id === el.el_id && e.el_id !== el.el_id);
      const isExpandable = hasChildren || el.datatype === OaElementType.STRUCT || el.datatype === OaElementType.REFERENCE;

      return new DptTreeItem(
        el.canonical_name,
        isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        'element',
        el.dpt_id,
        el.el_id,
        el.datatype,
        el.referenced_type,
      );
    });
  }
}

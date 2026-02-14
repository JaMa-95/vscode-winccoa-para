import * as vscode from 'vscode';
import type { SqliteClient } from '../db/sqliteClient';
import type { DpElement } from '../models/dpElement';
import { getTypeName, OaElementType } from '../models/types';

const log = vscode.window.createOutputChannel('WinCC OA PARA', { log: true });

type ItemType = 'dpt' | 'dp' | 'dpElement';

export class ParaTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: ItemType,
    public readonly dptId: number,
    public readonly dpId: number = 0,
    public readonly elId: number = 0,
    public readonly datatype: number = 0,
  ) {
    super(label, collapsibleState);

    switch (itemType) {
      case 'dpt':
        this.contextValue = 'dpt';
        this.iconPath = new vscode.ThemeIcon('symbol-class');
        break;
      case 'dp':
        this.contextValue = 'dp';
        this.iconPath = new vscode.ThemeIcon('database');
        break;
      case 'dpElement':
        this.contextValue = 'dpElement';
        if (datatype === OaElementType.STRUCT) {
          this.iconPath = new vscode.ThemeIcon('symbol-namespace');
        } else if (datatype === OaElementType.REFERENCE) {
          this.iconPath = new vscode.ThemeIcon('symbol-reference');
          this.description = '→ ref';
        } else {
          this.iconPath = new vscode.ThemeIcon('symbol-field');
          this.description = getTypeName(datatype);
          // Open config editor on click for leaf elements
          this.command = {
            command: 'winccoa-para.openConfigEditor',
            title: 'Open Config Editor',
            arguments: [this],
          };
        }
        break;
    }
  }
}

export class DptTreeProvider implements vscode.TreeDataProvider<ParaTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ParaTreeItem | undefined | null>();
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

  getTreeItem(element: ParaTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ParaTreeItem): ParaTreeItem[] {
    log.info(`[Tree] getChildren called, element=${element?.label || 'ROOT'} (${element?.itemType || '-'}), db.isOpen=${this.db.isOpen}`);
    if (!this.db.isOpen) {
      log.warn('[Tree] getChildren: db not open, returning empty');
      return [];
    }

    if (!element) {
      return this.getRootChildren();
    }

    switch (element.itemType) {
      case 'dpt':
        return this.getDptChildren(element.dptId);
      case 'dp':
        return this.getDpChildren(element.dptId, element.dpId);
      case 'dpElement':
        return this.getElementChildren(element.dptId, element.dpId, element.elId);
      default:
        return [];
    }
  }

  /** Root level: all DPTs */
  private getRootChildren(): ParaTreeItem[] {
    const dpTypes = this.db.getAllDpTypes();
    log.info(`[Tree] Root: ${dpTypes.length} DPTs total`);
    const filtered = dpTypes.filter(dpt => this.showInternal || !dpt.canonical_name.startsWith('_'));
    log.info(`[Tree] Root: ${filtered.length} DPTs after filter`);

    return filtered.map(dpt => new ParaTreeItem(
      dpt.canonical_name,
      vscode.TreeItemCollapsibleState.Collapsed,
      'dpt',
      dpt.dpt_id,
    ));
  }

  /** DPT expanded: show DP instances of this type */
  private getDptChildren(dptId: number): ParaTreeItem[] {
    const datapoints = this.db.getDatapointsByDptId(dptId);
    log.info(`[Tree] DPT ${dptId}: ${datapoints.length} datapoints`);

    return datapoints.map(dp => {
        const elements = this.db.getElementsByDptId(dp.dpt_id);
        const hasChildren = elements.length > 1;
        return new ParaTreeItem(
          dp.canonical_name,
          hasChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
          'dp',
          dp.dpt_id,
          dp.dp_id,
        );
      });
  }

  /** DP expanded: show element tree (skip root element, show its children) */
  private getDpChildren(dptId: number, dpId: number): ParaTreeItem[] {
    const elements = this.db.getElementsByDptId(dptId);
    return this.buildElementChildren(elements, 0, dpId);
  }

  /** Element expanded: show child elements */
  private getElementChildren(dptId: number, dpId: number, parentElId: number): ParaTreeItem[] {
    const elements = this.db.getElementsByDptId(dptId);
    return this.buildElementChildren(elements, parentElId, dpId);
  }

  private buildElementChildren(elements: DpElement[], parentElId: number, dpId: number): ParaTreeItem[] {
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

      return new ParaTreeItem(
        el.canonical_name,
        isExpandable ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
        'dpElement',
        el.dpt_id,
        dpId,
        el.el_id,
        el.datatype,
      );
    });
  }
}

import * as vscode from 'vscode';
import type { SqliteClient } from '../db/sqliteClient';
import type { DpeConfigs } from '../models/configs';
import { getTypeName } from '../models/types';

export class ConfigEditorPanel {
  public static currentPanel: ConfigEditorPanel | undefined;
  private static readonly viewType = 'winccoa-para.configEditor';

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private db: SqliteClient,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static show(
    db: SqliteClient,
    dpId: number,
    elId: number,
    label: string,
    extensionUri: vscode.Uri,
  ): void {
    const column = vscode.ViewColumn.One;

    if (ConfigEditorPanel.currentPanel) {
      ConfigEditorPanel.currentPanel.panel.reveal(column);
      ConfigEditorPanel.currentPanel.update(db, dpId, elId, label);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      ConfigEditorPanel.viewType,
      `Config: ${label}`,
      column,
      { enableScripts: false, retainContextWhenHidden: true },
    );

    ConfigEditorPanel.currentPanel = new ConfigEditorPanel(panel, db);
    ConfigEditorPanel.currentPanel.update(db, dpId, elId, label);
  }

  private update(db: SqliteClient, dpId: number, elId: number, label: string): void {
    this.panel.title = `Config: ${label}`;

    const configs: DpeConfigs = {
      address: db.getAddressConfig(dpId, elId),
      alertHdl: db.getAlertHdlConfig(dpId, elId),
      alertHdlDetails: db.getAlertHdlDetails(dpId, elId),
      archive: db.getArchiveConfig(dpId, elId),
      archiveDetail: db.getArchiveDetail(dpId, elId),
      pvRange: db.getPvRangeConfig(dpId, elId),
      smooth: db.getSmoothConfig(dpId, elId),
      distrib: db.getDistribConfig(dpId, elId),
      lastValue: db.getLastValue(dpId, elId),
      displayName: db.getDisplayName(dpId, elId),
      unitAndFormat: db.getUnitAndFormat(dpId, elId),
    };

    // Get element info from ident DB
    const element = db.getElementByIds(dpId, elId);
    const dpName = db.getDatapointName(dpId);

    this.panel.webview.html = this.getHtml(label, dpId, elId, dpName, element?.datatype, configs);
  }

  private getHtml(
    label: string,
    dpId: number,
    elId: number,
    dpName: string | undefined,
    datatype: number | undefined,
    configs: DpeConfigs,
  ): string {
    const typeName = datatype !== undefined ? getTypeName(datatype) : 'unknown';
    const fullPath = dpName ? `${dpName}.${label}` : label;

    const sections: string[] = [];

    // Header
    sections.push(`
      <div class="header">
        <h2>${escapeHtml(fullPath)}</h2>
        <div class="meta">
          <span class="badge type">${escapeHtml(typeName)}</span>
          <span class="meta-item">dp_id: ${dpId}</span>
          <span class="meta-item">el_id: ${elId}</span>
          ${configs.unitAndFormat ? `<span class="badge unit">${escapeHtml(configs.unitAndFormat.unit || 'no unit')}</span>` : ''}
          ${configs.displayName ? `<span class="meta-item">Display: ${escapeHtml(configs.displayName.text)}</span>` : ''}
        </div>
      </div>
    `);

    // Current Value
    sections.push(this.renderLastValue(configs));

    // Address Config
    sections.push(this.renderAddress(configs));

    // Alert Handling
    sections.push(this.renderAlertHdl(configs));

    // Archive Config
    sections.push(this.renderArchive(configs));

    // PV Range
    sections.push(this.renderPvRange(configs));

    // Smoothing
    sections.push(this.renderSmooth(configs));

    // Distribution
    sections.push(this.renderDistrib(configs));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 16px;
      line-height: 1.5;
    }
    .header {
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding-bottom: 12px;
    }
    .header h2 {
      margin: 0 0 8px 0;
      font-size: 1.3em;
      color: var(--vscode-editor-foreground);
    }
    .meta {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .meta-item {
      color: var(--vscode-descriptionForeground);
      font-size: 0.9em;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 0.85em;
      font-weight: 500;
    }
    .badge.type {
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }
    .badge.unit {
      background: var(--vscode-statusBarItem-prominentBackground, rgba(0,122,204,0.2));
      color: var(--vscode-statusBarItem-prominentForeground, var(--vscode-foreground));
    }
    .badge.active {
      background: rgba(0,180,0,0.2);
      color: #4ec94e;
    }
    .badge.inactive {
      background: rgba(180,0,0,0.15);
      color: var(--vscode-descriptionForeground);
    }
    .section {
      margin-bottom: 16px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      overflow: hidden;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border-bottom: 1px solid var(--vscode-panel-border);
      font-weight: 600;
    }
    .section-header .icon {
      margin-right: 6px;
    }
    .section-body {
      padding: 12px;
    }
    .section.empty .section-header {
      color: var(--vscode-descriptionForeground);
      font-weight: normal;
    }
    .section.empty .section-body {
      display: none;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      text-align: left;
      padding: 4px 8px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      width: 180px;
      white-space: nowrap;
    }
    td {
      word-break: break-all;
    }
    tr:last-child th, tr:last-child td {
      border-bottom: none;
    }
    .value-display {
      font-size: 1.4em;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
    }
    .value-timestamp {
      color: var(--vscode-descriptionForeground);
      font-size: 0.85em;
      margin-top: 4px;
    }
    .detail-table {
      margin-top: 8px;
    }
    .detail-table th {
      width: auto;
      font-size: 0.85em;
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
    }
    .detail-table td {
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`;
  }

  private renderLastValue(configs: DpeConfigs): string {
    const lv = configs.lastValue;
    if (!lv) {
      return this.renderEmptySection('Current Value', 'symbol-variable');
    }

    const timestamp = lv.original_time
      ? new Date(lv.original_time * 1000).toISOString().replace('T', ' ').replace('Z', '')
      : 'n/a';

    const valueStr = lv.value !== null && lv.value !== undefined ? String(lv.value) : 'null';
    const unit = configs.unitAndFormat?.unit || '';

    return this.renderSection('Current Value', 'symbol-variable', `
      <div class="value-display">${escapeHtml(valueStr)} ${escapeHtml(unit)}</div>
      <div class="value-timestamp">Last updated: ${escapeHtml(timestamp)}</div>
      <table style="margin-top: 8px;">
        <tr><th>Status</th><td>0x${(lv.status_64 ?? 0).toString(16).toUpperCase()}</td></tr>
        <tr><th>Variable Type</th><td>${getTypeName(lv.variable_type)}</td></tr>
        <tr><th>Manager ID</th><td>${lv.manager_id}</td></tr>
        <tr><th>User ID</th><td>${lv.user_id}</td></tr>
      </table>
    `);
  }

  private renderAddress(configs: DpeConfigs): string {
    const addr = configs.address;
    if (!addr) {
      return this.renderEmptySection('Address', 'plug');
    }

    return this.renderSection('Address', 'plug', `
      <table>
        <tr><th>Reference</th><td>${escapeHtml(addr.reference || '')}</td></tr>
        <tr><th>Driver Ident</th><td>${escapeHtml(addr.drv_ident || '')}</td></tr>
        <tr><th>Poll Group</th><td>${escapeHtml(addr.poll_group || '')}</td></tr>
        <tr><th>Connection</th><td>${escapeHtml(addr.connection || '')}</td></tr>
        <tr><th>Subindex</th><td>${addr.subindex}</td></tr>
        <tr><th>Offset</th><td>${addr.offset}</td></tr>
        <tr><th>Response Mode</th><td>${addr.response_mode}</td></tr>
        <tr><th>Datatype</th><td>${getTypeName(addr.datatype)}</td></tr>
      </table>
    `);
  }

  private renderAlertHdl(configs: DpeConfigs): string {
    const ah = configs.alertHdl;
    if (!ah) {
      return this.renderEmptySection('Alert Handling', 'bell');
    }

    const activeLabel = ah.active ? 'Active' : 'Inactive';
    const activeBadge = ah.active
      ? '<span class="badge active">Active</span>'
      : '<span class="badge inactive">Inactive</span>';

    const configTypes: Record<number, string> = {
      1: 'Analog (range-based)',
      2: 'Digital (discrete)',
      3: 'Summary alert',
    };

    let detailsHtml = '';
    const details = configs.alertHdlDetails;
    if (details && details.length > 0) {
      const rows = details.map(d => {
        const range = d.l_limit !== null && d.u_limit !== null
          ? `${d.l_incl ? '[' : '('}${d.l_limit} .. ${d.u_limit}${d.u_incl ? ']' : ')'}`
          : d.match !== null ? `match: "${escapeHtml(d.match)}"` : 'n/a';
        return `<tr>
          <td>${d.detail_nr}</td>
          <td>${d.range_type}</td>
          <td>${range}</td>
          <td>${escapeHtml(d.add_text || '')}</td>
          <td>${d.class_dp_id}:${d.class_el_id}</td>
        </tr>`;
      }).join('');

      detailsHtml = `
        <table class="detail-table" style="margin-top: 12px;">
          <tr><th>#</th><th>Range Type</th><th>Range</th><th>Text</th><th>Alert Class</th></tr>
          ${rows}
        </table>
      `;
    }

    return this.renderSection('Alert Handling', 'bell', `
      <table>
        <tr><th>Status</th><td>${activeBadge}</td></tr>
        <tr><th>Config Type</th><td>${configTypes[ah.config_type] || ah.config_type}</td></tr>
        <tr><th>Discrete States</th><td>${ah.discrete_states}</td></tr>
        <tr><th>Impulse</th><td>${ah.impulse ? 'Yes' : 'No'}</td></tr>
        <tr><th>Min Priority</th><td>${ah.min_prio}</td></tr>
        <tr><th>Panel</th><td>${escapeHtml(ah.panel || '')}</td></tr>
        <tr><th>Orig Handler</th><td>${ah.orig_hdl}</td></tr>
        <tr><th>Multi-Instance</th><td>${ah.multi_instance ? 'Yes' : 'No'}</td></tr>
      </table>
      ${detailsHtml}
    `);
  }

  private renderArchive(configs: DpeConfigs): string {
    const arch = configs.archive;
    if (!arch) {
      return this.renderEmptySection('Archive', 'archive');
    }

    const activeBadge = arch.archive
      ? '<span class="badge active">Enabled</span>'
      : '<span class="badge inactive">Disabled</span>';

    let detailHtml = '';
    const ad = configs.archiveDetail;
    if (ad) {
      const procTypes: Record<number, string> = {
        0: 'None',
        1: 'Value-based',
        2: 'Time-based',
        3: 'Value & time-based',
      };
      detailHtml = `
        <table style="margin-top: 8px;">
          <tr><th>Processing Type</th><td>${procTypes[ad.proc_type] || ad.proc_type}</td></tr>
          <tr><th>Interval Type</th><td>${ad.interv_type}</td></tr>
          <tr><th>Interval</th><td>${ad.interv}</td></tr>
          <tr><th>Round Interval</th><td>${ad.round_inv}</td></tr>
          <tr><th>Round Value</th><td>${ad.round_val}</td></tr>
          <tr><th>Std Type</th><td>${ad.std_type}</td></tr>
          <tr><th>Std Tolerance</th><td>${ad.std_tol}</td></tr>
          <tr><th>Std Time</th><td>${ad.std_time}</td></tr>
          <tr><th>Class</th><td>${escapeHtml(ad.class || '')}</td></tr>
        </table>
      `;
    }

    return this.renderSection('Archive', 'archive', `
      <table>
        <tr><th>Archive</th><td>${activeBadge}</td></tr>
      </table>
      ${detailHtml}
    `);
  }

  private renderPvRange(configs: DpeConfigs): string {
    const pv = configs.pvRange;
    if (!pv) {
      return this.renderEmptySection('PV Range', 'arrow-both');
    }

    const min = pv.min !== null ? `${pv.incl_min ? '[' : '('}${pv.min}` : '(-inf';
    const max = pv.max !== null ? `${pv.max}${pv.incl_max ? ']' : ')'}` : '+inf)';

    return this.renderSection('PV Range', 'arrow-both', `
      <table>
        <tr><th>Range</th><td>${min} .. ${max}</td></tr>
        <tr><th>Config Type</th><td>${pv.config_type}</td></tr>
        <tr><th>Variable Type</th><td>${getTypeName(pv.variable_type)}</td></tr>
        <tr><th>Ignore Invalid</th><td>${pv.ignor_inv ? 'Yes' : 'No'}</td></tr>
        <tr><th>Negate</th><td>${pv.neg ? 'Yes' : 'No'}</td></tr>
        ${pv.match !== null ? `<tr><th>Match</th><td>${escapeHtml(pv.match)}</td></tr>` : ''}
      </table>
    `);
  }

  private renderSmooth(configs: DpeConfigs): string {
    const sm = configs.smooth;
    if (!sm) {
      return this.renderEmptySection('Smoothing', 'pulse');
    }

    const smoothTypes: Record<number, string> = {
      0: 'None',
      1: 'Old/New comparison',
      2: 'Old/New + tolerance',
    };

    return this.renderSection('Smoothing', 'pulse', `
      <table>
        <tr><th>Type</th><td>${smoothTypes[sm.type] || sm.type}</td></tr>
        <tr><th>Std Type</th><td>${sm.std_type}</td></tr>
        <tr><th>Std Time</th><td>${sm.std_time ?? 'n/a'}</td></tr>
        <tr><th>Std Tolerance</th><td>${sm.std_tol ?? 'n/a'}</td></tr>
      </table>
    `);
  }

  private renderDistrib(configs: DpeConfigs): string {
    const dist = configs.distrib;
    if (!dist) {
      return this.renderEmptySection('Distribution', 'server');
    }

    return this.renderSection('Distribution', 'server', `
      <table>
        <tr><th>Driver Number</th><td>${dist.driver_number}</td></tr>
      </table>
    `);
  }

  private renderSection(title: string, icon: string, body: string): string {
    return `
      <div class="section">
        <div class="section-header">
          <span><span class="icon">$(${icon})</span>${escapeHtml(title)}</span>
        </div>
        <div class="section-body">${body}</div>
      </div>
    `;
  }

  private renderEmptySection(title: string, icon: string): string {
    return `
      <div class="section empty">
        <div class="section-header">
          <span><span class="icon">$(${icon})</span>${escapeHtml(title)}</span>
          <span class="meta-item">not configured</span>
        </div>
      </div>
    `;
  }

  private dispose(): void {
    ConfigEditorPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      d?.dispose();
    }
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

import * as path from 'path';
import Database from 'better-sqlite3';
import type { DpType } from '../models/dpType';
import type { DpElement } from '../models/dpElement';
import type { Datapoint } from '../models/datapoint';
import type {
  AddressConfig,
  AlertHdlConfig,
  AlertHdlDetail,
  ArchiveConfig,
  ArchiveDetail,
  PvRangeConfig,
  SmoothConfig,
  DistribConfig,
  LastValue,
  DisplayName,
  UnitAndFormat,
} from '../models/configs';

const SQLITE_DIR = 'db/wincc_oa/sqlite';

export class SqliteClient {
  private identDb: Database.Database | null = null;
  private configDb: Database.Database | null = null;
  private lastValueDb: Database.Database | null = null;
  private projectPath: string = '';

  constructor() {}

  /** Connect to all SQLite databases for the given project */
  open(projectPath: string): void {
    this.close();
    this.projectPath = projectPath;
    const sqliteDir = path.join(projectPath, SQLITE_DIR);

    this.identDb = new Database(path.join(sqliteDir, 'ident.sqlite'), { readonly: true });
    this.configDb = new Database(path.join(sqliteDir, 'config.sqlite'), { readonly: true });
    this.lastValueDb = new Database(path.join(sqliteDir, 'last_value.sqlite'), { readonly: true });
  }

  /** Close all database connections */
  close(): void {
    this.identDb?.close();
    this.configDb?.close();
    this.lastValueDb?.close();
    this.identDb = null;
    this.configDb = null;
    this.lastValueDb = null;
  }

  get isOpen(): boolean {
    return this.identDb !== null;
  }

  // ──── Datapoint Types ────

  getAllDpTypes(): DpType[] {
    return this.identDb!.prepare(
      'SELECT dpt_id, canonical_name, next_free_el_id, modification_time FROM datapoint_type ORDER BY canonical_name'
    ).all() as DpType[];
  }

  getDpTypeById(dptId: number): DpType | undefined {
    return this.identDb!.prepare(
      'SELECT dpt_id, canonical_name, next_free_el_id, modification_time FROM datapoint_type WHERE dpt_id = ?'
    ).get(dptId) as DpType | undefined;
  }

  // ──── Datapoint Elements ────

  getElementsByDptId(dptId: number): DpElement[] {
    return this.identDb!.prepare(
      'SELECT el_id, dpt_id, position_in_type, parent_el_id, datatype, referenced_type, source_dpt_id, source_el_id, canonical_name, modification_time FROM datapoint_element WHERE dpt_id = ? ORDER BY position_in_type'
    ).all(dptId) as DpElement[];
  }

  // ──── Datapoints ────

  getAllDatapoints(): Datapoint[] {
    return this.identDb!.prepare(
      'SELECT dp_id, dpt_id, canonical_name, modification_time FROM datapoint ORDER BY canonical_name'
    ).all() as Datapoint[];
  }

  getDatapointsByDptId(dptId: number): Datapoint[] {
    return this.identDb!.prepare(
      'SELECT dp_id, dpt_id, canonical_name, modification_time FROM datapoint WHERE dpt_id = ? ORDER BY canonical_name'
    ).all(dptId) as Datapoint[];
  }

  // ──── Display Names & Units ────

  getDisplayName(dpId: number, elId: number): DisplayName | undefined {
    return this.identDb!.prepare(
      'SELECT dp_id, el_id, language_id, text FROM display_name WHERE dp_id = ? AND el_id = ? LIMIT 1'
    ).get(dpId, elId) as DisplayName | undefined;
  }

  getUnitAndFormat(dpId: number, elId: number): UnitAndFormat | undefined {
    return this.identDb!.prepare(
      'SELECT dp_id, el_id, language_id, unit, format FROM unit_and_format WHERE dp_id = ? AND el_id = ? LIMIT 1'
    ).get(dpId, elId) as UnitAndFormat | undefined;
  }

  // ──── Configs ────

  getAddressConfig(dpId: number, elId: number): AddressConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM address WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as AddressConfig | undefined;
  }

  getAlertHdlConfig(dpId: number, elId: number): AlertHdlConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM alert_hdl WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as AlertHdlConfig | undefined;
  }

  getAlertHdlDetails(dpId: number, elId: number): AlertHdlDetail[] {
    return this.configDb!.prepare(
      'SELECT * FROM alert_hdl_detail WHERE dp_id = ? AND el_id = ? ORDER BY detail_nr'
    ).all(dpId, elId) as AlertHdlDetail[];
  }

  getArchiveConfig(dpId: number, elId: number): ArchiveConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM archive WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as ArchiveConfig | undefined;
  }

  getArchiveDetail(dpId: number, elId: number): ArchiveDetail | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM archive_detail WHERE dp_id = ? AND el_id = ? LIMIT 1'
    ).get(dpId, elId) as ArchiveDetail | undefined;
  }

  getPvRangeConfig(dpId: number, elId: number): PvRangeConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM pv_range WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as PvRangeConfig | undefined;
  }

  getSmoothConfig(dpId: number, elId: number): SmoothConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM smooth WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as SmoothConfig | undefined;
  }

  getDistribConfig(dpId: number, elId: number): DistribConfig | undefined {
    return this.configDb!.prepare(
      'SELECT * FROM distrib WHERE dp_id = ? AND el_id = ?'
    ).get(dpId, elId) as DistribConfig | undefined;
  }

  // ──── Last Values ────

  getLastValue(dpId: number, elId: number): LastValue | undefined {
    return this.lastValueDb!.prepare(
      'SELECT * FROM last_value WHERE dp_id = ? AND el_id = ? AND dyn_idx = 0 AND language_id = 0'
    ).get(dpId, elId) as LastValue | undefined;
  }
}

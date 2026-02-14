/** Address config from config.sqlite address table */
export interface AddressConfig {
  dp_id: number;
  el_id: number;
  reference: string;
  subindex: number;
  offset: number;
  response_mode: number;
  datatype: number;
  drv_ident: string;
  poll_group: string;
  connection: string;
  modification_time: number;
}

/** Alert handling config from config.sqlite alert_hdl table */
export interface AlertHdlConfig {
  dp_id: number;
  el_id: number;
  config_type: number;
  variable_type: number;
  active: number;
  orig_hdl: number;
  impulse: number;
  ok_range: number | null;
  discrete_states: number;
  multi_instance: number;
  min_prio: number;
  panel: string;
  modification_time: number;
}

/** Alert handling detail from config.sqlite alert_hdl_detail table */
export interface AlertHdlDetail {
  dp_id: number;
  el_id: number;
  detail_nr: number;
  range_type: number;
  add_text: string;
  class_dp_id: number;
  class_el_id: number;
  hyst_type: number;
  hyst_time: number;
  l_hyst_limit: number | null;
  u_hyst_limit: number | null;
  l_limit: number | null;
  l_incl: number;
  u_limit: number | null;
  u_incl: number;
  match: string | null;
  neg: number;
}

/** Archive config from config.sqlite archive table */
export interface ArchiveConfig {
  dp_id: number;
  el_id: number;
  archive: number;
  modification_time: number;
}

/** Archive detail from config.sqlite archive_detail table */
export interface ArchiveDetail {
  dp_id: number;
  el_id: number;
  detail_nr: number;
  proc_type: number;
  round_inv: number;
  round_val: number;
  interv_type: number;
  interv: number;
  std_type: number;
  std_tol: number;
  std_time: number;
  class: string;
}

/** PV Range config from config.sqlite pv_range table */
export interface PvRangeConfig {
  dp_id: number;
  el_id: number;
  config_type: number;
  variable_type: number;
  ignor_inv: number;
  neg: number;
  min: number | null;
  max: number | null;
  incl_min: number;
  incl_max: number;
  match: string | null;
  modification_time: number;
}

/** Smooth config from config.sqlite smooth table */
export interface SmoothConfig {
  dp_id: number;
  el_id: number;
  type: number;
  std_type: number;
  std_time: number | null;
  std_tol: number | null;
  modification_time: number;
}

/** Distribution config from config.sqlite distrib table */
export interface DistribConfig {
  dp_id: number;
  el_id: number;
  driver_number: number;
  modification_time: number;
}

/** Last value from last_value.sqlite */
export interface LastValue {
  dp_id: number;
  el_id: number;
  dyn_idx: number;
  language_id: number;
  value: unknown;
  variable_type: number;
  original_time: number | null;
  system_time: number | null;
  status_64: number;
  user_id: number;
  manager_id: number;
}

/** Display name from ident.sqlite display_name table */
export interface DisplayName {
  dp_id: number;
  el_id: number;
  language_id: number;
  text: string;
}

/** Unit and format from ident.sqlite unit_and_format table */
export interface UnitAndFormat {
  dp_id: number;
  el_id: number;
  language_id: number;
  unit: string;
  format: string;
}

/** All configs available for a DP element */
export interface DpeConfigs {
  address?: AddressConfig;
  alertHdl?: AlertHdlConfig;
  alertHdlDetails?: AlertHdlDetail[];
  archive?: ArchiveConfig;
  archiveDetail?: ArchiveDetail;
  pvRange?: PvRangeConfig;
  smooth?: SmoothConfig;
  distrib?: DistribConfig;
  lastValue?: LastValue;
  displayName?: DisplayName;
  unitAndFormat?: UnitAndFormat;
}

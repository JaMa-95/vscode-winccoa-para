/** Datapoint Type from ident.sqlite datapoint_type table */
export interface DpType {
  dpt_id: number;
  canonical_name: string;
  next_free_el_id: number;
  modification_time: number;
}

/** Datapoint instance from ident.sqlite datapoint table */
export interface Datapoint {
  dp_id: number;
  dpt_id: number;
  canonical_name: string;
  modification_time: number;
}

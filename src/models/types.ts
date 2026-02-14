/**
 * WinCC OA element data types as stored in datapoint_element.datatype
 */
export enum OaElementType {
  STRUCT = 1,
  CHAR = 19,
  UINT = 20,
  INT = 21,
  FLOAT = 22,
  BOOL = 23,
  BIT32 = 24,
  TEXT = 25,
  TIME = 26,
  DPID = 27,
  BLOB = 28,
  LONG = 29,
  ULONG = 30,
  BIT64 = 31,
  DYN_CHAR = 32 + 19,
  DYN_UINT = 32 + 20,
  DYN_INT = 32 + 21,
  DYN_FLOAT = 32 + 22,
  DYN_BOOL = 32 + 23,
  DYN_BIT32 = 32 + 24,
  DYN_TEXT = 32 + 25,
  DYN_TIME = 32 + 26,
  DYN_DPID = 32 + 27,
  REFERENCE = 41,
}

/** Human-readable name for an element data type */
export function getTypeName(datatype: number): string {
  switch (datatype) {
    case OaElementType.STRUCT: return 'struct';
    case OaElementType.CHAR: return 'char';
    case OaElementType.UINT: return 'uint';
    case OaElementType.INT: return 'int';
    case OaElementType.FLOAT: return 'float';
    case OaElementType.BOOL: return 'bool';
    case OaElementType.BIT32: return 'bit32';
    case OaElementType.TEXT: return 'string';
    case OaElementType.TIME: return 'time';
    case OaElementType.DPID: return 'dpid';
    case OaElementType.BLOB: return 'blob';
    case OaElementType.LONG: return 'long';
    case OaElementType.ULONG: return 'ulong';
    case OaElementType.BIT64: return 'bit64';
    case OaElementType.REFERENCE: return 'reference';
    default:
      if (datatype > 32 && datatype < 60) {
        return `dyn_${getTypeName(datatype - 32)}`;
      }
      return `unknown(${datatype})`;
  }
}

/** Check if a type is a leaf (non-struct, non-reference) */
export function isLeafType(datatype: number): boolean {
  return datatype !== OaElementType.STRUCT && datatype !== OaElementType.REFERENCE;
}

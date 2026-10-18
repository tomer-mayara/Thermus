// The order of the UTF-16 code units, in which the snapshot sorts its labels and its paths.
export function textOrder(first: string, second: string): number {
  return Number(first > second) - Number(first < second);
}

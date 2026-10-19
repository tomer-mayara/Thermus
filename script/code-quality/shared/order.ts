// Compare UTF-16 code units, as the snapshot sorts its labels and paths.
export function textOrder(first: string, second: string): number {
  return Number(first > second) - Number(first < second);
}

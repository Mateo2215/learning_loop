export const DEEP_DIVE_ROUND_SIZE = 5;

export function capDeepDiveRoundSize(requested: number): number {
  return Math.min(requested, DEEP_DIVE_ROUND_SIZE);
}

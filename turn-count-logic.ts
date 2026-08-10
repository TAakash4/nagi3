export const TURN_INTERVAL = 6;

export function shouldRunPeriodicTasks(turns: number): boolean {
  return turns > 0 && turns % TURN_INTERVAL === 0;
}

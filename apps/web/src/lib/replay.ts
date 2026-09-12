/* ─────────────────────────────────────────────────────────
 * REPLAY STORYBOARD — one continuous, recorded browser task
 *     0ms   show the requested fruit and empty search field
 *  1800ms   recorded query appears; cursor approaches Search
 *  4200ms   click Search → recorded result cards
 *  8400ms   click the fruit → recorded ripeness cards
 * 12600ms   click the ripeness → recorded terminal result
 * 18000ms   loop to the beginning
 * Body motion and cursor interpolation are presentation.
 * Screens, chosen actions and neural values are recordings.
 * ───────────────────────────────────────────────────────── */
export const TIMING = {
  queryAppear: 1800,
  searchClick: 4200,
  fruitClick: 8400,
  ripenessClick: 12600,
  loop: 18000,
};
export const REPLAY = {
  neuralUpdateMs: 550,
  cursorTravelMs: 2300,
  clickRingMs: 440,
  uiRefreshMs: 80,
};
export type Point = { x: number; y: number };
export type Action = {
  phase: number;
  selected: string;
  cursor: Point;
  scores: number[];
  labels: string[];
  action: number;
  stimulus: string;
};
export type Replay = {
  id: string;
  name: string;
  seed: number;
  success: boolean;
  heldout: boolean;
  task: string;
  fruit: string;
  ripeness: string;
  frames: { file: string }[];
  actions: Action[];
  activity: Record<string, number[][]>;
};
export type ReplayState = {
  phase: number;
  finished: boolean;
  frame: string;
  action: Action;
  cursor: Point;
  pulse: number;
  neuralStep: number;
};
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};
export function replayState(replay: Replay, time: number): ReplayState {
  const t = ((time % TIMING.loop) + TIMING.loop) % TIMING.loop;
  const phase =
    t < TIMING.searchClick
      ? 0
      : t < TIMING.fruitClick
        ? 1
        : t < TIMING.ripenessClick
          ? 2
          : 3;
  const lastPhase = replay.actions.length - 1;
  const failureAt = [
    TIMING.searchClick,
    TIMING.fruitClick,
    TIMING.ripenessClick,
  ][lastPhase];
  const finished = phase === 3 || (!replay.success && t >= failureAt);
  const action = replay.actions[Math.min(phase, lastPhase)];
  let frame = replay.frames[0].file;
  if (t >= TIMING.queryAppear) frame = replay.frames[1].file;
  if (t >= TIMING.searchClick) frame = replay.frames[2].file;
  if (t >= TIMING.fruitClick && replay.frames[3]) frame = replay.frames[3].file;
  if (t >= TIMING.ripenessClick && replay.frames[4])
    frame = replay.frames[4].file;
  const current = Math.min(phase, lastPhase);
  const start = [0, TIMING.searchClick, TIMING.fruitClick][current];
  const clickAt = [TIMING.searchClick, TIMING.fruitClick, TIMING.ripenessClick][
    current
  ];
  const from =
    current === 0 ? { x: 410, y: 545 } : replay.actions[current - 1].cursor;
  const u = smooth(
    (t - (clickAt - REPLAY.cursorTravelMs)) / REPLAY.cursorTravelMs,
  );
  const cursor = finished
    ? action.cursor
    : {
        x: from.x + (action.cursor.x - from.x) * u,
        y: from.y + (action.cursor.y - from.y) * u,
      };
  const sinceLast =
    t -
    [TIMING.searchClick, TIMING.fruitClick, TIMING.ripenessClick][
      Math.max(0, Math.min(phase - 1, lastPhase))
    ];
  return {
    phase: finished ? 3 : phase,
    finished,
    frame,
    action,
    cursor,
    pulse:
      sinceLast >= 0 && sinceLast < REPLAY.clickRingMs
        ? 1 - sinceLast / REPLAY.clickRingMs
        : 0,
    neuralStep: Math.min(
      6,
      Math.max(0, Math.floor((t - start) / REPLAY.neuralUpdateMs)),
    ),
  };
}

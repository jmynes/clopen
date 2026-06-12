/**
 * Savings-goal taxonomy and progress math. Pure, like timesheet.ts — UI and
 * DB stay thin around it. A goal is a named dollar target independent of the
 * salary tracking (and of Settings' yearly stretch goal): `overtime` funding
 * measures dollars earned beyond the as-written schedule since the goal's
 * start date, `all` measures every dollar earned since then.
 */
import { countWorkdays, type EntryLike, loggedHours, overtimeHours, type WorkSettings } from './timesheet';

export const GOAL_FUNDINGS = ['overtime', 'all'] as const;
export type GoalFunding = (typeof GOAL_FUNDINGS)[number];

export const GOAL_FUNDING_LABELS: Record<GoalFunding, string> = {
  overtime: 'Overtime',
  all: 'All earnings',
};

export type GoalProgress = {
  /** Dollars accumulated toward the target, never negative. */
  saved: number;
  /** Percent of the target, uncapped — display layers clamp the bar at 100. */
  pct: number;
  /** Dollars still to go, floored at 0. */
  remaining: number;
  reached: boolean;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

type PoolParams = {
  entries: EntryLike[];
  asOf: string;
  settings: WorkSettings;
  /** Earliest date that counts toward accrual, same clamp as the dashboard. */
  epoch?: string;
  otMultiplierEnabled?: boolean;
  otMultiplier?: number;
};

/** Dollars a funding mode has accumulated over [startDate (epoch-clamped), asOf]. */
function poolDollars(funding: GoalFunding, startDate: string, params: PoolParams): number {
  const { entries, asOf, settings, epoch } = params;
  const start = epoch && epoch > startDate ? epoch : startDate;
  if (start > asOf) return 0;
  const inRange = entries.filter((e) => e.date >= start && e.date <= asOf);
  const logged = loggedHours(inRange);
  // Same earnings math as the dashboard hero, at the straight salary rate
  // (goals are independent of the yearly stretch goal by design).
  const ot = params.otMultiplierEnabled ? overtimeHours(inRange, settings.dailyHours) : 0;
  const earned = (logged - ot) * settings.hourlyRate + ot * settings.hourlyRate * (params.otMultiplier ?? 1.5);
  if (funding === 'all') return round2(earned);
  const expectedDollars = countWorkdays(start, asOf, settings.workdays) * settings.dailyHours * settings.hourlyRate;
  return round2(Math.max(0, earned - expectedDollars));
}

export function goalProgress(
  params: PoolParams & {
    startDate: string;
    targetAmount: number;
    funding: GoalFunding;
  },
): GoalProgress {
  const { startDate, targetAmount, funding } = params;
  const saved = poolDollars(funding, startDate, params);
  return {
    saved,
    pct: targetAmount > 0 ? round2((saved / targetAmount) * 100) : 0,
    remaining: round2(Math.max(0, targetAmount - saved)),
    reached: targetAmount > 0 && saved >= targetAmount,
  };
}

export type AllocatedGoal = {
  id: string;
  targetAmount: number;
  startDate: string;
  funding: GoalFunding;
  /** Percent share (0–100) of the savings stream this goal receives. */
  allocation: number;
};

/**
 * Ranked-allocation progress: each goal receives `allocation%` of its own
 * funding pool (measured from its own start date), capped at its target.
 * Shares left over from goals that have already reached their target spill
 * to the highest-ranked unfinished goal — so a small low-priority goal can
 * pay off first, then its share tops up the priorities above it.
 * `goals` must arrive in rank order; results keep that order.
 */
export function allocateGoals(params: PoolParams & { goals: AllocatedGoal[] }): Array<{ id: string } & GoalProgress> {
  const raw = params.goals.map((g) => round2((poolDollars(g.funding, g.startDate, params) * g.allocation) / 100));
  const saved = params.goals.map((g, i) => Math.min(g.targetAmount, raw[i]));
  let excess = round2(raw.reduce((sum, r, i) => sum + (r - saved[i]), 0));
  for (let i = 0; i < saved.length && excess > 0; i++) {
    const add = Math.min(params.goals[i].targetAmount - saved[i], excess);
    saved[i] = round2(saved[i] + add);
    excess = round2(excess - add);
  }
  return params.goals.map((g, i) => ({
    id: g.id,
    saved: saved[i],
    pct: g.targetAmount > 0 ? round2((saved[i] / g.targetAmount) * 100) : 0,
    remaining: round2(Math.max(0, g.targetAmount - saved[i])),
    reached: g.targetAmount > 0 && saved[i] >= g.targetAmount,
  }));
}

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

export function goalProgress(params: {
  entries: EntryLike[];
  startDate: string;
  targetAmount: number;
  funding: GoalFunding;
  asOf: string;
  settings: WorkSettings;
  /** Earliest date that counts toward accrual, same clamp as the dashboard. */
  epoch?: string;
  otMultiplierEnabled?: boolean;
  otMultiplier?: number;
}): GoalProgress {
  const { entries, startDate, targetAmount, funding, asOf, settings, epoch } = params;
  const start = epoch && epoch > startDate ? epoch : startDate;

  let saved = 0;
  if (start <= asOf) {
    const inRange = entries.filter((e) => e.date >= start && e.date <= asOf);
    const logged = loggedHours(inRange);
    // Same earnings math as the dashboard hero, at the straight salary rate
    // (goals are independent of the yearly stretch goal by design).
    const ot = params.otMultiplierEnabled ? overtimeHours(inRange, settings.dailyHours) : 0;
    const earned = (logged - ot) * settings.hourlyRate + ot * settings.hourlyRate * (params.otMultiplier ?? 1.5);
    if (funding === 'all') {
      saved = round2(earned);
    } else {
      const expectedDollars = countWorkdays(start, asOf, settings.workdays) * settings.dailyHours * settings.hourlyRate;
      saved = round2(Math.max(0, earned - expectedDollars));
    }
  }

  return {
    saved,
    pct: targetAmount > 0 ? round2((saved / targetAmount) * 100) : 0,
    remaining: round2(Math.max(0, targetAmount - saved)),
    reached: targetAmount > 0 && saved >= targetAmount,
  };
}

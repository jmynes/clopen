import { isLeaveKind } from '$lib/leave-kinds';

/** Entry mode for a weekly-grid row, or a non-saving classification. */
export type GridRowKind = 'leave' | 'clock' | 'open' | 'hours' | 'empty';

export type GridRowInputs = {
  /** The grid's current entry mode. */
  mode: 'clock' | 'hours';
  /** Raw value of the row's leave select ('' when not a leave row). */
  leave: string;
  /** parseTimeInput() result for the clock-in cell (null when blank/unparseable). */
  startParsed: string | null;
  /** parseTimeInput() result for the clock-out cell. */
  endParsed: string | null;
  /** Raw value of the hours cell (hours mode). */
  hours: string;
  /** Raw value of the break cell. */
  brk: string;
};

/**
 * Classify a weekly-grid row from its (already-parsed) field values:
 * - leave kind selected -> 'leave'
 * - clock mode: both times -> 'clock'; one time alone -> 'open'
 * - hours mode: non-blank hours -> 'hours'
 * - anything else with a break typed -> 'open' (a break alone is a started day)
 * - nothing at all -> 'empty'
 *
 * 'open' is the incomplete-but-real row: it saves, shows "In progress" in the
 * Ledger, and carries 0 worked hours until the missing half arrives.
 */
export function classifyGridRow(f: GridRowInputs): GridRowKind {
  if (isLeaveKind(f.leave)) return 'leave';
  if (f.mode === 'clock') {
    if (f.startParsed && f.endParsed) return 'clock';
    if (f.startParsed || f.endParsed) return 'open';
  } else if (f.hours.trim()) {
    return 'hours';
  }
  return f.brk.trim() ? 'open' : 'empty';
}

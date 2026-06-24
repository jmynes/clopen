import { isLeaveKind } from '$lib/leave-kinds';

/** Entry mode for a weekly-grid row, or a non-saving classification. */
export type GridRowKind = 'leave' | 'clock' | 'open' | 'hours' | 'empty' | 'partial';

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
};

/**
 * Classify a weekly-grid row from its (already-parsed) field values:
 * - leave kind selected -> 'leave'
 * - clock mode: both times -> 'clock'; arrival only -> 'open'; neither -> 'empty';
 *   departure without arrival -> 'partial' (incomplete; don't save yet)
 * - hours mode: non-blank -> 'hours'; blank -> 'empty'
 */
export function classifyGridRow(f: GridRowInputs): GridRowKind {
  if (isLeaveKind(f.leave)) return 'leave';
  if (f.mode === 'clock') {
    if (!f.startParsed && !f.endParsed) return 'empty';
    if (f.startParsed && f.endParsed) return 'clock';
    if (f.startParsed && !f.endParsed) return 'open';
    return 'partial';
  }
  return f.hours.trim() ? 'hours' : 'empty';
}

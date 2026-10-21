export const GROUP_LEVELS = [
  'familiarization',
  'adaptation',
  'perfecting',
] as const;
export type GroupLevel = (typeof GROUP_LEVELS)[number];

/** Minutes in the pool: Familiarización 30, Adaptación 35, Perfeccionamiento 45. */
export const LEVEL_MINUTES: Record<GroupLevel, number> = {
  familiarization: 30,
  adaptation: 35,
  perfecting: 45,
};

export const LEVEL_LABELS: Record<GroupLevel, string> = {
  familiarization: 'Familiarización',
  adaptation: 'Adaptación',
  perfecting: 'Perfeccionamiento',
};

/** Sessions closer than this are treated as one consecutive block. */
export const DEFAULT_MAX_GAP_MINUTES = 15;

const DAYS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** Monday is 0. Returns -1 for an unrecognised weekday name. */
export const weekdayIndex = (name: string): number => DAYS.indexOf(fold(name));

export function dateWeekdayIndex(date: string): number {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(time)) {
    throw new Error('Invalid date');
  }
  return (new Date(time).getUTCDay() + 6) % 7;
}

export function toMinute(hhmm: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!match) {
    throw new Error('Invalid time');
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinute(minute: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

export type Clock = {date: string; minute: number};

/** Local wall-clock reading; the caller supplies the device time. */
export function clockFrom(now: Date): Clock {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    minute: now.getHours() * 60 + now.getMinutes(),
  };
}

export type ScheduleGroup = {
  id: string;
  title: string;
  weekday: string;
  startTime: string;
};

export type SessionSlot = {
  groupId: string;
  title: string;
  date: string;
  level: GroupLevel;
  startMinute: number;
  endMinute: number;
};

/**
 * A session is one group on one date. Groups without a level are reported in
 * missingLevel instead of being guessed.
 */
export function slotsForDate(
  groups: ScheduleGroup[],
  levels: Readonly<Partial<Record<string, GroupLevel>>>,
  date: string,
) {
  const day = dateWeekdayIndex(date);
  const slots: SessionSlot[] = [];
  const missingLevel: string[] = [];
  for (const group of groups) {
    if (weekdayIndex(group.weekday) !== day) {
      continue;
    }
    const level = levels[group.id];
    if (!level) {
      missingLevel.push(group.id);
      continue;
    }
    const startMinute = toMinute(group.startTime);
    slots.push({
      groupId: group.id,
      title: group.title,
      date,
      level,
      startMinute,
      endMinute: startMinute + LEVEL_MINUTES[level],
    });
  }
  slots.sort((a, b) => a.startMinute - b.startMinute);
  return {slots, missingLevel};
}

/** Groups consecutive sessions (sorted input) into blocks. */
export function blocksOf(
  slots: SessionSlot[],
  maxGapMinutes = DEFAULT_MAX_GAP_MINUTES,
): SessionSlot[][] {
  const blocks: SessionSlot[][] = [];
  let blockEnd = 0;
  for (const slot of slots) {
    const current = blocks[blocks.length - 1];
    if (current && slot.startMinute - blockEnd <= maxGapMinutes) {
      current.push(slot);
      blockEnd = Math.max(blockEnd, slot.endMinute);
    } else {
      blocks.push([slot]);
      blockEnd = slot.endMinute;
    }
  }
  return blocks;
}

/** Groups that already have at least one note for the given session date. */
export function notedGroupIds(
  notes: {groupId: string; sessionDate?: string}[],
  date: string,
): Set<string> {
  return new Set(
    notes.filter(note => note.sessionDate === date).map(note => note.groupId),
  );
}

export type Phase =
  | 'no_sessions'
  | 'before_day'
  | 'in_session'
  | 'between_sessions'
  | 'between_blocks'
  | 'after_day';

/**
 * What to offer for note-taking at this moment. primary: the groups that fit
 * the time (ongoing, just ended, or the last finished block). others: the rest
 * of the day. missing: sessions already finished without any note.
 */
export function noteTargets(
  slots: SessionSlot[],
  noted: ReadonlySet<string>,
  clock: Clock,
  maxGapMinutes = DEFAULT_MAX_GAP_MINUTES,
) {
  if (slots.some(slot => slot.date !== clock.date)) {
    throw new Error('Slots belong to another date');
  }
  const minute = clock.minute;
  const blocks = blocksOf(slots, maxGapMinutes);
  const ended = slots.filter(slot => slot.endMinute <= minute);
  const ongoing = slots.filter(
    slot => slot.startMinute <= minute && minute < slot.endMinute,
  );
  const finishedBlocks = blocks.filter(block =>
    block.every(slot => slot.endMinute <= minute),
  );
  const lastFinished = finishedBlocks[finishedBlocks.length - 1] ?? [];
  const missing = ended.filter(slot => !noted.has(slot.groupId));
  let phase: Phase;
  let primary: SessionSlot[];
  if (slots.length === 0) {
    phase = 'no_sessions';
    primary = [];
  } else if (ongoing.length > 0) {
    phase = 'in_session';
    primary = ongoing;
  } else if (minute < slots[0].startMinute) {
    phase = 'before_day';
    primary = [];
  } else if (ended.length === slots.length) {
    phase = 'after_day';
    primary = lastFinished;
  } else {
    const inside = blocks.find(
      block =>
        block[0].startMinute <= minute &&
        minute < Math.max(...block.map(slot => slot.endMinute)),
    );
    if (inside) {
      const lastEnd = Math.max(
        ...inside
          .filter(slot => slot.endMinute <= minute)
          .map(slot => slot.endMinute),
      );
      phase = 'between_sessions';
      primary = inside.filter(slot => slot.endMinute === lastEnd);
    } else {
      phase = 'between_blocks';
      primary = lastFinished;
    }
  }
  const others = slots.filter(slot => !primary.includes(slot));
  return {phase, primary, others, missing};
}

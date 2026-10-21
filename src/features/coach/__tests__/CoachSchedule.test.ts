import {
  blocksOf,
  clockFrom,
  formatMinute,
  noteTargets,
  notedGroupIds,
  slotsForDate,
  weekdayIndex,
} from '../CoachSchedule';
import type {GroupLevel} from '../CoachSchedule';

const WEDNESDAY = '2026-09-30';
const MONDAY = '2026-09-28';
const levels: Record<string, GroupLevel> = {
  w1: 'familiarization',
  w2: 'adaptation',
  w3: 'perfecting',
  m1: 'familiarization',
  m2: 'adaptation',
};
const wednesday = (...starts: string[]) =>
  starts.map((startTime, index) => ({
    id: `w${index + 1}`,
    title: `Miércoles ${startTime}`,
    weekday: 'miércoles',
    startTime,
  }));
const at = (hours: number, minutes: number) => hours * 60 + minutes;
const ids = (slots: {groupId: string}[]) => slots.map(slot => slot.groupId);

// Synthetic groups only. Times mirror the real rhythm: 30/35/45 minutes.
describe('session calendar', () => {
  it('derives each session length from the group level', () => {
    const {slots} = slotsForDate(
      wednesday('17:00', '17:30', '18:05'),
      levels,
      WEDNESDAY,
    );
    expect(slots.map(s => [s.startMinute, s.endMinute])).toEqual([
      [at(17, 0), at(17, 30)],
      [at(17, 30), at(18, 5)],
      [at(18, 5), at(18, 50)],
    ]);
    expect(formatMinute(slots[2].endMinute)).toBe('18:50');
  });

  it('keeps only the groups of that weekday and reports missing levels', () => {
    const groups = [
      ...wednesday('17:00'),
      {id: 'm1', title: 'Lunes', weekday: 'lunes', startTime: '17:00'},
      {id: 'm2', title: 'Lunes 2', weekday: 'Lunes', startTime: '17:30'},
    ];
    const result = slotsForDate(groups, {m1: 'familiarization'}, MONDAY);
    expect(ids(result.slots)).toEqual(['m1']);
    expect(result.missingLevel).toEqual(['m2']);
    expect(weekdayIndex('Miércoles')).toBe(2);
    expect(weekdayIndex('someday')).toBe(-1);
  });

  it('groups consecutive sessions into blocks and splits on a real gap', () => {
    const joined = slotsForDate(
      wednesday('17:00', '17:30', '18:05'),
      levels,
      WEDNESDAY,
    ).slots;
    expect(blocksOf(joined)).toHaveLength(1);
    const gap = slotsForDate(
      wednesday('17:00', '17:30', '18:35'),
      levels,
      WEDNESDAY,
    ).slots;
    expect(blocksOf(gap).map(ids)).toEqual([['w1', 'w2'], ['w3']]);
  });

  it('reads the device clock in local time', () => {
    expect(clockFrom(new Date(2026, 9, 1, 9, 5))).toEqual({
      date: '2026-10-01',
      minute: at(9, 5),
    });
  });
});

describe('what to offer for notes at each moment', () => {
  const standard = slotsForDate(
    wednesday('17:00', '17:30', '18:05'),
    levels,
    WEDNESDAY,
  ).slots;
  const none = new Set<string>();
  const clock = (hours: number, minutes: number) => ({
    date: WEDNESDAY,
    minute: at(hours, minutes),
  });

  it('before the first class offers everything as an alternative', () => {
    const result = noteTargets(standard, none, clock(16, 0));
    expect(result.phase).toBe('before_day');
    expect(result.primary).toEqual([]);
    expect(ids(result.others)).toEqual(['w1', 'w2', 'w3']);
    expect(result.missing).toEqual([]);
  });

  it('during a class puts that group first and starts exactly on the hour', () => {
    const first = noteTargets(standard, none, clock(17, 10));
    expect(first.phase).toBe('in_session');
    expect(ids(first.primary)).toEqual(['w1']);
    expect(ids(first.others)).toEqual(['w2', 'w3']);
    expect(ids(noteTargets(standard, none, clock(17, 30)).primary)).toEqual([
      'w2',
    ]);
  });

  it('after the last class of a block offers the whole block and what is missing', () => {
    const result = noteTargets(standard, new Set(['w2']), clock(18, 50));
    expect(result.phase).toBe('after_day');
    expect(ids(result.primary)).toEqual(['w1', 'w2', 'w3']);
    expect(ids(result.missing)).toEqual(['w1', 'w3']);
  });

  it('between two close classes offers the one that just ended', () => {
    const close = slotsForDate(
      wednesday('17:00', '17:40', '18:20'),
      levels,
      WEDNESDAY,
    ).slots;
    const result = noteTargets(close, none, clock(17, 35));
    expect(result.phase).toBe('between_sessions');
    expect(ids(result.primary)).toEqual(['w1']);
  });

  it('between two blocks offers the block that finished', () => {
    const split = slotsForDate(
      wednesday('17:00', '17:30', '18:35'),
      levels,
      WEDNESDAY,
    ).slots;
    const result = noteTargets(split, none, clock(18, 20));
    expect(result.phase).toBe('between_blocks');
    expect(ids(result.primary)).toEqual(['w1', 'w2']);
    expect(ids(result.others)).toEqual(['w3']);
  });

  it('reports a day without classes and refuses slots from another date', () => {
    const friday = slotsForDate(wednesday('17:00'), levels, '2026-10-02');
    expect(
      noteTargets(friday.slots, none, {date: '2026-10-02', minute: at(12, 0)})
        .phase,
    ).toBe('no_sessions');
    expect(() =>
      noteTargets(standard, none, {date: MONDAY, minute: at(17, 0)}),
    ).toThrow('another date');
  });

  it('finds the groups that already have a note for that date', () => {
    const noted = notedGroupIds(
      [
        {groupId: 'w1', sessionDate: WEDNESDAY},
        {groupId: 'w2', sessionDate: MONDAY},
        {groupId: 'w3'},
      ],
      WEDNESDAY,
    );
    expect([...noted]).toEqual(['w1']);
  });
});

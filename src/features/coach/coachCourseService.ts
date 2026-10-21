import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  CourseScope,
  CourseSnapshot,
  NoteConfirmation,
} from './CoachCourseRepository';
import type {CoachRoster} from './CoachRoster';
import type {NoteDraft} from './CoachNoteDraft';
import {COACH_WORKSPACE_ID} from './demoCourse';

/** What the Coach screen needs; injected so tests run without the database. */
export interface CoachCourseService {
  listCourseIds(): Promise<string[]>;
  snapshot(courseId: string): Promise<CourseSnapshot>;
  create(courseId: string, roster: CoachRoster): Promise<CourseSnapshot>;
  confirmNote(
    courseId: string,
    draft: NoteDraft,
    at: string,
  ): Promise<NoteConfirmation>;
  lastCourseId(): Promise<string | null>;
  rememberCourseId(courseId: string | null): Promise<void>;
}

const LAST_COURSE_KEY = 'coach.lastCourseId';
const identifier = /^[a-zA-Z0-9_-]{1,64}$/;

const scopeOf = (courseId: string): CourseScope => ({
  workspaceId: COACH_WORKSPACE_ID,
  courseId,
});

/** Device implementation over the shared WatermelonDB database (lazy). */
export const localCoachCourseService: CoachCourseService = {
  async listCourseIds() {
    const [{database}, {WatermelonCoachCourseAdmin}] = await Promise.all([
      import('../../database'),
      import('./WatermelonCoachCourseAdmin'),
    ]);
    const courses = await new WatermelonCoachCourseAdmin(database).listCourses(
      COACH_WORKSPACE_ID,
    );
    return courses.map(course => course.courseId);
  },
  async snapshot(courseId) {
    const {openLocalCoachCourseRepository} = await import(
      './WatermelonCoachCourseStorage'
    );
    return (await openLocalCoachCourseRepository(scopeOf(courseId))).snapshot();
  },
  async create(courseId, roster) {
    const {openLocalCoachCourseRepository} = await import(
      './WatermelonCoachCourseStorage'
    );
    const repo = await openLocalCoachCourseRepository(scopeOf(courseId));
    return repo.createConfirmed(roster);
  },
  async confirmNote(courseId, draft, at) {
    const {openLocalCoachCourseRepository} = await import(
      './WatermelonCoachCourseStorage'
    );
    const repo = await openLocalCoachCourseRepository(scopeOf(courseId));
    return repo.confirmNoteDraft(draft, at);
  },
  async lastCourseId() {
    const value = await AsyncStorage.getItem(LAST_COURSE_KEY);
    return value && identifier.test(value) ? value : null;
  },
  async rememberCourseId(courseId) {
    if (courseId === null) {
      await AsyncStorage.removeItem(LAST_COURSE_KEY);
      return;
    }
    if (!identifier.test(courseId)) {
      throw new Error('Invalid course id');
    }
    await AsyncStorage.setItem(LAST_COURSE_KEY, courseId);
  },
};

/** Course id for an imported listing: importado-YYYYMMDD-HHMM (local time). */
export function importedCourseId(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `importado-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate(),
  )}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

import type {CourseScope, CourseSnapshot} from './CoachCourseRepository';

/** What the course Talent needs: a snapshot of the active course and the clock. */
export interface CoachCourseAccess {
  /** Resolves null when no course has been chosen in the app. */
  snapshot(): Promise<CourseSnapshot | null>;
  now(): Date;
}

const identifier = /^[a-zA-Z0-9_-]{1,64}$/;
let active: CourseScope | null = null;

/**
 * The course the person chose on screen. Only trusted UI code calls set();
 * the model has no tool that can change it.
 */
export const coachActiveCourse = {
  get(): CourseScope | null {
    return active ? {...active} : null;
  },
  set(scope: CourseScope | null): void {
    if (
      scope &&
      (!identifier.test(scope.workspaceId) || !identifier.test(scope.courseId))
    ) {
      throw new Error('Invalid course scope');
    }
    active = scope ? {...scope} : null;
  },
};

/** Device implementation: reads the active course through the shared database. */
export const defaultCoachCourseAccess: CoachCourseAccess = {
  now: () => new Date(),
  async snapshot() {
    const scope = coachActiveCourse.get();
    if (!scope) {
      return null;
    }
    const {openLocalCoachCourseRepository} = await import(
      './WatermelonCoachCourseStorage'
    );
    return (await openLocalCoachCourseRepository(scope)).snapshot();
  },
};

import {Q} from '@nozbe/watermelondb';
import type {Database} from '@nozbe/watermelondb';

import type CoachCourse from '../../database/models/CoachCourse';

/** Phrase the person must type to remove every course on the device. */
export const RESET_ALL_PHRASE = 'BORRAR TODO';

const identifier = /^[a-zA-Z0-9_-]{1,64}$/;

function assertIdentifier(value: string) {
  if (!identifier.test(value)) {
    throw new Error('Invalid identifier');
  }
}

export type CourseSummary = {
  courseId: string;
  revision: number;
  updatedAt: number;
};

/**
 * Destructive operations for trusted UI code, never for the model. Each one
 * needs the exact name of what will be removed, typed by the person. They only
 * touch coach_courses: chats, Pals and settings are never affected.
 */
export class WatermelonCoachCourseAdmin {
  constructor(private readonly db: Database) {}

  private courses() {
    return this.db.get<CoachCourse>('coach_courses');
  }

  async listCourses(workspaceId: string): Promise<CourseSummary[]> {
    assertIdentifier(workspaceId);
    return this.db.read(async () => {
      const rows = await this.courses()
        .query(Q.where('workspace_id', workspaceId))
        .fetch();
      return rows
        .map(row => ({
          courseId: row.courseId,
          revision: row.revision,
          updatedAt: row.updatedAt,
        }))
        .sort((a, b) => a.courseId.localeCompare(b.courseId));
    });
  }

  /** Removes one course. Other courses and workspaces are untouched. */
  async deleteCourseConfirmed(
    workspaceId: string,
    courseId: string,
    typedCourseId: string,
  ): Promise<void> {
    assertIdentifier(workspaceId);
    assertIdentifier(courseId);
    if (typedCourseId !== courseId) {
      throw new Error('Typed confirmation does not match the course');
    }
    await this.db.write(async () => {
      const rows = await this.courses()
        .query(
          Q.where('workspace_id', workspaceId),
          Q.where('course_id', courseId),
        )
        .fetch();
      if (rows.length === 0) {
        throw new Error('Course not found');
      }
      await this.db.batch(...rows.map(row => row.prepareDestroyPermanently()));
    });
  }

  /** Removes every course of one workspace; returns how many were removed. */
  async resetWorkspaceConfirmed(
    workspaceId: string,
    typedWorkspaceId: string,
  ): Promise<number> {
    assertIdentifier(workspaceId);
    if (typedWorkspaceId !== workspaceId) {
      throw new Error('Typed confirmation does not match the workspace');
    }
    return this.db.write(async () => {
      const rows = await this.courses()
        .query(Q.where('workspace_id', workspaceId))
        .fetch();
      if (rows.length > 0) {
        await this.db.batch(
          ...rows.map(row => row.prepareDestroyPermanently()),
        );
      }
      return rows.length;
    });
  }

  /** Removes every course on the device; returns how many were removed. */
  async deleteAllConfirmed(phrase: string): Promise<number> {
    if (phrase !== RESET_ALL_PHRASE) {
      throw new Error('Typed confirmation does not match the required phrase');
    }
    return this.db.write(async () => {
      const rows = await this.courses().query().fetch();
      if (rows.length > 0) {
        await this.db.batch(
          ...rows.map(row => row.prepareDestroyPermanently()),
        );
      }
      return rows.length;
    });
  }
}

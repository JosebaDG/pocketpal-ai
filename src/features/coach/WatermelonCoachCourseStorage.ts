import {Q} from '@nozbe/watermelondb';
import type {Database} from '@nozbe/watermelondb';
import {z} from 'zod';

import type CoachCourse from '../../database/models/CoachCourse';
import {CoachCourseRepository} from './CoachCourseRepository';
import type {CoachCourseStorage, CourseScope} from './CoachCourseRepository';

const headerSchema = z
  .object({
    version: z.literal(1),
    workspaceId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    courseId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
    revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  })
  .passthrough();

function header(raw: string, scope: CourseScope) {
  if (raw.length > 2_000_000) {
    throw new Error('Course snapshot exceeds storage limit');
  }
  const data = headerSchema.parse(JSON.parse(raw));
  if (
    data.workspaceId !== scope.workspaceId ||
    data.courseId !== scope.courseId
  ) {
    throw new Error('Course scope mismatch');
  }
  return data;
}

/** One shared PocketPal Database is required; this port is not model-facing. */
export class WatermelonCoachCourseStorage implements CoachCourseStorage {
  constructor(private readonly db: Database) {}

  private async record(scope: CourseScope): Promise<CoachCourse | null> {
    const rows = await this.db
      .get<CoachCourse>('coach_courses')
      .query(
        Q.where('workspace_id', scope.workspaceId),
        Q.where('course_id', scope.courseId),
      )
      .fetch();
    if (rows.length > 1) {
      throw new Error('Duplicate course records');
    }
    return rows[0] ?? null;
  }

  private checkRecord(row: CoachCourse, scope: CourseScope) {
    const data = header(row.snapshotJson, scope);
    if (
      row.workspaceId !== scope.workspaceId ||
      row.courseId !== scope.courseId ||
      row.revision !== data.revision
    ) {
      throw new Error('Course record metadata mismatch');
    }
    return data;
  }

  async read(scope: CourseScope): Promise<string | null> {
    return this.db.read(async () => {
      const row = await this.record(scope);
      if (!row) {
        return null;
      }
      this.checkRecord(row, scope);
      return row.snapshotJson;
    });
  }

  async write(scope: CourseScope, snapshot: string): Promise<void> {
    const incoming = header(snapshot, scope);
    await this.db.write(async () => {
      const row = await this.record(scope);
      if (row) {
        this.checkRecord(row, scope);
        if (incoming.revision === 0 || row.revision !== incoming.revision - 1) {
          throw new Error('Course revision conflict: reload and review');
        }
        await this.db.batch(
          row.prepareUpdate(record => {
            record.snapshotJson = snapshot;
            record.revision = incoming.revision;
            record.updatedAt = Date.now();
          }),
        );
      } else {
        if (incoming.revision !== 0) {
          throw new Error('Course missing during update');
        }
        await this.db.batch(
          this.db.get<CoachCourse>('coach_courses').prepareCreate(record => {
            record.workspaceId = scope.workspaceId;
            record.courseId = scope.courseId;
            record.snapshotJson = snapshot;
            record.revision = 0;
            record.createdAt = Date.now();
            record.updatedAt = record.createdAt;
          }),
        );
      }
    });
  }
}

/** Lazy native entry point, preserving the existing database singleton. */
export async function openLocalCoachCourseRepository(scope: CourseScope) {
  const {database} = await import('../../database');
  return new CoachCourseRepository(
    scope,
    new WatermelonCoachCourseStorage(database),
  );
}

import {Model} from '@nozbe/watermelondb';
import {field} from '@nozbe/watermelondb/decorators';

export default class CoachCourse extends Model {
  static table = 'coach_courses';

  @field('workspace_id') workspaceId!: string;
  @field('course_id') courseId!: string;
  @field('revision') revision!: number;
  @field('snapshot') snapshotJson!: string;
  @field('created_at') createdAt!: number;
  @field('updated_at') updatedAt!: number;
}

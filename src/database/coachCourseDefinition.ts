export const coachCourseDefinition = {
  name: 'coach_courses',
  columns: [
    {name: 'workspace_id', type: 'string' as const, isIndexed: true},
    {name: 'course_id', type: 'string' as const, isIndexed: true},
    {name: 'revision', type: 'number' as const},
    {name: 'snapshot', type: 'string' as const},
    {name: 'created_at', type: 'number' as const},
    {name: 'updated_at', type: 'number' as const},
  ],
};

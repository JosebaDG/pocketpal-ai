import type {TalentEngine, TalentResult, ToolDefinition} from './types';

type Group = {id: string; name: string; weekday: string; time: string};
type Student = {id: string; groupId: string; name: string};
export type SwimAccess = {
  groups: () => Promise<Group[]>;
  students: (groupId: string) => Promise<Student[]>;
};

// Synthetic data only. Replace via a local, protected repository before real use.
export const demoSwimAccess: SwimAccess = {
  groups: async () => [{id: 'demo-a', name: 'Grupo de demostración A', weekday: 'martes', time: '16:00'}],
  students: async groupId => groupId === 'demo-a' ? [
    {id: 'demo-1', groupId, name: 'Lía Demo'},
    {id: 'demo-2', groupId, name: 'Teo Demo'},
  ] : [],
};

const text = (value: unknown): TalentResult => ({type: 'text', summary: JSON.stringify(value)});
const error = (message: string): TalentResult => ({type: 'error', summary: message, errorMessage: message});
const normalise = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export class SwimGroupsEngine implements TalentEngine {
  readonly name = 'swim_groups';
  constructor(private readonly access: SwimAccess) {}
  async execute(args: Record<string, any>): Promise<TalentResult> {
    const groups = await this.access.groups();
    const groupId = typeof args.groupId === 'string' ? args.groupId : '';
    if (!groupId) return text({groups});
    const group = groups.find(g => g.id === groupId);
    if (!group) return error('Grupo desconocido');
    const query = typeof args.studentName === 'string' ? normalise(args.studentName) : '';
    const students = await this.access.students(groupId);
    return text({group, students: query ? students.filter(s => normalise(s.name).includes(query)) : students});
  }
  toToolDefinition(): ToolDefinition {
    return {type: 'function', function: {
      name: this.name,
      description: 'Consulta grupos y coincidencias de alumnos dentro de un grupo. No devuelve contactos.',
      parameters: {type: 'object', properties: {
        groupId: {type: 'string', description: 'ID del grupo; omitir para listar grupos'},
        studentName: {type: 'string', description: 'Nombre a buscar solo dentro del grupo'},
      }, required: []},
    }} as ToolDefinition;
  }
}

export class SwimNoteDraftEngine implements TalentEngine {
  readonly name = 'swim_note_draft';
  constructor(private readonly access: SwimAccess) {}
  async execute(args: Record<string, any>): Promise<TalentResult> {
    const {groupId, studentId, date, observed, discsLeft, discsRight} = args;
    if (![groupId, studentId, date, observed].every(x => typeof x === 'string' && x.trim()))
      return error('Faltan grupo, alumno, fecha u observación');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)))
      return error('Fecha inválida: use AAAA-MM-DD');
    for (const discs of [discsLeft, discsRight]) {
      if (discs !== undefined && (!Number.isInteger(discs) || discs < 0 || discs > 3))
        return error('Los discos por brazo deben ser enteros de 0 a 3');
    }
    const group = (await this.access.groups()).find(g => g.id === groupId);
    if (!group) return error('Grupo desconocido');
    const student = (await this.access.students(groupId)).find(s => s.id === studentId && s.groupId === groupId);
    if (!student) return error('Alumno no verificado en el grupo indicado');
    return text({status: 'DRAFT_NOT_SAVED', group, student: {id: student.id, name: student.name},
      date, observed: observed.trim(), discsLeft: discsLeft ?? null, discsRight: discsRight ?? null});
  }
  toToolDefinition(): ToolDefinition {
    return {type: 'function', function: {
      name: this.name,
      description: 'Prepara una observación para revisión; NUNCA guarda ni envía datos.',
      parameters: {type: 'object', properties: {
        groupId: {type: 'string'}, studentId: {type: 'string'}, date: {type: 'string'},
        observed: {type: 'string'}, discsLeft: {type: 'integer'}, discsRight: {type: 'integer'},
      }, required: ['groupId', 'studentId', 'date', 'observed']},
    }} as ToolDefinition;
  }
}

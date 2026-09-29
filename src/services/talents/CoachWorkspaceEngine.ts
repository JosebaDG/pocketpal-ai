import * as RNFS from '@dr.pogodin/react-native-fs';
import type {TalentEngine, TalentResult, ToolDefinition} from './types';
import {CoachRoster, CoachRosterSession, parseCoachRoster} from '../../features/coach/CoachRoster';
import {pickJsonFile} from '../../utils/importUtils';

const demo = parseCoachRoster(JSON.stringify({schemaVersion: 1, groups: [
  {id: 'swim-demo', title: 'Natación — grupo ficticio', sport: 'swimming', weekday: 'martes', startTime: '16:00'},
  {id: 'tennis-demo', title: 'Tenis — grupo ficticio', sport: 'tennis', weekday: 'jueves', startTime: '17:00'},
], participants: [
  {id: 'learner-1', groupId: 'swim-demo', displayName: 'Lía Ejemplo', status: 'enrolled'},
  {id: 'learner-2', groupId: 'swim-demo', displayName: 'Teo Ejemplo', status: 'waiting'},
  {id: 'learner-3', groupId: 'tennis-demo', displayName: 'Noa Ejemplo', status: 'enrolled'},
]}));
const response = (data: unknown): TalentResult => ({type: 'text', summary: JSON.stringify(data)});
const fail = (message: string): TalentResult => ({type: 'error', summary: message, errorMessage: message});

/** Beta workspace: data lives only in this engine instance; no storage or sending. */
export class CoachWorkspaceEngine implements TalentEngine {
  readonly name = 'coach_workspace';
  private roster: CoachRoster = demo;
  private session = new CoachRosterSession(demo);
  private selectedGroupId: string | null = null;

  async execute(args: Record<string, any>): Promise<TalentResult> {
    const action = args.action;
    try {
      if (action === 'import_roster') {
        // The operating-system picker requires the person to select a file.
        const uri = await pickJsonFile();
        if (!uri) return fail('File selection cancelled');
        const raw = await RNFS.readFile(uri, 'utf8');
        const candidate = parseCoachRoster(raw);
        this.roster = candidate;
        this.session = new CoachRosterSession(candidate);
        this.selectedGroupId = null;
        return response({status: 'IMPORTED_IN_MEMORY_NOT_PERSISTED', groups: candidate.groups.length,
          participants: candidate.participants.length, selectedGroup: null});
      }
      if (action === 'list_groups') return response({groups: this.session.listGroups()});
      if (action === 'select_group') {
        if (typeof args.groupId !== 'string') return fail('Choose a groupId');
        const group = this.session.selectGroup(args.groupId);
        this.selectedGroupId = group.id;
        return response({selectedGroup: group});
      }
      if (!this.selectedGroupId) return fail('Choose a group first with select_group');
      if (action === 'find_participants') {
        if (typeof args.query !== 'string') return fail('Provide a name to search');
        return response({groupId: this.selectedGroupId, matches: this.session.findParticipants(args.query)});
      }
      if (action === 'draft_note') {
        if (typeof args.participantId !== 'string' || typeof args.observed !== 'string')
          return fail('Provide participantId and observed fact');
        return response({kind: 'observation', ...this.session.draftObservation(args.participantId, args.observed), status: 'DRAFT_NOT_SAVED'});
      }
      if (action === 'group_snapshot') {
        const members = this.roster.participants.filter(p => p.groupId === this.selectedGroupId);
        return response({groupId: this.selectedGroupId, enrolled: members.filter(p => p.status === 'enrolled').length,
          waiting: members.filter(p => p.status === 'waiting').length, assessment: 'NO_HISTORY_AVAILABLE'});
      }
      if (action === 'draft_message') {
        const person = this.roster.participants.find(p => p.id === args.participantId && p.groupId === this.selectedGroupId && p.status === 'enrolled');
        if (!person) return fail('Participant not enrolled in selected group');
        if (typeof args.message !== 'string' || !args.message.trim() || args.message.length > 2000) return fail('Invalid message');
        return response({kind: 'message', participantId: person.id, groupId: this.selectedGroupId,
          body: args.message.trim(), recipient: 'NOT_VERIFIED', status: 'DRAFT_NOT_SENT'});
      }
      return fail('Unknown coach action');
    } catch { return fail('Action failed or selected file is not a valid coach roster'); }
  }

  toToolDefinition(): ToolDefinition {
    return {type: 'function', function: {
      name: this.name,
      description: 'Local coaching beta. User-picked JSON import, group selection, scoped lookup, drafts and headcounts. Import is memory-only; never saves or sends.',
      parameters: {type: 'object', properties: {
        action: {type: 'string', enum: ['import_roster', 'list_groups', 'select_group', 'find_participants', 'draft_note', 'group_snapshot', 'draft_message']},
        groupId: {type: 'string'}, query: {type: 'string'}, participantId: {type: 'string'},
        observed: {type: 'string'}, message: {type: 'string'},
      }, required: ['action']},
    }} as ToolDefinition;
  }
}

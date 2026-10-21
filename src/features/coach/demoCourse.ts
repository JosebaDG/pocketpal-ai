import {parseCoachRoster} from './CoachRoster';
import type {CoachRoster} from './CoachRoster';

/** Workspace used by the Coach screen on this device. */
export const COACH_WORKSPACE_ID = 'local';
/** Course id of the built-in fictitious course. */
export const DEMO_COURSE_ID = 'curso-ficticio';

/**
 * Fictitious roster for trying the full cycle on a phone. Every name is made
 * up and marked as such: never replace it with real children's data.
 */
const DEMO_ROSTER = {
  schemaVersion: 1,
  groups: [
    {
      id: 'lun-1700',
      title: 'Lunes 17:00 · Familiarización (ficticio)',
      sport: 'swimming',
      weekday: 'lunes',
      startTime: '17:00',
    },
    {
      id: 'lun-1735',
      title: 'Lunes 17:35 · Adaptación (ficticio)',
      sport: 'swimming',
      weekday: 'lunes',
      startTime: '17:35',
    },
    {
      id: 'mie-1700',
      title: 'Miércoles 17:00 · Familiarización (ficticio)',
      sport: 'swimming',
      weekday: 'miércoles',
      startTime: '17:00',
    },
    {
      id: 'sab-1000',
      title: 'Sábado 10:00 · Perfeccionamiento (ficticio)',
      sport: 'swimming',
      weekday: 'sábado',
      startTime: '10:00',
    },
  ],
  participants: [
    ['f01', 'lun-1700', 'Ana Prueba'],
    ['f02', 'lun-1700', 'Bruno Ficticio'],
    ['f03', 'lun-1700', 'Carla Ejemplo'],
    ['f04', 'lun-1735', 'Dani Prueba'],
    ['f05', 'lun-1735', 'Eva Ficticia'],
    ['f06', 'mie-1700', 'Fran Ejemplo'],
    ['f07', 'mie-1700', 'Gala Prueba'],
    ['f08', 'mie-1700', 'Hugo Ficticio'],
    ['f09', 'sab-1000', 'Iris Ejemplo'],
    ['f10', 'sab-1000', 'Jon Prueba'],
  ]
    .map(([id, groupId, displayName]) => ({
      id,
      groupId,
      displayName,
      status: 'enrolled',
    }))
    .concat([
      {
        id: 'f11',
        groupId: 'mie-1700',
        displayName: 'Lía Espera (ficticia)',
        status: 'waiting',
      },
    ]),
};

/** A fresh, validated copy of the fictitious roster. */
export function demoRoster(): CoachRoster {
  return parseCoachRoster(JSON.stringify(DEMO_ROSTER));
}

export type RosterPreview = {
  groups: number;
  enrolled: number;
  waiting: number;
};

/** What the person reviews before confirming an import. */
export function previewRoster(roster: CoachRoster): RosterPreview {
  return {
    groups: roster.groups.length,
    enrolled: roster.participants.filter(p => p.status === 'enrolled').length,
    waiting: roster.participants.filter(p => p.status === 'waiting').length,
  };
}

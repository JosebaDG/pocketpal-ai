import React from 'react';

import {render, fireEvent, waitFor, act} from '../../../../jest/test-utils';

import {CoachScreen} from '../CoachScreen';
import {CoachCourseRepository} from '../../../features/coach/CoachCourseRepository';
import type {CoachCourseStorage} from '../../../features/coach/CoachCourseRepository';
import type {CoachCourseService} from '../../../features/coach/coachCourseService';
import {coachActiveCourse} from '../../../features/coach/coachCourseAccess';

// Wednesday 21 October 2026, 19:00 local time.
const now = () => new Date(2026, 9, 21, 19, 0);

/** Same repository as on the phone, over an in-memory store. */
function memoryService() {
  const values = new Map<string, string>();
  let last: string | null = null;
  const storage: CoachCourseStorage = {
    read: async scope => values.get(scope.courseId) ?? null,
    write: jest.fn(async (scope, value) => {
      values.set(scope.courseId, value);
    }),
  };
  const repo = (courseId: string) =>
    new CoachCourseRepository({workspaceId: 'local', courseId}, storage);
  const service: CoachCourseService = {
    listCourseIds: async () => [...values.keys()].sort(),
    snapshot: courseId => repo(courseId).snapshot(),
    create: (courseId, roster) => repo(courseId).createConfirmed(roster),
    confirmNote: (courseId, draft, at) =>
      repo(courseId).confirmNoteDraft(draft, at),
    lastCourseId: async () => last,
    rememberCourseId: async id => {
      last = id;
    },
  };
  const notes = () =>
    JSON.parse(values.get('curso-ficticio') ?? '{"studentNotes":[]}')
      .studentNotes as Array<{text: string; participantId: string}>;
  return {service, notes, storage};
}

const noFiles = {pickRosterJson: jest.fn(async () => null)};

async function loadDemo(service: CoachCourseService) {
  const screen = render(
    <CoachScreen service={service} fileAccess={noFiles} now={now} />,
  );
  fireEvent.press(await screen.findByTestId('coach-load-demo'));
  await screen.findByTestId('coach-import-preview');
  expect(
    screen.getByText('4 grupos · 10 inscritos · 1 en lista de espera'),
  ).toBeTruthy();
  fireEvent.press(screen.getByTestId('coach-confirm-import'));
  await screen.findByTestId('coach-group-lun-1700');
  return screen;
}

async function writeNote(
  screen: ReturnType<typeof render>,
  groupId: string,
  studentId: string,
  text: string,
) {
  fireEvent.press(screen.getByTestId(`coach-group-${groupId}`));
  fireEvent.press(await screen.findByTestId(`coach-student-${studentId}`));
  fireEvent.changeText(await screen.findByTestId('coach-note-input'), text);
  fireEvent.press(screen.getByTestId('coach-review-note'));
  await screen.findByTestId('coach-note-review');
}

afterEach(() => coachActiveCourse.set(null));

describe('CoachScreen: MVP 1 cycle with fictitious data', () => {
  it('loads the demo course, saves a reviewed note and shows it back', async () => {
    const {service, notes} = memoryService();
    const screen = await loadDemo(service);
    expect(coachActiveCourse.get()).toEqual({
      workspaceId: 'local',
      courseId: 'curso-ficticio',
    });

    await writeNote(screen, 'lun-1700', 'f01', 'Patalea mejor con tabla');
    expect(screen.getByText('Alumno: Ana Prueba')).toBeTruthy();
    expect(screen.getByText('Sesión: 2026-10-19')).toBeTruthy();
    fireEvent.press(screen.getByTestId('coach-save-note'));

    expect(await screen.findByText('Guardada.')).toBeTruthy();
    expect(screen.getByText('Patalea mejor con tabla')).toBeTruthy();
    expect(screen.getByText('Sesión 2026-10-19')).toBeTruthy();
    expect(notes()).toHaveLength(1);
    expect(notes()[0]).toMatchObject({
      participantId: 'f01',
      text: 'Patalea mejor con tabla',
    });
  });

  it('does not duplicate a note on a double tap or a second confirmation', async () => {
    const {service, notes} = memoryService();
    const screen = await loadDemo(service);
    await writeNote(screen, 'mie-1700', 'f06', 'Mete la cara sin miedo');
    const save = screen.getByTestId('coach-save-note');
    await act(async () => {
      fireEvent.press(save);
      fireEvent.press(save);
    });
    await screen.findByText('Guardada.');
    expect(notes()).toHaveLength(1);

    await writeNote(screen, 'mie-1700', 'f06', ' Mete la cara  sin miedo ');
    fireEvent.press(screen.getByTestId('coach-save-note'));
    expect(
      await screen.findByText(
        'Esta nota ya estaba guardada: no se ha duplicado.',
      ),
    ).toBeTruthy();
    expect(notes()).toHaveLength(1);
  });

  it('reopens the last course after the app is closed and keeps the notes', async () => {
    const {service} = memoryService();
    const first = await loadDemo(service);
    await writeNote(first, 'sab-1000', 'f09', 'Ya bucea dos metros');
    fireEvent.press(first.getByTestId('coach-save-note'));
    await first.findByText('Guardada.');
    first.unmount();

    const again = render(
      <CoachScreen service={service} fileAccess={noFiles} now={now} />,
    );
    fireEvent.press(await again.findByTestId('coach-group-sab-1000'));
    fireEvent.press(await again.findByTestId('coach-student-f09'));
    expect(await again.findByText('Ya bucea dos metros')).toBeTruthy();
  });

  it('does not offer students on the waiting list', async () => {
    const {service} = memoryService();
    const screen = await loadDemo(service);
    fireEvent.press(screen.getByTestId('coach-group-mie-1700'));
    await screen.findByTestId('coach-student-f06');
    expect(screen.queryByTestId('coach-student-f11')).toBeNull();
    expect(
      screen.getByText(
        '1 en lista de espera: no admiten notas hasta que se inscriban.',
      ),
    ).toBeTruthy();
  });

  it('imports a JSON listing only after the preview is confirmed', async () => {
    const {service, storage} = memoryService();
    const json = JSON.stringify({
      schemaVersion: 1,
      groups: [
        {
          id: 'g1',
          title: 'Grupo inventado',
          sport: 'swimming',
          weekday: 'martes',
          startTime: '18:00',
        },
      ],
      participants: [
        {
          id: 'x1',
          groupId: 'g1',
          displayName: 'Nombre Falso',
          status: 'enrolled',
        },
      ],
    });
    const files = {pickRosterJson: jest.fn(async () => json)};
    const screen = render(
      <CoachScreen service={service} fileAccess={files} now={now} />,
    );
    fireEvent.press(await screen.findByTestId('coach-import-json'));
    await screen.findByText('1 grupos · 1 inscritos · 0 en lista de espera');
    expect(storage.write).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('coach-confirm-import'));
    fireEvent.press(await screen.findByTestId('coach-group-g1'));
    expect(await screen.findByTestId('coach-student-x1')).toBeTruthy();
    expect(screen.getByText('Curso: importado-20261021-1900')).toBeTruthy();
  });

  it('shows an error and writes nothing for an invalid listing', async () => {
    const {service, storage} = memoryService();
    const files = {pickRosterJson: jest.fn(async () => '{"nope": true}')};
    const screen = render(
      <CoachScreen service={service} fileAccess={files} now={now} />,
    );
    fireEvent.press(await screen.findByTestId('coach-import-json'));
    await waitFor(() => expect(screen.getByTestId('coach-error')).toBeTruthy());
    expect(storage.write).not.toHaveBeenCalled();
  });
});

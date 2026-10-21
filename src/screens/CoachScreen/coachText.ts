/**
 * Spanish copy for the Coach screen. Kept here, not in src/locales, while the
 * screen is a fork-only MVP: moving it to l10n means touching every language.
 */
export const coachText = {
  banner: 'MVP 1 · solo datos ficticios. No cargues listados reales de niños.',
  loading: 'Cargando…',
  error: (message: string) => `No se ha podido: ${message}`,
  chooseCourse: 'Elige un curso',
  fictitiousOnly:
    'Para probar, carga el curso de prueba. Todos sus nombres son inventados.',
  openCourse: (id: string) => `Abrir «${id}»`,
  loadDemo: 'Cargar curso de prueba (ficticio)',
  importJson: 'Importar listado (JSON)',
  demoSource:
    'Origen: curso de prueba incluido en la app (nombres inventados).',
  jsonSource: 'Origen: archivo JSON elegido en el móvil.',
  reviewImport: 'Revisa antes de importar',
  importCounts: (groups: number, enrolled: number, waiting: number) =>
    `${groups} grupos · ${enrolled} inscritos · ${waiting} en lista de espera`,
  courseName: (id: string) => `Curso: ${id}`,
  confirmImport: 'Confirmar importación',
  cancel: 'Cancelar',
  changeCourse: 'Cambiar de curso',
  step1: '1 · Grupo',
  step2: '2 · Alumno',
  waiting: (count: number) =>
    `${count} en lista de espera: no admiten notas hasta que se inscriban.`,
  step3: '3 · Nota',
  sessionOf: (date: string) => `Sesión del ${date} (la última de este grupo).`,
  dictateHint:
    'Para dictar, toca el micrófono del teclado del iPhone. El texto se queda en el móvil.',
  notePlaceholder: (name: string) => `Qué has visto hoy en ${name}…`,
  reviewNote: 'Revisar nota',
  step4: '4 · Revisa y guarda',
  reviewWho: (name: string) => `Alumno: ${name}`,
  reviewGroup: (title: string) => `Grupo: ${title}`,
  reviewSession: (date: string) => `Sesión: ${date}`,
  save: 'Guardar',
  edit: 'Editar',
  saved: 'Guardada.',
  alreadySaved: 'Esta nota ya estaba guardada: no se ha duplicado.',
  step5: (name: string) => `5 · Notas de ${name}`,
  noNotes: 'Todavía no hay notas.',
  noteMeta: (date: string) => `Sesión ${date}`,
};

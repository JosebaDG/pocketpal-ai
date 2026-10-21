import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ScrollView, View} from 'react-native';

import {Button, Chip, Text, TextInput} from 'react-native-paper';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';

import {useTheme} from '../../hooks';
import type {CourseSnapshot} from '../../features/coach/CoachCourseRepository';
import {studentHistory} from '../../features/coach/CoachHistory';
import {lastSessionDate} from '../../features/coach/CoachNoteDraft';
import type {NoteDraft} from '../../features/coach/CoachNoteDraft';
import {parseCoachRoster} from '../../features/coach/CoachRoster';
import type {CoachRoster} from '../../features/coach/CoachRoster';
import {clockFrom} from '../../features/coach/CoachSchedule';
import {coachActiveCourse} from '../../features/coach/coachCourseAccess';
import {
  importedCourseId,
  localCoachCourseService,
} from '../../features/coach/coachCourseService';
import type {CoachCourseService} from '../../features/coach/coachCourseService';
import {
  COACH_WORKSPACE_ID,
  DEMO_COURSE_ID,
  demoRoster,
  previewRoster,
} from '../../features/coach/demoCourse';
import {defaultCoachFileAccess} from '../../services/talents/coachFileAccess';
import type {CoachFileAccess} from '../../services/talents/coachFileAccess';

import {createStyles} from './styles';
import {coachText as t} from './coachText';

type Props = {
  service?: CoachCourseService;
  fileAccess?: CoachFileAccess;
  now?: () => Date;
};

type PendingImport = {courseId: string; roster: CoachRoster; source: string};
type Saved = {created: boolean; noteId: string};

const MAX_TEXT = 2000;

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * MVP 1: closes the loop with a fictitious course. Load or import a listing,
 * pick group and student, write or dictate a note, review, save once, see it.
 */
export const CoachScreen: React.FC<Props> = ({
  service = localCoachCourseService,
  fileAccess = defaultCoachFileAccess,
  now = () => new Date(),
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets);

  const [loading, setLoading] = useState(true);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [snap, setSnap] = useState<CourseSnapshot | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [reviewing, setReviewing] = useState<NoteDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const openCourse = useCallback(
    async (id: string) => {
      const data = await service.snapshot(id);
      setCourseId(id);
      setSnap(data);
      setGroupId(null);
      setParticipantId(null);
      setText('');
      setReviewing(null);
      setSaved(null);
      coachActiveCourse.set({workspaceId: COACH_WORKSPACE_ID, courseId: id});
      await service.rememberCourseId(id);
    },
    [service],
  );

  // On open: reload the course used last time, so a closed app keeps its notes.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ids = await service.listCourseIds();
        if (!alive) {
          return;
        }
        setCourseIds(ids);
        const last = await service.lastCourseId();
        const pick = last && ids.includes(last) ? last : null;
        if (pick && alive) {
          await openCourse(pick);
        }
      } catch (e) {
        if (alive) {
          setError(errorText(e));
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [service, openCourse]);

  const group = useMemo(
    () => snap?.roster.groups.find(item => item.id === groupId) ?? null,
    [snap, groupId],
  );
  const students = useMemo(
    () =>
      snap?.roster.participants.filter(
        person => person.groupId === groupId && person.status === 'enrolled',
      ) ?? [],
    [snap, groupId],
  );
  const waiting = useMemo(
    () =>
      snap?.roster.participants.filter(
        person => person.groupId === groupId && person.status === 'waiting',
      ).length ?? 0,
    [snap, groupId],
  );
  const student = students.find(person => person.id === participantId) ?? null;
  const sessionDate = group
    ? lastSessionDate(group.weekday, clockFrom(now()).date)
    : null;
  const history = useMemo(
    () =>
      snap && participantId
        ? [...studentHistory(snap, participantId).notes].reverse()
        : [],
    [snap, participantId],
  );

  const run = async (task: () => Promise<void>) => {
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    }
  };

  const prepareDemo = () =>
    run(async () => {
      if (courseIds.includes(DEMO_COURSE_ID)) {
        await openCourse(DEMO_COURSE_ID);
        return;
      }
      setPending({
        courseId: DEMO_COURSE_ID,
        roster: demoRoster(),
        source: t.demoSource,
      });
    });

  const prepareImport = () =>
    run(async () => {
      const raw = await fileAccess.pickRosterJson();
      if (raw === null) {
        return;
      }
      setPending({
        courseId: importedCourseId(now()),
        roster: parseCoachRoster(raw),
        source: t.jsonSource,
      });
    });

  const confirmImport = () =>
    run(async () => {
      if (!pending) {
        return;
      }
      if (!courseIds.includes(pending.courseId)) {
        await service.create(pending.courseId, pending.roster);
      }
      setCourseIds(ids =>
        ids.includes(pending.courseId)
          ? ids
          : [...ids, pending.courseId].sort(),
      );
      setPending(null);
      await openCourse(pending.courseId);
    });

  const changeCourse = () =>
    run(async () => {
      setCourseId(null);
      setSnap(null);
      setGroupId(null);
      setParticipantId(null);
      setReviewing(null);
      setSaved(null);
      coachActiveCourse.set(null);
      await service.rememberCourseId(null);
      setCourseIds(await service.listCourseIds());
    });

  const review = () => {
    if (!group || !student || !sessionDate || !text.trim()) {
      return;
    }
    setSaved(null);
    setReviewing({
      kind: 'student',
      groupId: group.id,
      participantId: student.id,
      sessionDate,
      text: text.trim(),
    });
  };

  const save = () =>
    run(async () => {
      // Second line of defence: the repository is idempotent anyway.
      if (!reviewing || !courseId || savingRef.current) {
        return;
      }
      savingRef.current = true;
      setSaving(true);
      try {
        const result = await service.confirmNote(
          courseId,
          reviewing,
          now().toISOString(),
        );
        setSnap(result.snapshot);
        setSaved({created: result.created, noteId: result.noteId});
        setReviewing(null);
        setText('');
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    });

  const selectGroup = (id: string) => {
    setGroupId(id);
    setParticipantId(null);
    setReviewing(null);
    setSaved(null);
  };

  const selectStudent = (id: string) => {
    setParticipantId(id);
    setReviewing(null);
    setSaved(null);
  };

  const renderNoCourse = () => (
    <View style={styles.section}>
      <Text style={styles.title}>{t.chooseCourse}</Text>
      <Text style={styles.hint}>{t.fictitiousOnly}</Text>
      {courseIds.map(id => (
        <Button
          key={id}
          mode="outlined"
          style={styles.button}
          testID={`coach-course-${id}`}
          onPress={() => run(() => openCourse(id))}>
          {t.openCourse(id)}
        </Button>
      ))}
      <Button
        mode="contained"
        style={styles.button}
        testID="coach-load-demo"
        onPress={prepareDemo}>
        {t.loadDemo}
      </Button>
      <Button
        mode="outlined"
        style={styles.button}
        testID="coach-import-json"
        onPress={prepareImport}>
        {t.importJson}
      </Button>
    </View>
  );

  const renderPending = (item: PendingImport) => {
    const counts = previewRoster(item.roster);
    return (
      <View style={styles.section} testID="coach-import-preview">
        <Text style={styles.title}>{t.reviewImport}</Text>
        <Text style={styles.body}>{item.source}</Text>
        <Text style={styles.body}>
          {t.importCounts(counts.groups, counts.enrolled, counts.waiting)}
        </Text>
        <Text style={styles.hint}>{t.courseName(item.courseId)}</Text>
        <Button
          mode="contained"
          style={styles.button}
          testID="coach-confirm-import"
          onPress={confirmImport}>
          {t.confirmImport}
        </Button>
        <Button
          mode="text"
          style={styles.button}
          onPress={() => setPending(null)}>
          {t.cancel}
        </Button>
      </View>
    );
  };

  const renderCourse = (data: CourseSnapshot) => (
    <>
      <View style={styles.section}>
        <Text style={styles.title}>{t.courseName(data.courseId)}</Text>
        <Button mode="text" compact onPress={changeCourse}>
          {t.changeCourse}
        </Button>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t.step1}</Text>
        <View style={styles.chips}>
          {data.roster.groups.map(item => (
            <Chip
              key={item.id}
              selected={item.id === groupId}
              showSelectedCheck
              style={styles.chip}
              testID={`coach-group-${item.id}`}
              onPress={() => selectGroup(item.id)}>
              {item.title}
            </Chip>
          ))}
        </View>
      </View>

      {group && (
        <View style={styles.section}>
          <Text style={styles.label}>{t.step2}</Text>
          {waiting > 0 && <Text style={styles.hint}>{t.waiting(waiting)}</Text>}
          <View style={styles.chips}>
            {students.map(person => (
              <Chip
                key={person.id}
                selected={person.id === participantId}
                showSelectedCheck
                style={styles.chip}
                testID={`coach-student-${person.id}`}
                onPress={() => selectStudent(person.id)}>
                {person.displayName}
              </Chip>
            ))}
          </View>
        </View>
      )}

      {group && student && sessionDate && (
        <View style={styles.section}>
          <Text style={styles.label}>{t.step3}</Text>
          <Text style={styles.hint}>{t.sessionOf(sessionDate)}</Text>
          <Text style={styles.hint}>{t.dictateHint}</Text>
          <TextInput
            mode="outlined"
            multiline
            maxLength={MAX_TEXT}
            value={text}
            onChangeText={value => {
              setText(value);
              setReviewing(null);
            }}
            placeholder={t.notePlaceholder(student.displayName)}
            style={styles.input}
            testID="coach-note-input"
          />
          <Button
            mode="contained-tonal"
            style={styles.button}
            disabled={!text.trim()}
            testID="coach-review-note"
            onPress={review}>
            {t.reviewNote}
          </Button>
        </View>
      )}

      {reviewing && student && group && (
        <View style={styles.card} testID="coach-note-review">
          <Text style={styles.label}>{t.step4}</Text>
          <Text style={styles.body}>{t.reviewWho(student.displayName)}</Text>
          <Text style={styles.body}>{t.reviewGroup(group.title)}</Text>
          <Text style={styles.body}>
            {t.reviewSession(reviewing.sessionDate)}
          </Text>
          <Text style={styles.quote}>{reviewing.text}</Text>
          <Button
            mode="contained"
            style={styles.button}
            disabled={saving}
            loading={saving}
            testID="coach-save-note"
            onPress={save}>
            {t.save}
          </Button>
          <Button
            mode="text"
            style={styles.button}
            disabled={saving}
            onPress={() => setReviewing(null)}>
            {t.edit}
          </Button>
        </View>
      )}

      {saved && (
        <Text style={styles.success} testID="coach-saved">
          {saved.created ? t.saved : t.alreadySaved}
        </Text>
      )}

      {student && (
        <View style={styles.section} testID="coach-history">
          <Text style={styles.label}>{t.step5(student.displayName)}</Text>
          {history.length === 0 && <Text style={styles.hint}>{t.noNotes}</Text>}
          {history.map(note => (
            <View key={note.id} style={styles.note}>
              <Text style={styles.hint}>
                {t.noteMeta(note.sessionDate ?? note.at.slice(0, 10))}
              </Text>
              <Text style={styles.body}>{note.text}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.banner}>{t.banner}</Text>
        {error && (
          <Text style={styles.error} testID="coach-error">
            {t.error(error)}
          </Text>
        )}
        {loading ? (
          <Text style={styles.hint}>{t.loading}</Text>
        ) : pending ? (
          renderPending(pending)
        ) : snap ? (
          renderCourse(snap)
        ) : (
          renderNoCourse()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

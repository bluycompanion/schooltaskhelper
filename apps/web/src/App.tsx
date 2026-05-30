import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  SchoolTaskApiClient,
  buildViewHref,
  getVisibleActions,
  ApiError,
  type ActionDescriptor,
  type ChildProgress,
  type Difficulty,
  type FeedbackAnimation,
  type PlannedWindow,
  type TaskActionId,
  type TaskComment,
  type TaskEvent,
  type TaskStatus,
  type TaskSummary,
} from './api/apiClient';
import { getApiBaseUrl, getLocalViewContext, isLocalDevMode } from './config';
import './styles.css';

interface LoadState {
  tasks: TaskSummary[];
  progress: ChildProgress | null;
  animations: FeedbackAnimation[];
}

type CommentsState = {
  items: TaskComment[];
  loading: boolean;
  error: string | null;
  draft: string;
  saving: boolean;
  inputError: string | null;
};

const difficultyLabel: Record<Difficulty, string> = {
  easy: 'Enkel',
  medium: 'Medel',
  hard: 'Svår',
  unknown: 'Inte valt',
};

const planningLabel: Record<PlannedWindow, string> = {
  today: 'Idag',
  tomorrow: 'Imorgon',
  this_week: 'Denna vecka',
  next_week: 'Nästa vecka',
  unknown: 'Vet inte än',
};

const statusLabel: Record<string, string> = {
  received: 'Ny',
  started: 'Påbörjad',
  thinks_done: 'Tror klar',
  confirmed_done: 'Klar',
};

const sourceLabel: Record<string, string> = {
  school_platform: 'Skolplattformen',
  manual: 'Manuell',
};

function hungerLabel(progress: ChildProgress | null): string {
  if (!progress || progress.hunger_capacity <= 0) return 'Bra läge';
  const ratio = progress.hunger_score / progress.hunger_capacity;
  if (ratio <= 0.33) return 'Bra läge';
  if (ratio <= 0.66) return 'Lite att planera';
  return 'Fullt upp';
}

function onlineErrorCopy(error: unknown, fallback = 'Det gick inte att spara just nu. Försök igen.'): string {
  if (error instanceof ApiError) {
    const payloadErr = (error.payload as any)?.error;
    if (error.status === 404 && typeof payloadErr === 'string' && payloadErr.toLowerCase().includes('not found')) {
      return 'API hittades inte (404). Kontrollera proxy/base-url för /dev/schooltaskhelper.';
    }
    if (payloadErr) return payloadErr;
    return `${fallback} [HTTP ${error.status}]`;
  }
  const details = error instanceof Error ? ` [Detaljer: ${error.message} (${error.name})]` : ` [Detaljer: ${String(error)}]`;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Du behöver internet för att använda appen.' + details;
  if (error instanceof TypeError) return 'Du behöver internet för att använda appen.' + details;
  return fallback + details;
}

function taskHelpText(task: TaskSummary, role: string): string {
  if (task.status === 'thinks_done' && role === 'child') return 'Väntar på att en vuxen kollar.';
  if (task.status === 'confirmed_done') return 'Uppgiften är klar.';
  return 'Gör ett val för att komma vidare.';
}

function nextStatusForAction(actionId: TaskActionId) {
  if (actionId === 'mark_started') return 'started';
  if (actionId === 'mark_thinks_done') return 'thinks_done';
  if (actionId === 'confirm_done') return 'confirmed_done';
  return null;
}

function buttonSavingLabel(actionId: TaskActionId): string {
  if (actionId === 'mark_started' || actionId === 'mark_thinks_done') return 'Markerar…';
  if (actionId === 'comment') return 'Skickar…';
  return 'Sparar…';
}

function successCopy(actionId: TaskActionId): string {
  if (actionId === 'set_difficulty') return 'Bra, nu vet vi hur den känns.';
  if (actionId === 'set_planning') return 'Snyggt, nu finns en plan.';
  if (actionId === 'mark_started') return 'Bra start!';
  if (actionId === 'mark_thinks_done') return 'Toppen. Nu kan en vuxen kolla.';
  if (actionId === 'confirm_done') return 'Klar! Du fick stjärnor. 🌟';
  if (actionId === 'reject_done') return 'Uppgiften skickades tillbaka på ett snällt sätt.';
  return 'Sparat.';
}

function actionKey(taskId: string, actionId: TaskActionId | string): string {
  return `${taskId}:${actionId}`;
}

function parseEventPayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson || '{}');
    if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  } catch {
    // Keep timeline resilient if one event payload is malformed.
  }
  return {};
}

export default function App() {
  const context = useMemo(() => getLocalViewContext(), []);
  const isDevMode = useMemo(() => isLocalDevMode(), []);
  const client = useMemo(
    () => new SchoolTaskApiClient({ baseUrl: getApiBaseUrl(), context }),
    [context],
  );
  const [state, setState] = useState<LoadState>({ tasks: [], progress: null, animations: [] });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [commentsByTask, setCommentsByTask] = useState<Record<string, CommentsState>>({});
  const [eventsByTask, setEventsByTask] = useState<Record<string, TaskEvent[]>>({});
  const [activePopup, setActivePopup] = useState<{ taskId: string, type: 'difficulty' | 'planning' | 'status' } | null>(null);
  const [flyingEmojis, setFlyingEmojis] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);

  const [savingActions, setSavingActions] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; motion: boolean } | null>(null);
  const playedAnimations = useRef<Set<string>>(new Set());

  const loadAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setListError(null);
    try {
      const [tasks, progress] = await Promise.all([
        client.listTasks(context.childUserId),
        client.getProgress(context.childUserId),
      ]);
      const animations = context.role === 'child' ? await client.getPendingAnimations(context.childUserId) : [];
      setState({ tasks, progress, animations });
    } catch (error) {
      setListError(onlineErrorCopy(error, 'Det gick inte att hämta uppgifterna just nu.'));
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [client, context.childUserId, context.role]);

  useEffect(() => {
    void loadAll(true);
  }, [loadAll]);

  const loadComments = useCallback(async (taskId: string, force = false) => {
    if (!force && commentsByTask[taskId]?.items.length) return;
    setCommentsByTask((current) => ({
      ...current,
      [taskId]: {
        items: current[taskId]?.items ?? [],
        draft: current[taskId]?.draft ?? '',
        saving: current[taskId]?.saving ?? false,
        inputError: null,
        loading: true,
        error: null,
      },
    }));
    try {
      const comments = await client.listComments(taskId);
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: { ...(current[taskId] ?? emptyCommentsState()), items: comments, loading: false, error: null },
      }));
    } catch (error) {
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? emptyCommentsState()),
          loading: false,
          error: onlineErrorCopy(error, 'Kommentarerna kunde inte hämtas just nu.'),
        },
      }));
    }
  }, [client, commentsByTask]);

  const loadEvents = useCallback(async (taskId: string) => {
    try {
      const events = await client.listEvents(taskId);
      setEventsByTask((current) => ({ ...current, [taskId]: events }));
    } catch (error) {
      console.error('Kunde inte hämta händelser', error);
    }
  }, [client]);

  const toggleExpanded = (task: TaskSummary) => {
    const nextTaskId = expandedTaskId === task.id ? null : task.id;
    setExpandedTaskId(nextTaskId);
    if (nextTaskId) {
      void loadEvents(task.id);
      void loadComments(task.id);
    }
  };

  const spawnEmoji = (emoji: string, e?: React.MouseEvent) => {
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    if (e && 'clientX' in e) {
      x = e.clientX - 20;
      y = e.clientY - 20;
    }
    const newEmoji = { id: Math.random().toString(), emoji, x, y };
    setFlyingEmojis(prev => [...prev, newEmoji]);
    
    setTimeout(() => {
       const avatarEl = document.getElementById('main-avatar');
       if (avatarEl) {
         const avatarRect = avatarEl.getBoundingClientRect();
         setFlyingEmojis(prev => prev.map(em => em.id === newEmoji.id ? { ...em, x: avatarRect.left + 16, y: avatarRect.top + 16 } : em));
       }
    }, 50);

    setTimeout(() => {
      setFlyingEmojis(prev => prev.filter(em => em.id !== newEmoji.id));
    }, 800);
  };

  const savePlanningPopup = async (task: TaskSummary, type: 'difficulty' | 'planning', value: string, e: React.MouseEvent) => {
    const syntheticEvent = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
    setActivePopup(null);
    const draft = type === 'difficulty' ? { difficulty: value as Difficulty, planned_window: task.planned_window } : { difficulty: task.difficulty, planned_window: value as PlannedWindow };
    
    const key = actionKey(task.id, type === 'difficulty' ? 'set_difficulty' : 'set_planning');
    setSavingActions((current) => ({ ...current, [key]: true }));
    setCardErrors((current) => ({ ...current, [task.id]: null }));
    try {
      await client.updatePlanning(task.id, draft);
      if (type === 'difficulty' && task.difficulty === 'unknown') spawnEmoji('🍔', syntheticEvent);
      if (type === 'planning' && task.planned_window === 'unknown') spawnEmoji('🍔', syntheticEvent);
      setStatusMessage(type === 'difficulty' ? successCopy('set_difficulty') : successCopy('set_planning'));
      await loadAll();
      if (expandedTaskId === task.id) void loadEvents(task.id);
    } catch (error) {
      setCardErrors((current) => ({ ...current, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((current) => ({ ...current, [key]: false }));
    }
  };

  const saveStatusPopup = async (task: TaskSummary, status: string, e: React.MouseEvent) => {
    const syntheticEvent = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
    setActivePopup(null);
    const key = actionKey(task.id, 'change_status');
    setSavingActions((current) => ({ ...current, [key]: true }));
    setCardErrors((current) => ({ ...current, [task.id]: null }));
    try {
      await client.updateStatus(task.id, status as TaskStatus);
      if (status === 'started' && task.status === 'received') spawnEmoji('🍕', syntheticEvent);
      else if (status === 'thinks_done' && task.status === 'started') spawnEmoji('🍕', syntheticEvent);
      else if (status === 'confirmed_done' && task.status !== 'confirmed_done') spawnEmoji('⭐', syntheticEvent);
      setStatusMessage(`Status ändrad till ${statusLabel[status]}`);
      await loadAll();
      if (expandedTaskId === task.id) void loadEvents(task.id);
    } catch (error) {
      setCardErrors((current) => ({ ...current, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((current) => ({ ...current, [key]: false }));
    }
  };

  const runAction = async (task: TaskSummary, action: ActionDescriptor, e: React.MouseEvent) => {
    setCardErrors((current) => ({ ...current, [task.id]: null }));
    if (action.id === 'set_difficulty' || action.id === 'set_planning') {
      setActivePopup({ taskId: task.id, type: action.id === 'set_difficulty' ? 'difficulty' : 'planning' });
      return;
    }
    if (action.id === 'comment') {
      if (expandedTaskId !== task.id) {
        toggleExpanded(task);
      }
      return;
    }
    if (action.id === 'collect_reward') {
      const key = actionKey(task.id, action.id);
      setSavingActions((current) => ({ ...current, [key]: true }));
      try {
        await client.collectReward(task.id);
        spawnEmoji('⭐', e);
        setStatusMessage('Du samlade dina stjärnor! Snyggt jobbat!');
        await loadAll();
        if (expandedTaskId === task.id) void loadEvents(task.id);
      } catch (error) {
        setCardErrors((current) => ({ ...current, [task.id]: onlineErrorCopy(error) }));
      } finally {
        setSavingActions((current) => ({ ...current, [key]: false }));
      }
      return;
    }

    const key = actionKey(task.id, action.id);
    setSavingActions((current) => ({ ...current, [key]: true }));
    try {
      const toStatus = nextStatusForAction(action.id);
      if (toStatus) {
        await client.updateStatus(task.id, toStatus);
        if (toStatus === 'started' || toStatus === 'thinks_done' || toStatus === 'confirmed_done') {
           spawnEmoji(toStatus === 'confirmed_done' ? '⭐' : '🍕', e);
        }
      }
      if (action.id === 'reject_done') await client.rejectTask(task.id, context);
      setStatusMessage(successCopy(action.id));
      await loadAll();
      if (expandedTaskId === task.id) void loadEvents(task.id);
    } catch (error) {
      setCardErrors((current) => ({ ...current, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((current) => ({ ...current, [key]: false }));
    }
  };

  const submitComment = async (event: FormEvent, taskId: string) => {
    event.preventDefault();
    const commentState = commentsByTask[taskId] ?? emptyCommentsState();
    const message = commentState.draft.trim();
    if (!message) return;

    setCommentsByTask((current) => ({
      ...current,
      [taskId]: { ...(current[taskId] ?? emptyCommentsState()), saving: true, inputError: null, error: null },
    }));
    try {
      const comment = await client.createComment(taskId, message);
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? emptyCommentsState()),
          items: [...(current[taskId]?.items ?? []), comment],
          draft: '',
          saving: false,
        },
      }));
    } catch (error) {
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? emptyCommentsState()),
          saving: false,
          error: onlineErrorCopy(error, 'Det gick inte att spara just nu.'),
        },
      }));
    }
  };

  useEffect(() => {
    const next = state.animations.find((animation) => !playedAnimations.current.has(animation.animation_key));
    if (!next) return;
    playedAnimations.current.add(next.animation_key);
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const taskForAnimation = state.tasks.find(t => t.id === next.task_id);
    const titleText = taskForAnimation ? ` på ${taskForAnimation.title}` : '';
    setFeedback({ message: `Nästan — kolla en gång till${titleText}.`, motion: !reducedMotion });

    const timeout = window.setTimeout(() => {
      void client
        .ackAnimation(context.childUserId, next.id)
        .then(() => {
          setState((current) => ({
            ...current,
            animations: current.animations.filter((animation) => animation.id !== next.id),
          }));
        })
        .catch(() => {
          setStatusMessage('Feedbacken kunde inte markeras som visad just nu.');
        })
        .finally(() => setFeedback(null));
    }, reducedMotion ? 200 : 900);

    return () => window.clearTimeout(timeout);
  }, [client, context.childUserId, state.animations]);

  const hungerPercent = state.progress?.hunger_capacity
    ? Math.min(100, Math.round((state.progress.hunger_score / state.progress.hunger_capacity) * 100))
    : 0;
  const avatar = feedback ? (feedback.motion ? '🤢' : '🙂') : state.progress?.nausea_score ? '🤢' : '🙂';

  return (
    <main className="appShell">
      <section className={`topPanel ${feedback?.motion ? 'topPanel--feedback' : ''}`} aria-label="Framsteg">
        <div className="avatar" id="main-avatar" aria-hidden="true">{avatar}</div>
        <div className="topPanelText">
          <p className="eyebrow">SchoolTaskHelper</p>
          <h1>{state.progress?.nausea_score ? 'Behöver kollas igen' : hungerLabel(state.progress)}</h1>
          <div className="hungerTrack" aria-label={`Hunger ${hungerPercent} procent`}>
            <span style={{ width: `${hungerPercent}%` }} />
          </div>
          <p>{loading ? 'Hämtar uppgifter…' : `Du har ${state.tasks.length} uppgifter att hålla koll på.`}</p>
          <p className="metaLine">
            Nivå {state.progress?.level ?? 1} · {state.progress?.stars_total ?? 0} stjärnor · {context.role === 'child' ? 'Barnvy' : 'Vuxenvy'}
          </p>
        </div>
      </section>

      {isDevMode ? (
        <section className="testPanel" aria-label="Lokalt testläge">
          <div>
            <strong>Testläge</strong>
            <p className="metaLine">Roll: {context.role} · child: {context.childUserId}</p>
          </div>
          <nav aria-label="Byt testvy">
            <a className={context.role === 'child' ? 'active' : ''} href={buildViewHref('child', context.childUserId, context.childUserId)}>Barnvy</a>
            <a className={context.role === 'parent' ? 'active' : ''} href={buildViewHref('parent', context.childUserId, 'parent1')}>Vuxenvy</a>
          </nav>
          <button className="secondary" type="button" onClick={() => void loadAll()}>Ladda om</button>
        </section>
      ) : null}

      <div className="liveRegion" role="status" aria-live="polite">
        {statusMessage}
      </div>

      {feedback ? (
        <aside className={`feedback ${feedback.motion ? 'feedback--motion' : ''}`} role="status" aria-live="polite">
          <span aria-hidden="true">🤢</span> {feedback.message}
        </aside>
      ) : null}

      {listError ? (
        <section className="stateCard" role="alert">
          <p>{listError}</p>
          <button type="button" onClick={() => void loadAll()}>Försök igen</button>
        </section>
      ) : loading ? (
        <section className="stateCard" aria-busy="true">
          <p>Hämtar uppgifter…</p>
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </section>
      ) : state.tasks.length === 0 ? (
        <section className="stateCard">
          <h2>Inga aktiva uppgifter just nu. Skönt!</h2>
          <p>När en ny uppgift kommer in syns den här.</p>
        </section>
      ) : (
        <section className="taskList" aria-label="Aktiva uppgifter">
          {state.tasks.map((task) => {
            const actions = getVisibleActions(task, context);
            const expanded = expandedTaskId === task.id;
            const commentsState = commentsByTask[task.id] ?? emptyCommentsState();

            const events = eventsByTask[task.id] || [];
            const comments = commentsState.items || [];
            const combinedTimeline = [
              ...events.map(ev => ({ type: 'event' as const, data: ev, time: new Date(ev.created_at).getTime() })),
              ...comments.map(c => ({ type: 'comment' as const, data: c, time: new Date(c.created_at).getTime() })),
              { type: 'source' as const, data: { source: task.source }, time: new Date(task.created_at || 0).getTime() - 1 }
            ].sort((a, b) => b.time - a.time);

            return (
              <article className="taskCard" key={task.id}>
                <div className="taskCardHeader">
                  <div className="taskHeaderContent">
                    <h2>{task.title}</h2>
                    <p className="metaLine">
                      {task.subject || 'Ämne saknas'} · {task.due_date || 'Inget datum'}
                    </p>
                    <p className="subMetaLine">
                      Svårighet: <strong>{difficultyLabel[task.difficulty]}</strong> · Plan: <strong>{planningLabel[task.planned_window]}</strong> · Status: <strong>{statusLabel[task.status]}</strong>
                    </p>
                  </div>
                  <button
                    className="secondary expandButton iconButton"
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Visa mindre' : 'Visa mer'}
                    onClick={() => toggleExpanded(task)}
                  >
                    {expanded ? '▲' : '▼'}
                  </button>
                </div>

                {(() => {
                  const primaryActions = actions.filter(a => a.id !== 'comment' && a.id !== 'set_difficulty' && a.id !== 'set_planning');
                  const mainAction = primaryActions.length > 0 ? primaryActions[0] : null;
                  const actionsToRender = expanded ? primaryActions : (mainAction ? [mainAction] : []);
                  
                  return actionsToRender.length > 0 ? (
                    <div className="actions" aria-label="Tillgängliga åtgärder">
                      {actionsToRender.map((action) => {
                        const saving = Boolean(savingActions[actionKey(task.id, action.id)]);
                        return (
                          <button
                            className={action.kind}
                            key={action.id}
                            type="button"
                            disabled={saving}
                            onClick={(e) => void runAction(task, action, e)}
                          >
                            {saving ? buttonSavingLabel(action.id) : action.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="metaLine taskHelp">{taskHelpText(task, context.role)}</p>
                  );
                })()}

                {cardErrors[task.id] ? <p className="errorText" role="alert">{cardErrors[task.id]}</p> : null}

                {activePopup?.taskId === task.id ? (
                  <div className="actionPopupBackdrop" onClick={() => setActivePopup(null)}>
                    <div className="actionPopup" onClick={e => e.stopPropagation()}>
                      <h3>{activePopup.type === 'difficulty' ? 'Hur svår känns den?' : activePopup.type === 'planning' ? 'När tänker du jobba med den?' : 'Ändra status'}</h3>
                      <div className="popupButtons">
                        {activePopup.type === 'difficulty' && (
                          (['easy', 'medium', 'hard'] as Difficulty[]).map((value) => (
                            <button key={value} className="secondary" type="button" onClick={(e) => savePlanningPopup(task, 'difficulty', value, e)}>
                              {difficultyLabel[value]}
                            </button>
                          ))
                        )}
                        {activePopup.type === 'planning' && (
                          (['today', 'tomorrow', 'this_week', 'next_week'] as PlannedWindow[]).map((value) => (
                            <button key={value} className="secondary" type="button" onClick={(e) => savePlanningPopup(task, 'planning', value, e)}>
                              {planningLabel[value]}
                            </button>
                          ))
                        )}
                        {activePopup.type === 'status' && (
                          (['received', 'started', 'thinks_done', 'confirmed_done']).map((value) => (
                            <button key={value} className="secondary" type="button" onClick={(e) => saveStatusPopup(task, value, e)}>
                              {statusLabel[value]}
                            </button>
                          ))
                        )}
                      </div>
                      <button className="secondary popupClose" type="button" onClick={() => setActivePopup(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : null}

                {expanded ? (
                  <div className="taskDetails">
                    <div className="tinyActions">
                      <button className="secondary tiny" type="button" onClick={() => setActivePopup({ taskId: task.id, type: 'difficulty' })}>Ändra svårighet</button>
                      <button className="secondary tiny" type="button" onClick={() => setActivePopup({ taskId: task.id, type: 'planning' })}>Ändra plan</button>
                      <button className="secondary tiny" type="button" onClick={() => setActivePopup({ taskId: task.id, type: 'status' })}>Ändra status</button>
                    </div>

                    <section className="detailBlock timelineBlock" aria-labelledby={`log-${task.id}`}>
                      <h3 id={`log-${task.id}`}>Logg & Kommentarer</h3>
                      
                      {combinedTimeline.length > 0 ? (
                        <ul className="historyLog">
                          {combinedTimeline.map(item => {
                            const dateStr = new Date(item.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute:'2-digit', month: 'short', day: 'numeric' });
                            
                            if (item.type === 'source') {
                              const sourceName = item.data.source ? sourceLabel[item.data.source] ?? item.data.source : 'Manuell';
                              return <li key={`src-${task.id}`}><span className="logTime">{dateStr}</span> <span className="logMsg">Källa: {sourceName}</span></li>;
                            } else if (item.type === 'event') {
                              const ev = item.data as TaskEvent;
                              let msg = ev.event_type;
                              if (ev.event_type === 'status_changed') {
                                const payload = parseEventPayload(ev.payload_json);
                                const toStatus = String(payload.to_status || '');
                                msg = `Status ändrad till ${statusLabel[toStatus] || toStatus || 'okänd status'}`;
                              } else if (ev.event_type === 'planning_updated') {
                                const payload = parseEventPayload(ev.payload_json);
                                const difficultyValue = (payload.difficulty as { to?: Difficulty } | undefined)?.to;
                                const plannedWindowValue = (payload.planned_window as { to?: PlannedWindow } | undefined)?.to;
                                if (difficultyValue) msg = `Svårighet satt till ${difficultyLabel[difficultyValue]}`;
                                else if (plannedWindowValue) msg = `Plan satt till ${planningLabel[plannedWindowValue]}`;
                              } else if (ev.event_type === 'task_created') msg = 'Uppgift skapad';
                              else return null;
                              
                              return <li key={`ev-${ev.id}`}><span className="logTime">{dateStr}</span> <span className="logMsg">{msg}</span></li>;
                            } else {
                              const c = item.data as TaskComment;
                              const author = c.author_role === 'child' ? 'Barn' : 'Vuxen';
                              return (
                                <li key={`c-${c.id}`}>
                                  <span className="logTime">{dateStr}</span> 
                                  <span className="logMsg"><strong>{author}:</strong> {c.message}</span>
                                </li>
                              );
                            }
                          })}
                        </ul>
                      ) : <p className="metaLine">Laddar historik...</p>}

                      <form className="compactCommentForm" onSubmit={(event) => void submitComment(event, task.id)}>
                        <input
                          type="text"
                          placeholder="Skriv en snabb kommentar…"
                          value={commentsState.draft}
                          onChange={(event) => setCommentsByTask((current) => ({
                            ...current,
                            [task.id]: { ...(current[task.id] ?? emptyCommentsState()), draft: event.target.value, inputError: null },
                          }))}
                        />
                        <button className="secondary" type="submit" disabled={commentsState.saving || !commentsState.draft.trim()}>
                          ➤
                        </button>
                      </form>
                    </section>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}

      {/* Flygande emojis för gamification */}
      {flyingEmojis.map(emoji => (
        <div key={emoji.id} className="flyingFood" style={{ left: emoji.x, top: emoji.y }}>
          {emoji.emoji}
        </div>
      ))}
    </main>
  );
}

function emptyCommentsState(): CommentsState {
  return { items: [], loading: false, error: null, draft: '', saving: false, inputError: null };
}

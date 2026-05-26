import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  SchoolTaskApiClient,
  buildViewHref,
  getVisibleActions,
  type ActionDescriptor,
  type ChildProgress,
  type Difficulty,
  type FeedbackAnimation,
  type PlannedWindow,
  type TaskActionId,
  type TaskComment,
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

type PlanningDraft = {
  difficulty: Difficulty;
  planned_window: PlannedWindow;
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
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'Du behöver internet för att använda appen.';
  if (error instanceof TypeError) return 'Du behöver internet för att använda appen.';
  return fallback;
}

function taskHelpText(task: TaskSummary, role: string): string {
  if (task.status === 'thinks_done' && role === 'child') return 'Väntar på att en vuxen kollar.';
  if (task.status === 'confirmed_done') return 'Uppgiften är klar.';
  return 'Kommentera om något behöver förklaras.';
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

function actionKey(taskId: string, actionId: TaskActionId): string {
  return `${taskId}:${actionId}`;
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
  const [planningDrafts, setPlanningDrafts] = useState<Record<string, PlanningDraft>>({});
  const [savingActions, setSavingActions] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; motion: boolean } | null>(null);
  const playedAnimations = useRef<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const [tasks, progress] = await Promise.all([
        client.listTasks(context.childUserId),
        client.getProgress(context.childUserId),
      ]);
      const animations = context.role === 'child' ? await client.getPendingAnimations(context.childUserId) : [];
      setState({ tasks, progress, animations });
      setPlanningDrafts((current) => {
        const next = { ...current };
        tasks.forEach((task) => {
          next[task.id] = next[task.id] ?? { difficulty: task.difficulty, planned_window: task.planned_window };
        });
        return next;
      });
    } catch (error) {
      setListError(onlineErrorCopy(error, 'Det gick inte att hämta uppgifterna just nu.'));
    } finally {
      setLoading(false);
    }
  }, [client, context.childUserId, context.role]);

  useEffect(() => {
    void loadAll();
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

  const toggleExpanded = (task: TaskSummary) => {
    const nextTaskId = expandedTaskId === task.id ? null : task.id;
    setExpandedTaskId(nextTaskId);
    if (nextTaskId) void loadComments(task.id);
  };

  const runAction = async (task: TaskSummary, action: ActionDescriptor) => {
    setCardErrors((current) => ({ ...current, [task.id]: null }));
    if (action.id === 'set_difficulty' || action.id === 'set_planning' || action.id === 'comment') {
      if (expandedTaskId !== task.id) {
        setExpandedTaskId(task.id);
        void loadComments(task.id);
      }
      return;
    }

    const key = actionKey(task.id, action.id);
    setSavingActions((current) => ({ ...current, [key]: true }));
    try {
      const toStatus = nextStatusForAction(action.id);
      if (toStatus) await client.updateStatus(task.id, toStatus);
      if (action.id === 'reject_done') await client.rejectTask(task.id, context);
      setStatusMessage(successCopy(action.id));
      await loadAll();
    } catch (error) {
      setCardErrors((current) => ({ ...current, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((current) => ({ ...current, [key]: false }));
    }
  };

  const savePlanning = async (task: TaskSummary) => {
    const draft = planningDrafts[task.id] ?? { difficulty: task.difficulty, planned_window: task.planned_window };
    const key = actionKey(task.id, 'set_planning');
    setSavingActions((current) => ({ ...current, [key]: true }));
    setCardErrors((current) => ({ ...current, [task.id]: null }));
    try {
      await client.updatePlanning(task.id, draft);
      setStatusMessage(draft.difficulty !== task.difficulty ? successCopy('set_difficulty') : successCopy('set_planning'));
      await loadAll();
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
    if (!message) {
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: { ...(current[taskId] ?? emptyCommentsState()), inputError: 'Skriv något kort först.' },
      }));
      return;
    }

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
          inputError: null,
          error: null,
        },
      }));
      setStatusMessage('Kommentaren skickades.');
    } catch (error) {
      setCommentsByTask((current) => ({
        ...current,
        [taskId]: {
          ...(current[taskId] ?? emptyCommentsState()),
          saving: false,
          error: onlineErrorCopy(error, 'Det gick inte att spara just nu. Försök igen.'),
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

    setFeedback({ message: 'Nästan — kolla en gång till.', motion: !reducedMotion });
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
        <div className="avatar" aria-hidden="true">{avatar}</div>
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
            const planningDraft = planningDrafts[task.id] ?? { difficulty: task.difficulty, planned_window: task.planned_window };
            const planningSaving = Boolean(savingActions[actionKey(task.id, 'set_planning')]);
            const canPlan = context.role === 'child' && task.status !== 'thinks_done' && task.status !== 'confirmed_done';

            return (
              <article className="taskCard" key={task.id}>
                <div className="taskCardHeader">
                  <div>
                    <h2>{task.title}</h2>
                    <p className="metaLine">
                      {task.subject || 'Ämne saknas'} · {task.due_date || 'Inget datum'}
                    </p>
                  </div>
                  <button
                    className="secondary expandButton"
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => toggleExpanded(task)}
                  >
                    {expanded ? 'Visa mindre' : 'Visa mer'}
                  </button>
                </div>

                <div className="chips" aria-label="Uppgiftsstatus">
                  <span>Svårighet: {difficultyLabel[task.difficulty]}</span>
                  <span>Plan: {planningLabel[task.planned_window]}</span>
                  <span>Status: {statusLabel[task.status]}</span>
                </div>

                {actions.length > 0 ? (
                  <div className="actions" aria-label="Tillgängliga åtgärder">
                    {actions.slice(0, expanded ? actions.length : 1).map((action) => {
                      const saving = Boolean(savingActions[actionKey(task.id, action.id)]);
                      return (
                        <button
                          className={action.kind}
                          key={action.id}
                          type="button"
                          disabled={saving}
                          onClick={() => void runAction(task, action)}
                        >
                          {saving ? buttonSavingLabel(action.id) : action.label}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="metaLine taskHelp">{taskHelpText(task, context.role)}</p>
                )}

                {cardErrors[task.id] ? <p className="errorText" role="alert">{cardErrors[task.id]}</p> : null}

                {expanded ? (
                  <div className="taskDetails">
                    <p className="metaLine">Källa: {task.source ? sourceLabel[task.source] ?? task.source : 'Manuell'}</p>

                    {canPlan ? (
                      <section className="detailBlock" aria-labelledby={`planera-${task.id}`}>
                        <h3 id={`planera-${task.id}`}>Planera</h3>
                        <fieldset>
                          <legend>Hur svår känns den?</legend>
                          <div className="optionGrid">
                            {(['easy', 'medium', 'hard', 'unknown'] as Difficulty[]).map((value) => (
                              <label key={value}>
                                <input
                                  type="radio"
                                  name={`difficulty-${task.id}`}
                                  value={value}
                                  checked={planningDraft.difficulty === value}
                                  onChange={() => setPlanningDrafts((current) => ({
                                    ...current,
                                    [task.id]: { ...planningDraft, difficulty: value },
                                  }))}
                                />
                                {difficultyLabel[value]}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <fieldset>
                          <legend>När tänker du jobba med den?</legend>
                          <div className="optionGrid">
                            {(['today', 'tomorrow', 'this_week', 'next_week', 'unknown'] as PlannedWindow[]).map((value) => (
                              <label key={value}>
                                <input
                                  type="radio"
                                  name={`planning-${task.id}`}
                                  value={value}
                                  checked={planningDraft.planned_window === value}
                                  onChange={() => setPlanningDrafts((current) => ({
                                    ...current,
                                    [task.id]: { ...planningDraft, planned_window: value },
                                  }))}
                                />
                                {planningLabel[value]}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <button className="primary" type="button" disabled={planningSaving} onClick={() => void savePlanning(task)}>
                          {planningSaving ? 'Sparar…' : 'Spara plan'}
                        </button>
                      </section>
                    ) : (
                      <section className="detailBlock" aria-labelledby={`status-${task.id}`}>
                        <h3 id={`status-${task.id}`}>Status</h3>
                        <p>{taskHelpText(task, context.role)}</p>
                      </section>
                    )}

                    <section className="detailBlock" aria-labelledby={`comments-${task.id}`}>
                      <h3 id={`comments-${task.id}`}>Kommentarer</h3>
                      {commentsState.loading ? <p>Hämtar kommentarer…</p> : null}
                      {commentsState.error ? (
                        <div className="inlineState" role="alert">
                          <p>{commentsState.error}</p>
                          <button className="secondary" type="button" onClick={() => void loadComments(task.id, true)}>Försök igen</button>
                        </div>
                      ) : null}
                      {!commentsState.loading && !commentsState.error && commentsState.items.length === 0 ? <p>Inga kommentarer än.</p> : null}
                      {commentsState.items.length > 0 ? (
                        <ol className="commentsList">
                          {commentsState.items.map((comment) => (
                            <li key={comment.id}>
                              <strong>{comment.author_role === 'child' ? 'Barn' : 'Vuxen'}</strong>
                              <p>{comment.message}</p>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      <form className="commentForm" onSubmit={(event) => void submitComment(event, task.id)}>
                        <label htmlFor={`comment-${task.id}`}>Kommentera</label>
                        <textarea
                          id={`comment-${task.id}`}
                          placeholder="Skriv en kort kommentar…"
                          value={commentsState.draft}
                          aria-describedby={commentsState.inputError ? `comment-error-${task.id}` : undefined}
                          onChange={(event) => setCommentsByTask((current) => ({
                            ...current,
                            [task.id]: { ...(current[task.id] ?? emptyCommentsState()), draft: event.target.value, inputError: null },
                          }))}
                        />
                        <p className="metaLine">Skriv några ord först, så aktiveras Skicka.</p>
                        {commentsState.inputError ? <p id={`comment-error-${task.id}`} className="errorText">{commentsState.inputError}</p> : null}
                        <button className="secondary" type="submit" disabled={commentsState.saving || !commentsState.draft.trim()}>
                          {commentsState.saving ? 'Skickar…' : 'Skicka'}
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
    </main>
  );
}

function emptyCommentsState(): CommentsState {
  return { items: [], loading: false, error: null, draft: '', saving: false, inputError: null };
}

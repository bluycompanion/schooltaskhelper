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

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface Particle {
  id: string;
  emoji: string;
  x: number;
  y: number;
  opacity: number;
}

// Avatar is glad by default and only *reacts* transiently, then returns to glad.
type AvatarMood = 'glad' | 'happy' | 'excited' | 'sick' | 'sleeping';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_XP = 20;

const avatarEmojis: Record<AvatarMood, string> = {
  glad:     '😊', // default resting state — normally happy (static)
  happy:    '😄', // very happy when fed / good action (bounces), then back to glad
  excited:  '🤩', // level up / reward
  sick:     '🤢', // transient reject feedback
  sleeping: '😴', // no active tasks
};

const difficultyLabel: Record<Difficulty, string> = {
  easy: 'Enkel', medium: 'Medel', hard: 'Svår', unknown: 'Inte valt',
};

const planningLabel: Record<PlannedWindow, string> = {
  today: 'Idag', tomorrow: 'Imorgon', this_week: 'Denna vecka', next_week: 'Nästa vecka', unknown: 'Vet inte än',
};

const statusLabel: Record<string, string> = {
  received: 'Ny', started: 'Påbörjad', thinks_done: 'Tror klar', confirmed_done: 'Klar',
};

const sourceLabel: Record<string, string> = {
  school_platform: 'Skolplattformen', manual: 'Manuell',
};

// ─── Step "food" effect (what feeds the hunger bar) ──────────────────────────
// Each planning/progress step lowers hunger by 1 in the backend = one bite.
// We surface that bite as a fruit so the child sees what each step gives.

const stepEffect: Partial<Record<TaskActionId, { emoji: string; amount: number }>> = {
  set_difficulty: { emoji: '🍊', amount: 1 },
  set_planning: { emoji: '🍓', amount: 1 },
  mark_started: { emoji: '🍕', amount: 1 },
  mark_thinks_done: { emoji: '🍒', amount: 1 },
};

// Compact effect suffix for a button/chip, e.g. " +1🍊". Only the food that
// actually feeds the bar right now is shown — stars are granted at celebration
// (collect_reward), so we never advertise them on a planning step.
function effectSuffix(actionId: TaskActionId): string {
  const eff = stepEffect[actionId];
  return eff ? ` +${eff.amount}${eff.emoji}` : '';
}

// ─── Particle configs per action ─────────────────────────────────────────────

function particlesForAction(actionId: TaskActionId | string): { emojis: string[]; bar: 'hunger' | 'xp' | 'both' | 'none' } {
  switch (actionId) {
    case 'set_difficulty':
      return { emojis: ['🍊', '🍊', '🍋', '🍊', '🍋'], bar: 'hunger' };
    case 'set_planning':
      return { emojis: ['🍓', '🍓', '🍓', '🍓', '🍓'], bar: 'hunger' };
    case 'mark_started':
      return { emojis: ['🍕', '🍕', '⚡', '🍕', '⚡'], bar: 'hunger' };
    case 'mark_thinks_done':
      return { emojis: ['🍒', '🍒', '⭐', '🍒', '🍒', '⭐'], bar: 'both' };
    case 'confirm_done':
      return { emojis: ['⭐', '🌟', '✨', '⭐', '🌟', '✨', '⭐'], bar: 'xp' };
    case 'collect_reward':
      return { emojis: ['⭐', '🌟', '✨', '💫', '🎉', '⭐', '🌟', '✨'], bar: 'xp' };
    case 'reject_done':
      return { emojis: ['🤢', '💧', '🤢'], bar: 'none' };
    default:
      return { emojis: ['✨', '⭐'], bar: 'none' };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function workloadLabel(greenPercent: number, unplannedCount: number, taskCount: number): string {
  if (taskCount === 0) return 'Bra läge';
  if (unplannedCount > 0) return 'Dags att planera!';
  if (greenPercent >= 67) return 'Bra läge';
  if (greenPercent >= 34) return 'Lite att planera';
  return 'Fullt upp';
}

function onlineErrorCopy(error: unknown, fallback = 'Det gick inte att spara just nu. Försök igen.'): string {
  if (error instanceof ApiError) {
    const payloadErr = (error.payload as Record<string, unknown>)?.error;
    if (typeof payloadErr === 'string') return payloadErr;
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

// The single most relevant next step for a card, following the pedagogical
// order: choose difficulty → plan time → start → think done. Planning steps
// are surfaced before progression so a child never skips straight to "started".
function nextStepAction(task: TaskSummary, actions: ActionDescriptor[]): ActionDescriptor | null {
  const byId = new Map(actions.map((a) => [a.id, a] as const));
  const pick = (id: TaskActionId, label?: string): ActionDescriptor | null => {
    const a = byId.get(id);
    if (!a) return null;
    return label ? { ...a, label } : a;
  };
  return (
    pick('confirm_done')
    || pick('collect_reward')
    || (task.difficulty === 'unknown' ? pick('set_difficulty', 'Välj svårighet') : null)
    || (task.planned_window === 'unknown' ? pick('set_planning', 'Planera tid') : null)
    || pick('mark_started')
    || pick('mark_thinks_done')
    || pick('reject_done')
    || null
  );
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
  if (actionId === 'collect_reward') return 'Du samlade dina stjärnor! Snyggt jobbat!';
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
    // keep timeline resilient on malformed payload
  }
  return {};
}

function emptyCommentsState(): CommentsState {
  return { items: [], loading: false, error: null, draft: '', saving: false, inputError: null };
}

// ─── Component ────────────────────────────────────────────────────────────────

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
  const [activePopup, setActivePopup] = useState<{ taskId: string; type: 'difficulty' | 'planning' | 'status' } | null>(null);

  const [flyingEmojis, setFlyingEmojis] = useState<Particle[]>([]);
  const [savingActions, setSavingActions] = useState<Record<string, boolean>>({});
  const [cardErrors, setCardErrors] = useState<Record<string, string | null>>({});
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; motion: boolean } | null>(null);
  const playedAnimations = useRef<Set<string>>(new Set());

  // Gamification state
  const [tempMood, setTempMood] = useState<{ mood: AvatarMood; until: number } | null>(null);
  const [barFlash, setBarFlash] = useState({ hunger: false, xp: false });
  const [slidingOutTasks, setSlidingOutTasks] = useState<Set<string>>(new Set());
  const [levelUpText, setLevelUpText] = useState<string | null>(null);
  const prevXpRef = useRef(0);

  // Parent: create-task form
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskDraft, setNewTaskDraft] = useState({ title: '', subject: '', dueDate: '' });
  const [newTaskSaving, setNewTaskSaving] = useState(false);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);

  // Dev toggle: turn off card pulse + shimmer (persisted locally for testing).
  const [animationsOff, setAnimationsOff] = useState<boolean>(() => {
    try { return localStorage.getItem('sth_animations_off') === '1'; } catch { return false; }
  });
  const toggleAnimations = useCallback(() => {
    setAnimationsOff((prev) => {
      const next = !prev;
      try { localStorage.setItem('sth_animations_off', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ─── Data loading ───────────────────────────────────────────────────────────

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

  useEffect(() => { void loadAll(true); }, [loadAll]);

  const loadComments = useCallback(async (taskId: string, force = false) => {
    if (!force && commentsByTask[taskId]?.items.length) return;
    setCommentsByTask((cur) => ({
      ...cur,
      [taskId]: { items: cur[taskId]?.items ?? [], draft: cur[taskId]?.draft ?? '', saving: false, inputError: null, loading: true, error: null },
    }));
    try {
      const comments = await client.listComments(taskId);
      setCommentsByTask((cur) => ({ ...cur, [taskId]: { ...(cur[taskId] ?? emptyCommentsState()), items: comments, loading: false, error: null } }));
    } catch (error) {
      setCommentsByTask((cur) => ({
        ...cur,
        [taskId]: { ...(cur[taskId] ?? emptyCommentsState()), loading: false, error: onlineErrorCopy(error, 'Kommentarerna kunde inte hämtas just nu.') },
      }));
    }
  }, [client, commentsByTask]);

  const loadEvents = useCallback(async (taskId: string) => {
    try {
      const events = await client.listEvents(taskId);
      setEventsByTask((cur) => ({ ...cur, [taskId]: events }));
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

  // ─── Gamification helpers ───────────────────────────────────────────────────

  const triggerMood = useCallback((mood: AvatarMood, ms: number) => {
    setTempMood({ mood, until: Date.now() + ms });
    setTimeout(() => setTempMood(null), ms);
  }, []);

  const spawnParticles = useCallback((
    emojis: string[],
    e: React.MouseEvent | null,
    barType: 'hunger' | 'xp' | 'both' | 'none' = 'none',
  ) => {
    const centerX = e?.clientX ?? window.innerWidth / 2;
    const centerY = e?.clientY ?? window.innerHeight / 2;

    emojis.forEach((emoji, i) => {
      const delay = i * 50;
      const id = `${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`;
      const offsetX = (Math.random() - 0.5) * 70;
      const offsetY = (Math.random() - 0.5) * 70;
      const startX = centerX + offsetX - 16;
      const startY = centerY + offsetY - 16;

      setTimeout(() => {
        setFlyingEmojis((prev) => [...prev, { id, emoji, x: startX, y: startY, opacity: 1 }]);

        setTimeout(() => {
          const avatarEl = document.getElementById('main-avatar');
          if (avatarEl) {
            const rect = avatarEl.getBoundingClientRect();
            const destX = rect.left + rect.width / 2 - 16;
            const destY = rect.top + rect.height / 2 - 16;
            setFlyingEmojis((prev) => prev.map((p) => p.id === id ? { ...p, x: destX, y: destY } : p));
          }
        }, 50);

        setTimeout(() => {
          setFlyingEmojis((prev) => prev.map((p) => p.id === id ? { ...p, opacity: 0 } : p));
          setTimeout(() => setFlyingEmojis((prev) => prev.filter((p) => p.id !== id)), 300);
        }, 750);
      }, delay);
    });

    if (barType !== 'none') {
      const lastDelay = (emojis.length - 1) * 50 + 870;
      setTimeout(() => {
        setBarFlash({ hunger: barType === 'hunger' || barType === 'both', xp: barType === 'xp' || barType === 'both' });
        setTimeout(() => setBarFlash({ hunger: false, xp: false }), 400);
      }, lastDelay);
    }
  }, []);

  // Level-up detection (frontend cosmetic, fires when xp crosses LEVEL_XP multiples)
  useEffect(() => {
    const xp = state.progress?.xp_total ?? 0;
    const prev = prevXpRef.current;
    if (prev > 0 && Math.floor(xp / LEVEL_XP) > Math.floor(prev / LEVEL_XP)) {
      const newLevel = Math.floor(xp / LEVEL_XP) + 1;
      setLevelUpText(`Nivå ${newLevel} uppnådd! 🎉`);
      triggerMood('excited', 4000);
      setTimeout(() => setLevelUpText(null), 2500);
    }
    prevXpRef.current = xp;
  }, [state.progress?.xp_total, triggerMood]);

  // One-shot reject animations
  useEffect(() => {
    const next = state.animations.find((a) => !playedAnimations.current.has(a.animation_key));
    if (!next) return;
    playedAnimations.current.add(next.animation_key);
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const taskForAnimation = state.tasks.find((t) => t.id === next.task_id);
    const titleText = taskForAnimation ? ` på ${taskForAnimation.title}` : '';
    setFeedback({ message: `Nästan — kolla en gång till${titleText}.`, motion: !reducedMotion });

    const timeout = window.setTimeout(() => {
      void client
        .ackAnimation(context.childUserId, next.id)
        .then(() => {
          setState((cur) => ({ ...cur, animations: cur.animations.filter((a) => a.id !== next.id) }));
        })
        .catch(() => {
          setStatusMessage('Feedbacken kunde inte markeras som visad just nu.');
        })
        .finally(() => setFeedback(null));
    }, reducedMotion ? 200 : 900);

    return () => window.clearTimeout(timeout);
  }, [client, context.childUserId, state.animations, state.tasks]);

  // ─── Computed values ────────────────────────────────────────────────────────

  // Sims-style need bar: each task contributes 3 fillable steps (planning,
  // started, thinks_done) matching the backend hunger decrements. Tasks
  // completed today stay in the denominator as fully fed slices so finishing
  // a task never shrinks the green — the bar resets naturally next morning.
  const activeCount = state.tasks.length;
  const completedToday = state.progress?.completed_today ?? 0;
  const totalSlices = activeCount + completedToday;
  const unplannedCount = state.tasks.filter(
    (t) => t.difficulty === 'unknown' && t.planned_window === 'unknown',
  ).length;
  const maxNeed = totalSlices * 3;
  const activeNeed = activeCount * 3;
  const satisfiedSteps = completedToday * 3
    + (activeNeed - Math.min(state.progress?.hunger_score ?? 0, activeNeed));
  const rawGreen = maxNeed > 0 ? (satisfiedSteps / maxNeed) * 100 : 100;
  const slicePercent = totalSlices > 0 ? 100 / totalSlices : 100;
  const brownPercent = Math.min((state.progress?.nausea_score ?? 0) * slicePercent, 40);
  const greenPercent = Math.max(0, Math.min(rawGreen, 100 - brownPercent));
  const hasUnplanned = unplannedCount > 0;

  const currentXp = state.progress?.xp_total ?? 0;
  const displayLevel = Math.floor(currentXp / LEVEL_XP) + 1;
  const xpPercent = Math.round(((currentXp % LEVEL_XP) / LEVEL_XP) * 100);

  // Sick is a short, transient state (while the reject feedback is showing).
  // The persistent nausea signal lives in the brown bar segment and the 🤢
  // badge on the rejected task card instead.
  // Glad by default; only transient reactions (reject feedback, action bounce,
  // level-up) override it, then it returns to glad. Sleeps only when no tasks.
  const avatarMood: AvatarMood = (() => {
    if (feedback) return 'sick';
    if (tempMood && tempMood.until > Date.now()) return tempMood.mood;
    if (state.tasks.length === 0 && !loading) return 'sleeping';
    return 'glad';
  })();

  // ─── Action handlers ────────────────────────────────────────────────────────

  const savePlanningPopup = async (task: TaskSummary, type: 'difficulty' | 'planning', value: string, e: React.MouseEvent) => {
    const syn = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
    setActivePopup(null);
    const draft = type === 'difficulty'
      ? { difficulty: value as Difficulty, planned_window: task.planned_window }
      : { difficulty: task.difficulty, planned_window: value as PlannedWindow };

    const key = actionKey(task.id, type === 'difficulty' ? 'set_difficulty' : 'set_planning');
    setSavingActions((cur) => ({ ...cur, [key]: true }));
    setCardErrors((cur) => ({ ...cur, [task.id]: null }));
    try {
      await client.updatePlanning(task.id, draft);
      const isFirst = type === 'difficulty' ? task.difficulty === 'unknown' : task.planned_window === 'unknown';
      if (isFirst) {
        const { emojis, bar } = particlesForAction(type === 'difficulty' ? 'set_difficulty' : 'set_planning');
        spawnParticles(emojis, syn, bar);
        triggerMood('happy', 3000);
      }
      setStatusMessage(type === 'difficulty' ? successCopy('set_difficulty') : successCopy('set_planning'));
      await loadAll();
      if (expandedTaskId === task.id) void loadEvents(task.id);
    } catch (error) {
      setCardErrors((cur) => ({ ...cur, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((cur) => ({ ...cur, [key]: false }));
    }
  };

  const saveStatusPopup = async (task: TaskSummary, status: string, e: React.MouseEvent) => {
    const syn = { clientX: e.clientX, clientY: e.clientY } as React.MouseEvent;
    setActivePopup(null);
    const key = actionKey(task.id, 'change_status');
    setSavingActions((cur) => ({ ...cur, [key]: true }));
    setCardErrors((cur) => ({ ...cur, [task.id]: null }));
    try {
      await client.updateStatus(task.id, status as TaskStatus);
      if (status === 'started' && task.status === 'received') {
        const { emojis, bar } = particlesForAction('mark_started');
        spawnParticles(emojis, syn, bar);
        triggerMood('happy', 3000);
      } else if (status === 'thinks_done') {
        const { emojis, bar } = particlesForAction('mark_thinks_done');
        spawnParticles(emojis, syn, bar);
        triggerMood('happy', 3000);
      } else if (status === 'confirmed_done') {
        const { emojis, bar } = particlesForAction('confirm_done');
        spawnParticles(emojis, syn, bar);
        triggerMood('excited', 4000);
      }
      setStatusMessage(`Status ändrad till ${statusLabel[status]}`);
      await loadAll();
      if (expandedTaskId === task.id) void loadEvents(task.id);
    } catch (error) {
      setCardErrors((cur) => ({ ...cur, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((cur) => ({ ...cur, [key]: false }));
    }
  };

  const runAction = async (task: TaskSummary, action: ActionDescriptor, e: React.MouseEvent) => {
    setCardErrors((cur) => ({ ...cur, [task.id]: null }));

    if (action.id === 'set_difficulty' || action.id === 'set_planning') {
      setActivePopup({ taskId: task.id, type: action.id === 'set_difficulty' ? 'difficulty' : 'planning' });
      return;
    }
    if (action.id === 'comment') {
      if (expandedTaskId !== task.id) toggleExpanded(task);
      return;
    }

    if (action.id === 'collect_reward') {
      const key = actionKey(task.id, action.id);
      setSavingActions((cur) => ({ ...cur, [key]: true }));
      try {
        await client.collectReward(task.id);
        const { emojis, bar } = particlesForAction('collect_reward');
        spawnParticles(emojis, e, bar);
        triggerMood('excited', 4000);
        setStatusMessage(successCopy('collect_reward'));
        setSlidingOutTasks((prev) => new Set([...prev, task.id]));
        setTimeout(async () => {
          await loadAll();
          if (expandedTaskId === task.id) void loadEvents(task.id);
          setSlidingOutTasks((prev) => { const next = new Set(prev); next.delete(task.id); return next; });
        }, 400);
      } catch (error) {
        setCardErrors((cur) => ({ ...cur, [task.id]: onlineErrorCopy(error) }));
      } finally {
        setSavingActions((cur) => ({ ...cur, [key]: false }));
      }
      return;
    }

    const key = actionKey(task.id, action.id);
    setSavingActions((cur) => ({ ...cur, [key]: true }));
    try {
      const toStatus = nextStatusForAction(action.id);
      if (toStatus) {
        await client.updateStatus(task.id, toStatus);
        if (toStatus === 'started') {
          spawnParticles(particlesForAction('mark_started').emojis, e, 'hunger');
          triggerMood('happy', 3000);
        } else if (toStatus === 'thinks_done') {
          spawnParticles(particlesForAction('mark_thinks_done').emojis, e, 'both');
          triggerMood('happy', 3000);
        } else if (toStatus === 'confirmed_done') {
          spawnParticles(particlesForAction('confirm_done').emojis, e, 'xp');
          triggerMood('excited', 4000);
        }
      }
      if (action.id === 'reject_done') {
        await client.rejectTask(task.id, context);
        spawnParticles(particlesForAction('reject_done').emojis, e, 'none');
      }
      setStatusMessage(successCopy(action.id));
      await loadAll();
      if (expandedTaskId === task.id) void loadEvents(task.id);
    } catch (error) {
      setCardErrors((cur) => ({ ...cur, [task.id]: onlineErrorCopy(error) }));
    } finally {
      setSavingActions((cur) => ({ ...cur, [key]: false }));
    }
  };

  const submitNewTask = async (event: FormEvent) => {
    event.preventDefault();
    const title = newTaskDraft.title.trim();
    if (!title) {
      setNewTaskError('Skriv en titel först.');
      return;
    }
    setNewTaskSaving(true);
    setNewTaskError(null);
    try {
      await client.createParentTask({
        child_user_id: context.childUserId,
        title,
        subject: newTaskDraft.subject.trim() || null,
        due_date: newTaskDraft.dueDate || null,
      });
      setNewTaskDraft({ title: '', subject: '', dueDate: '' });
      setNewTaskOpen(false);
      setStatusMessage('Uppgiften skapades.');
      await loadAll();
    } catch (error) {
      setNewTaskError(onlineErrorCopy(error, 'Det gick inte att skapa uppgiften just nu.'));
    } finally {
      setNewTaskSaving(false);
    }
  };

  const submitComment = async (event: FormEvent, taskId: string) => {
    event.preventDefault();
    const commentState = commentsByTask[taskId] ?? emptyCommentsState();
    const message = commentState.draft.trim();
    if (!message) return;

    setCommentsByTask((cur) => ({ ...cur, [taskId]: { ...(cur[taskId] ?? emptyCommentsState()), saving: true, inputError: null, error: null } }));
    try {
      const comment = await client.createComment(taskId, message);
      setCommentsByTask((cur) => ({
        ...cur,
        [taskId]: { ...(cur[taskId] ?? emptyCommentsState()), items: [...(cur[taskId]?.items ?? []), comment], draft: '', saving: false },
      }));
    } catch (error) {
      setCommentsByTask((cur) => ({
        ...cur,
        [taskId]: { ...(cur[taskId] ?? emptyCommentsState()), saving: false, error: onlineErrorCopy(error, 'Det gick inte att spara just nu.') },
      }));
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <main className={`appShell${animationsOff ? ' animationsOff' : ''}`}>

      {/* ── Top panel ── */}
      <section className={`topPanel${feedback?.motion ? ' topPanel--feedback' : ''}`} aria-label="Framsteg">
        <div className="avatarWrap">
          <div className={`avatar avatar--${avatarMood}`} id="main-avatar" aria-hidden="true">
            {avatarEmojis[avatarMood]}
          </div>
          <span className="avatarBadge">Niv.{displayLevel}</span>
        </div>
        <div className="topPanelText">
          <p className="eyebrow">SchoolTaskHelper</p>
          <h1>{feedback ? 'Behöver kollas igen' : workloadLabel(greenPercent, unplannedCount, activeCount)}</h1>
          <div className="barsSection">
            <div className="barRow">
              <span className="barLabel">Hunger</span>
              <div
                className={`hungerTrack${barFlash.hunger ? ' bar--flash' : ''}${hasUnplanned ? ' hungerTrack--alert' : ''}`}
                style={{ '--slice': `${slicePercent}%` } as React.CSSProperties}
                aria-label={`Behov ${Math.round(greenPercent)} procent fyllt${brownPercent > 0 ? ', illamående aktivt' : ''}${hasUnplanned ? ', oplanerade uppgifter finns' : ''}`}
              >
                <span className="hungerFill" style={{ width: `${greenPercent}%` }} />
                {brownPercent > 0 ? <span className="nauseaFill" style={{ width: `${brownPercent}%` }} /> : null}
              </div>
            </div>
            <div className="barRow">
              <span className="barLabel">XP</span>
              <div className={`xpTrack${barFlash.xp ? ' bar--flash' : ''}`} aria-label={`XP ${xpPercent} procent till nästa nivå`}>
                <span style={{ width: `${xpPercent}%` }} />
              </div>
            </div>
          </div>
          <p>{loading ? 'Hämtar uppgifter…' : `Du har ${state.tasks.length} uppgifter att hålla koll på.`}</p>
          <p className="metaLine">
            Nivå {displayLevel} · {state.progress?.stars_total ?? 0} stjärnor · {context.role === 'child' ? 'Barnvy' : 'Vuxenvy'}
          </p>
        </div>
      </section>

      {/* ── Dev panel ── */}
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
          <button className="secondary" type="button" aria-pressed={animationsOff} onClick={toggleAnimations}>
            {animationsOff ? 'Slå på puls & gläns' : 'Stäng av puls & gläns'}
          </button>
        </section>
      ) : null}

      {/* ── Parent: create task ── */}
      {context.role === 'parent' ? (
        <section className="parentToolbar" aria-label="Föräldraåtgärder">
          <button className="primary" type="button" onClick={() => { setNewTaskError(null); setNewTaskOpen(true); }}>
            + Ny uppgift
          </button>
        </section>
      ) : null}

      {newTaskOpen ? (
        <div className="actionPopupBackdrop" onClick={() => setNewTaskOpen(false)}>
          <div className="actionPopup" onClick={(e) => e.stopPropagation()}>
            <h3>Ny uppgift till barnet</h3>
            <form className="newTaskForm" onSubmit={(e) => void submitNewTask(e)}>
              <label>
                Uppgift
                <input
                  type="text"
                  value={newTaskDraft.title}
                  placeholder="Vad ska göras?"
                  onChange={(e) => setNewTaskDraft((d) => ({ ...d, title: e.target.value }))}
                  autoFocus
                />
              </label>
              <label>
                Ämne (frivilligt)
                <input
                  type="text"
                  value={newTaskDraft.subject}
                  placeholder="T.ex. Matte"
                  onChange={(e) => setNewTaskDraft((d) => ({ ...d, subject: e.target.value }))}
                />
              </label>
              <label>
                Ska vara klar (frivilligt)
                <input
                  type="date"
                  value={newTaskDraft.dueDate}
                  onChange={(e) => setNewTaskDraft((d) => ({ ...d, dueDate: e.target.value }))}
                />
              </label>
              {newTaskError ? <p className="errorText" role="alert">{newTaskError}</p> : null}
              <button className="primary" type="submit" disabled={newTaskSaving || !newTaskDraft.title.trim()}>
                {newTaskSaving ? 'Skapar…' : 'Skapa uppgift'}
              </button>
            </form>
            <button className="secondary popupClose" type="button" onClick={() => setNewTaskOpen(false)}>Avbryt</button>
          </div>
        </div>
      ) : null}

      {/* ── Live region ── */}
      <div className="liveRegion" role="status" aria-live="polite">{statusMessage}</div>

      {/* ── Reject feedback ── */}
      {feedback ? (
        <aside className={`feedback${feedback.motion ? ' feedback--motion' : ''}`} role="status" aria-live="polite">
          <span aria-hidden="true">🤢</span> {feedback.message}
        </aside>
      ) : null}

      {/* ── Main content ── */}
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
            const events = eventsByTask[task.id] ?? [];
            const comments = commentsState.items;

            const hasReward = actions.some((a) => a.id === 'collect_reward');
            const isSliding = slidingOutTasks.has(task.id);
            const isNauseating = (task.current_attempt_no ?? 1) > 1 && task.status !== 'confirmed_done';
            const cardClass = `taskCard${
              isSliding       ? ' taskCard--slideout'
              : hasReward     ? ' taskCard--reward'
              : isNauseating  ? ' taskCard--nausea'
              : actions.length > 0 ? ' taskCard--actionable'
              : ''
            }`;

            const combinedTimeline = [
              ...events.map((ev) => ({ type: 'event' as const, data: ev, time: new Date(ev.created_at).getTime() })),
              ...comments.map((c) => ({ type: 'comment' as const, data: c, time: new Date(c.created_at).getTime() })),
              { type: 'source' as const, data: { source: task.source }, time: new Date(task.created_at ?? 0).getTime() - 1 },
            ].sort((a, b) => b.time - a.time);

            return (
              <article className={cardClass} key={task.id}>
                <div className="taskCardHeader">
                  <div className="taskHeaderContent">
                    <h2>
                      {isNauseating ? <span className="nauseaBadge" title="Behöver kollas igen" aria-label="Behöver kollas igen">🤢</span> : null}
                      {task.title}
                    </h2>
                    <p className="metaLine">
                      {task.subject ?? 'Ämne saknas'} · {task.due_date ?? 'Inget datum'}
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

                {/* ── Chips + next-step button on one row (wraps on narrow screens) ── */}
                {(() => {
                  const isChild = context.role === 'child';
                  const diffDone = task.difficulty !== 'unknown';
                  const planDone = task.planned_window !== 'unknown';
                  const editable = isChild && task.status !== 'confirmed_done';

                  // Collapsed: only the single next logical step. Expanded: the
                  // next step plus the remaining progression actions, so a child
                  // can still start early (soft guidance, not a hard gate).
                  const primary = nextStepAction(task, actions);
                  const progression = actions.filter(
                    (a) => a.id !== 'comment' && a.id !== 'set_difficulty' && a.id !== 'set_planning' && a.id !== primary?.id,
                  );
                  const actionsToRender = expanded
                    ? [primary, ...progression].filter((a): a is ActionDescriptor => Boolean(a))
                    : (primary ? [primary] : []);

                  return (
                    <div className="cardControlRow">
                      <div className="checklistChips" aria-label="Planeringssteg">
                        <ChecklistChip
                          done={diffDone}
                          label={diffDone ? difficultyLabel[task.difficulty] : `Svårighet${editable ? effectSuffix('set_difficulty') : ''}`}
                          onClick={editable ? () => setActivePopup({ taskId: task.id, type: 'difficulty' }) : undefined}
                        />
                        <ChecklistChip
                          done={planDone}
                          label={planDone ? planningLabel[task.planned_window] : `Plan${editable ? effectSuffix('set_planning') : ''}`}
                          onClick={editable ? () => setActivePopup({ taskId: task.id, type: 'planning' }) : undefined}
                        />
                        <span className="chip chip--status">{statusLabel[task.status]}</span>
                      </div>

                      {actionsToRender.length > 0 ? (
                        <div className="actions" aria-label="Tillgängliga åtgärder">
                          {actionsToRender.map((action) => {
                            const saving = Boolean(savingActions[actionKey(task.id, action.id)]);
                            const btnClass = action.id === 'collect_reward' ? 'btn-reward' : action.kind;
                            return (
                              <button
                                className={btnClass}
                                key={action.id}
                                type="button"
                                disabled={saving}
                                onClick={(e) => void runAction(task, action, e)}
                              >
                                {saving ? buttonSavingLabel(action.id) : `${action.label}${effectSuffix(action.id)}`}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="metaLine taskHelp">{taskHelpText(task, context.role)}</p>
                      )}
                    </div>
                  );
                })()}

                {cardErrors[task.id] ? <p className="errorText" role="alert">{cardErrors[task.id]}</p> : null}

                {/* ── Popup ── */}
                {activePopup?.taskId === task.id ? (
                  <div className="actionPopupBackdrop" onClick={() => setActivePopup(null)}>
                    <div className="actionPopup" onClick={(e) => e.stopPropagation()}>
                      <h3>
                        {activePopup.type === 'difficulty' ? 'Hur svår känns den?'
                          : activePopup.type === 'planning' ? 'När tänker du jobba med den?'
                          : 'Ändra status'}
                      </h3>
                      <div className="popupButtons">
                        {activePopup.type === 'difficulty' && (['easy', 'medium', 'hard'] as Difficulty[]).map((value) => (
                          <button key={value} className="secondary" type="button" onClick={(e) => savePlanningPopup(task, 'difficulty', value, e)}>
                            {difficultyLabel[value]}
                          </button>
                        ))}
                        {activePopup.type === 'planning' && (['today', 'tomorrow', 'this_week', 'next_week'] as PlannedWindow[]).map((value) => (
                          <button key={value} className="secondary" type="button" onClick={(e) => savePlanningPopup(task, 'planning', value, e)}>
                            {planningLabel[value]}
                          </button>
                        ))}
                        {activePopup.type === 'status' && (['received', 'started', 'thinks_done', 'confirmed_done']).map((value) => (
                          <button key={value} className="secondary" type="button" onClick={(e) => saveStatusPopup(task, value, e)}>
                            {statusLabel[value]}
                          </button>
                        ))}
                      </div>
                      <button className="secondary popupClose" type="button" onClick={() => setActivePopup(null)}>Avbryt</button>
                    </div>
                  </div>
                ) : null}

                {/* ── Expanded details ── */}
                {expanded ? (
                  <div className="taskDetails">
                    {context.role === 'child' && task.status !== 'confirmed_done' ? (
                      <div className="tinyActions">
                        <button className="secondary tiny" type="button" onClick={() => setActivePopup({ taskId: task.id, type: 'status' })}>Ändra status</button>
                      </div>
                    ) : null}

                    <section className="detailBlock timelineBlock" aria-labelledby={`log-${task.id}`}>
                      <h3 id={`log-${task.id}`}>Logg & Kommentarer</h3>

                      {combinedTimeline.length > 0 ? (
                        <ul className="historyLog">
                          {combinedTimeline.map((item) => {
                            const dateStr = new Date(item.time).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });

                            if (item.type === 'source') {
                              const sourceName = item.data.source ? sourceLabel[item.data.source] ?? item.data.source : 'Manuell';
                              return <li key={`src-${task.id}`}><span className="logTime">{dateStr}</span> <span className="logMsg">Källa: {sourceName}</span></li>;
                            }
                            if (item.type === 'event') {
                              const ev = item.data as TaskEvent;
                              let msg = ev.event_type;
                              if (ev.event_type === 'status_changed') {
                                const payload = parseEventPayload(ev.payload_json);
                                const toStatus = String(payload.to_status ?? '');
                                msg = `Status ändrad till ${statusLabel[toStatus] ?? toStatus ?? 'okänd status'}`;
                              } else if (ev.event_type === 'planning_updated') {
                                const payload = parseEventPayload(ev.payload_json);
                                const diffVal = (payload.difficulty as { to?: Difficulty } | undefined)?.to;
                                const planVal = (payload.planned_window as { to?: PlannedWindow } | undefined)?.to;
                                if (diffVal) msg = `Svårighet satt till ${difficultyLabel[diffVal]}`;
                                else if (planVal) msg = `Plan satt till ${planningLabel[planVal]}`;
                              } else if (ev.event_type === 'task_created') {
                                msg = 'Uppgift skapad';
                              } else {
                                return null;
                              }
                              return <li key={`ev-${ev.id}`}><span className="logTime">{dateStr}</span> <span className="logMsg">{msg}</span></li>;
                            }
                            const c = item.data as TaskComment;
                            const author = c.author_role === 'child' ? 'Barn' : 'Vuxen';
                            return (
                              <li key={`c-${c.id}`}>
                                <span className="logTime">{dateStr}</span>
                                <span className="logMsg"><strong>{author}:</strong> {c.message}</span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : <p className="metaLine">Laddar historik...</p>}

                      <form className="compactCommentForm" onSubmit={(e) => void submitComment(e, task.id)}>
                        <input
                          type="text"
                          placeholder="Skriv en snabb kommentar…"
                          value={commentsState.draft}
                          onChange={(e) => setCommentsByTask((cur) => ({
                            ...cur,
                            [task.id]: { ...(cur[task.id] ?? emptyCommentsState()), draft: e.target.value, inputError: null },
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

      {/* ── Particles ── */}
      {flyingEmojis.map((p) => (
        <div
          key={p.id}
          className="flyingFood"
          style={{ left: p.x, top: p.y, opacity: p.opacity }}
        >
          {p.emoji}
        </div>
      ))}

      {/* ── Level-up banner ── */}
      {levelUpText ? (
        <div className="levelUpBanner" role="status" aria-live="polite">
          <h2>{levelUpText}</h2>
        </div>
      ) : null}

    </main>
  );
}

function ChecklistChip({ done, label, onClick }: { done: boolean; label: string; onClick?: () => void }) {
  const className = `chip chip--${done ? 'done' : 'todo'}`;
  const content = (
    <>
      <span className="chipMark" aria-hidden="true">{done ? '✓' : '○'}</span> {label}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={`${className} chip--button`} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <span className={className}>{content}</span>;
}

export type Role = 'child' | 'parent' | 'agent';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'unknown';
export type PlannedWindow = 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'unknown';
export type TaskStatus = 'received' | 'started' | 'thinks_done' | 'confirmed_done';
export type TaskActionId =
  | 'set_difficulty'
  | 'set_planning'
  | 'mark_started'
  | 'mark_thinks_done'
  | 'confirm_done'
  | 'reject_done'
  | 'comment';

export interface LocalViewContext {
  role: Role;
  childUserId: string;
  userId?: string;
}

export interface TaskSummary {
  id: string;
  child_user_id?: string;
  title: string;
  subject: string | null;
  due_date: string | null;
  source?: string | null;
  source_external_id?: string | null;
  difficulty: Difficulty;
  planned_window: PlannedWindow;
  status: TaskStatus;
  can_actions: TaskActionId[];
  created_at?: string;
  updated_at?: string;
}

export type TaskDetail = TaskSummary & {
  current_attempt_no?: number;
};

export interface TaskComment {
  id: string;
  task_id: string;
  author_user_id: string;
  author_role: Role;
  message: string;
  created_at: string;
  updated_at?: string | null;
  deleted_at?: string | null;
}

export interface ChildProgress {
  child_user_id: string;
  hunger_score: number;
  hunger_capacity: number;
  xp_total: number;
  level: number;
  stars_total: number;
  nausea_score: number;
  updated_at: string;
}

export interface FeedbackAnimation {
  id: string;
  task_id: string;
  child_user_id: string;
  event_id: string;
  animation_type: 'reject_nausea';
  animation_key: string;
  delivered_at: string | null;
  seen_at: string | null;
  created_at: string;
}

export interface ActionDescriptor {
  id: TaskActionId;
  label: string;
  kind: 'primary' | 'secondary' | 'danger';
}

const actionLabels: Record<TaskActionId, string> = {
  set_difficulty: 'Välj svårighet',
  set_planning: 'Planera tid',
  mark_started: 'Jag har börjat',
  mark_thinks_done: 'Jag tror jag är klar',
  confirm_done: 'Bekräfta klar',
  reject_done: 'Kolla igen',
  comment: 'Kommentera',
};

const roleAllowedActions: Record<Role, TaskActionId[]> = {
  child: ['set_difficulty', 'set_planning', 'mark_started', 'mark_thinks_done', 'comment'],
  parent: ['confirm_done', 'reject_done', 'comment'],
  agent: ['confirm_done', 'reject_done', 'comment'],
};

const statusAllowedActions: Record<Role, Record<TaskStatus, TaskActionId[]>> = {
  child: {
    received: ['set_difficulty', 'set_planning', 'mark_started', 'comment'],
    started: ['set_difficulty', 'set_planning', 'mark_thinks_done', 'comment'],
    thinks_done: ['comment'],
    confirmed_done: [],
  },
  parent: {
    received: ['comment'],
    started: ['comment'],
    thinks_done: ['confirm_done', 'reject_done', 'comment'],
    confirmed_done: ['comment'],
  },
  agent: {
    received: ['comment'],
    started: ['comment'],
    thinks_done: ['confirm_done', 'reject_done', 'comment'],
    confirmed_done: ['comment'],
  },
};

const displayPriority: TaskActionId[] = [
  'confirm_done',
  'reject_done',
  'set_difficulty',
  'set_planning',
  'mark_started',
  'mark_thinks_done',
  'comment',
];

function classifyAction(id: TaskActionId): ActionDescriptor['kind'] {
  if (id === 'reject_done') return 'danger';
  if (id === 'comment') return 'secondary';
  return 'primary';
}

export function getVisibleActions(task: TaskSummary, context: LocalViewContext): ActionDescriptor[] {
  const hints = new Set(task.can_actions ?? []);
  const roleActions = new Set(roleAllowedActions[context.role] ?? []);
  const statusActions = new Set(statusAllowedActions[context.role]?.[task.status] ?? []);

  return displayPriority
    .filter((action) => hints.has(action) && roleActions.has(action) && statusActions.has(action))
    .map((id) => ({ id, label: actionLabels[id], kind: classifyAction(id) }));
}

export interface ApiClientOptions {
  baseUrl?: string;
  context?: LocalViewContext;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export class SchoolTaskApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly context?: LocalViewContext;

  constructor({ baseUrl = '', context, fetchImpl = fetch }: ApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.context = context;
    this.fetchImpl = fetchImpl;
  }

  withContext(context: LocalViewContext): SchoolTaskApiClient {
    return new SchoolTaskApiClient({ baseUrl: this.baseUrl, fetchImpl: this.fetchImpl, context });
  }

  listTasks(childUserId: string): Promise<TaskSummary[]> {
    return this.request(`/tasks?child_user_id=${encodeURIComponent(childUserId)}`);
  }

  getTask(taskId: string): Promise<TaskDetail> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}`);
  }

  listComments(taskId: string): Promise<TaskComment[]> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/comments`);
  }

  createComment(taskId: string, message: string, context = this.requireContext()): Promise<TaskComment> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: 'POST',
      roleContext: context,
      includeUserId: true,
      body: { message },
    });
  }

  updatePlanning(
    taskId: string,
    body: { difficulty: Difficulty; planned_window: PlannedWindow },
    context = this.requireContext(),
  ): Promise<TaskDetail> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/planning`, {
      method: 'PATCH',
      roleContext: context,
      body,
    });
  }

  updateStatus(taskId: string, toStatus: TaskStatus, context = this.requireContext()): Promise<TaskDetail> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/status`, {
      method: 'PATCH',
      roleContext: context,
      body: { to_status: toStatus },
    });
  }

  rejectTask(taskId: string, context: LocalViewContext, reason?: string): Promise<{ ok: true }> {
    return this.request(`/tasks/${encodeURIComponent(taskId)}/reject`, {
      method: 'POST',
      roleContext: context,
      body: { reason: reason?.trim() || undefined, reopen_to_status: 'started' },
    });
  }

  getProgress(childUserId: string): Promise<ChildProgress> {
    return this.request(`/children/${encodeURIComponent(childUserId)}/progress`);
  }

  getPendingAnimations(childUserId: string): Promise<FeedbackAnimation[]> {
    return this.request(`/children/${encodeURIComponent(childUserId)}/animations/pending`);
  }

  ackAnimation(childUserId: string, animationId: string, context = this.requireContext()): Promise<{ acknowledged: boolean; seen_at: string | null }> {
    return this.request(
      `/children/${encodeURIComponent(childUserId)}/animations/${encodeURIComponent(animationId)}/ack`,
      {
        method: 'POST',
        roleContext: context,
      },
    );
  }

  private requireContext(): LocalViewContext {
    if (!this.context) {
      throw new Error('A local role/view context is required for mutating requests.');
    }
    return this.context;
  }

  private async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers = new Headers(options.headers);
    if (options.body !== undefined) headers.set('content-type', 'application/json');
    if (options.roleContext) {
      headers.set('x-role', options.roleContext.role);
      if (options.includeUserId && options.roleContext.userId) {
        headers.set('x-user-id', options.roleContext.userId);
      }
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const payload = await readJson(response);
    if (!response.ok) {
      throw new ApiError(`API request failed with status ${response.status}`, response.status, payload);
    }
    return payload as T;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  headers?: HeadersInit;
  roleContext?: LocalViewContext;
  includeUserId?: boolean;
  body?: unknown;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

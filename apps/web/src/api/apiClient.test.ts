import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SchoolTaskApiClient,
  getVisibleActions,
  type LocalViewContext,
  type TaskSummary,
} from './apiClient';
import { buildViewHref, resolveViewContext } from './viewContext';

function makeFetchRecorder() {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify({ ok: true, id: 'response-id' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { calls, fetchImpl };
}

const task: TaskSummary = {
  id: 'task1',
  child_user_id: 'child1',
  title: 'Läs kapitel 4',
  subject: 'Svenska',
  due_date: '2026-06-03',
  difficulty: 'unknown',
  planned_window: 'unknown',
  status: 'thinks_done',
  can_actions: ['comment', 'confirm_done', 'reject_done'],
};

test('uses can_actions as advisory hints and filters controls through local child/parent view context', () => {
  const childContext: LocalViewContext = { role: 'child', childUserId: 'child1', userId: 'child1' };
  const parentContext: LocalViewContext = { role: 'parent', childUserId: 'child1', userId: 'parent1' };

  assert.deepEqual(getVisibleActions(task, childContext).map((action) => action.id), ['comment']);
  assert.deepEqual(getVisibleActions(task, parentContext).map((action) => action.id), [
    'confirm_done',
    'reject_done',
    'comment',
  ]);
});

test('does not show child planning/progress controls while waiting for adult review even if hints include them', () => {
  const childContext: LocalViewContext = { role: 'child', childUserId: 'child1', userId: 'child1' };
  const noisyTask: TaskSummary = {
    ...task,
    status: 'thinks_done',
    can_actions: ['set_difficulty', 'set_planning', 'mark_thinks_done', 'comment', 'confirm_done', 'reject_done'],
  };

  assert.deepEqual(getVisibleActions(noisyTask, childContext).map((action) => action.id), ['comment']);
});

test('does not show parent child-planning controls even if status-level hints include them', () => {
  const parentContext: LocalViewContext = { role: 'parent', childUserId: 'child1', userId: 'parent1' };
  const noisyTask: TaskSummary = {
    ...task,
    status: 'started',
    can_actions: ['set_difficulty', 'set_planning', 'mark_thinks_done', 'comment'],
  };

  assert.deepEqual(getVisibleActions(noisyTask, parentContext).map((action) => action.id), ['comment']);
});

test('resolves local role switcher context from querystring before env defaults', () => {
  assert.deepEqual(
    resolveViewContext(
      '?role=parent&child_user_id=demo-child&user_id=demo-parent',
      { role: 'child', childUserId: 'env-child', userId: 'env-child' },
    ),
    { role: 'parent', childUserId: 'demo-child', userId: 'demo-parent' },
  );
  assert.deepEqual(resolveViewContext('?role=bogus', { role: 'child', childUserId: 'child1' }), {
    role: 'child',
    childUserId: 'child1',
    userId: 'child1',
  });
  assert.equal(buildViewHref('parent', 'child1', 'parent1'), '?role=parent&child_user_id=child1&user_id=parent1');
});

test('builds real API paths for active tasks, detail, comments, progress, and pending animations', async () => {
  const { calls, fetchImpl } = makeFetchRecorder();
  const client = new SchoolTaskApiClient({ baseUrl: 'http://localhost:3001', fetchImpl });

  await client.listTasks('child1');
  await client.getTask('task1');
  await client.listComments('task1');
  await client.getProgress('child1');
  await client.getPendingAnimations('child1');

  assert.deepEqual(calls.map((call) => call.url), [
    'http://localhost:3001/tasks?child_user_id=child1',
    'http://localhost:3001/tasks/task1',
    'http://localhost:3001/tasks/task1/comments',
    'http://localhost:3001/children/child1/progress',
    'http://localhost:3001/children/child1/animations/pending',
  ]);
});

test('sends x-role on mutating requests and x-user-id when creating comments', async () => {
  const { calls, fetchImpl } = makeFetchRecorder();
  const context: LocalViewContext = { role: 'child', childUserId: 'child1', userId: 'child1' };
  const client = new SchoolTaskApiClient({ baseUrl: 'http://localhost:3001/', fetchImpl, context });

  await client.updatePlanning('task1', { difficulty: 'easy', planned_window: 'today' });
  await client.updateStatus('task1', 'started');
  await client.rejectTask('task1', { role: 'parent', childUserId: 'child1', userId: 'parent1' }, 'Kolla källor');
  await client.createComment('task1', 'Jag börjar idag.');
  await client.ackAnimation('child1', 'anim1');

  assert.deepEqual(calls.map((call) => [call.url, call.init.method]), [
    ['http://localhost:3001/tasks/task1/planning', 'PATCH'],
    ['http://localhost:3001/tasks/task1/status', 'PATCH'],
    ['http://localhost:3001/tasks/task1/reject', 'POST'],
    ['http://localhost:3001/tasks/task1/comments', 'POST'],
    ['http://localhost:3001/children/child1/animations/anim1/ack', 'POST'],
  ]);

  assert.equal(new Headers(calls[0].init.headers).get('x-role'), 'child');
  assert.equal(new Headers(calls[1].init.headers).get('x-role'), 'child');
  assert.equal(new Headers(calls[2].init.headers).get('x-role'), 'parent');
  assert.equal(new Headers(calls[3].init.headers).get('x-role'), 'child');
  assert.equal(new Headers(calls[3].init.headers).get('x-user-id'), 'child1');
  assert.equal(new Headers(calls[4].init.headers).get('x-role'), 'child');
});

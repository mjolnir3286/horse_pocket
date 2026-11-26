import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDay,
  formatWeekRange,
  HISTORY_DAYS,
  PLAN_WEEKS_AHEAD,
  planBounds,
  shiftDay,
  startOfWeek,
  weekDays,
} from './dates.ts';
import { cleanPlanEntry, logEntryFromPlan, STORAGE_KEYS, type LogEntry, type PlanEntry } from './storage.ts';
import { countOlderLogEntries, summarizeLogByDate, summarizePlanByDate } from './plan.ts';
import { buildBackup, parseBackup } from './backup.ts';
import { DEFAULT_PROFILE } from './energy.ts';
import { emptyNutrients } from './nutrition.ts';

test('week and horizon bounds match 60-day history and +4 weeks', () => {
  // 2026-11-25 is a Wednesday
  const today = '2026-11-25';
  assert.equal(startOfWeek(today), '2026-11-22');
  const days = weekDays('2026-11-22');
  assert.equal(days.length, 7);
  assert.equal(days[0], '2026-11-22');
  assert.equal(days[6], '2026-11-28');

  const bounds = planBounds(today);
  // 2026-09-27 through 2026-11-25 is 60 days inclusive of today.
  assert.equal(bounds.minDay, shiftDay(today, -(HISTORY_DAYS - 1)));
  assert.equal(bounds.minDay, '2026-09-27');
  assert.equal(bounds.currentWeekStart, '2026-11-22');
  assert.equal(bounds.maxWeekStart, shiftDay('2026-11-22', PLAN_WEEKS_AHEAD * 7));
  assert.equal(bounds.maxDay, shiftDay(bounds.maxWeekStart, 6));
  assert.ok(bounds.minWeekStart <= bounds.minDay);
});

test('formatDay labels Today, Yesterday, Tomorrow', () => {
  const today = '2026-11-25';
  assert.equal(formatDay('2026-11-25', today), 'Today');
  assert.equal(formatDay('2026-11-24', today), 'Yesterday');
  assert.equal(formatDay('2026-11-26', today), 'Tomorrow');
  assert.notEqual(formatDay('2026-11-28', today), 'Tomorrow');
});

test('formatWeekRange formats same-month and cross-month ranges', () => {
  const same = formatWeekRange('2026-11-22', '2026-11-25');
  assert.ok(same.includes('Nov'));
  assert.ok(same.includes('22'));
  assert.ok(same.includes('28'));

  const cross = formatWeekRange('2026-11-29', '2026-11-25');
  assert.ok(cross.includes('Nov'));
  assert.ok(cross.includes('Dec'));
});

test('storage key uses shed_ prefix and cleanPlanEntry validates fields', () => {
  assert.equal(STORAGE_KEYS.plan, 'shed_plan_v1');

  assert.equal(cleanPlanEntry(null), null);
  assert.equal(cleanPlanEntry({ date: 'bad', name: 'Oats' }), null);
  assert.equal(cleanPlanEntry({ date: '2026-11-26', name: '   ' }), null);

  const cleaned = cleanPlanEntry({
    id: 'p1',
    date: '2026-11-26',
    meal: 'invalid-meal',
    foodId: 'f1',
    name: '  Oatmeal  ',
    servings: -2,
    amountText: '1 serving',
    nutrients: { calories: 300, protein: 10 },
    extraField: 'should-drop',
  })!;
  assert.equal(cleaned.id, 'p1');
  assert.equal(cleaned.meal, 'snacks');
  assert.equal(cleaned.name, 'Oatmeal');
  assert.equal(cleaned.servings, 1);
  assert.equal(cleaned.nutrients.calories, 300);
  assert.equal(cleaned.nutrients.protein, 10);
  assert.equal('extraField' in cleaned, false);
});

test('logEntryFromPlan copies a planned item into a LogEntry without mutating the plan', () => {
  const planItem: PlanEntry = {
    id: 'plan-1',
    date: '2026-11-25',
    meal: 'dinner',
    foodId: 'food-1',
    name: 'Salmon & rice',
    servings: 1.5,
    amountText: '1.5 servings',
    nutrients: { ...emptyNutrients(), calories: 620, protein: 42, carbs: 55, fat: 22 },
    createdAt: '2026-11-24T12:00:00.000Z',
  };
  const now = new Date('2026-11-25T18:30:00.000Z');
  const logEntry = logEntryFromPlan(planItem, '2026-11-25', now);

  assert.notEqual(logEntry.id, planItem.id);
  assert.equal(logEntry.date, '2026-11-25');
  assert.equal(logEntry.meal, 'dinner');
  assert.equal(logEntry.foodId, 'food-1');
  assert.equal(logEntry.name, 'Salmon & rice');
  assert.equal(logEntry.servings, 1.5);
  assert.equal(logEntry.amountText, '1.5 servings');
  assert.equal(logEntry.nutrients.calories, 620);
  assert.equal(logEntry.createdAt, '2026-11-25T18:30:00.000Z');
});

test('summarize helpers keep log and plan totals separate and count older logs without deleting', () => {
  const log: LogEntry[] = [
    {
      id: 'l1',
      date: '2026-11-25',
      meal: 'breakfast',
      foodId: null,
      name: 'Eggs',
      servings: 1,
      amountText: '1 serving',
      nutrients: { ...emptyNutrients(), calories: 210, protein: 18 },
      createdAt: '2026-11-25T08:00:00.000Z',
    },
    {
      id: 'l-old',
      date: '2026-08-01',
      meal: 'lunch',
      foodId: null,
      name: 'Old lunch',
      servings: 1,
      amountText: '1 serving',
      nutrients: { ...emptyNutrients(), calories: 500 },
      createdAt: '2026-08-01T12:00:00.000Z',
    },
  ];
  const plan: PlanEntry[] = [
    {
      id: 'p1',
      date: '2026-11-25',
      meal: 'dinner',
      foodId: null,
      name: 'Planned chili',
      servings: 1,
      amountText: '1 serving',
      nutrients: { ...emptyNutrients(), calories: 540, protein: 30 },
      createdAt: '2026-11-24T12:00:00.000Z',
    },
  ];

  const logMap = summarizeLogByDate(log);
  const planMap = summarizePlanByDate(plan);
  assert.equal(logMap.get('2026-11-25')?.kcal, 210);
  assert.equal(planMap.get('2026-11-25')?.kcal, 540);
  assert.equal(countOlderLogEntries(log, '2026-09-26'), 1);
  assert.equal(log.length, 2);
});

test('backup imports older v1 backups without plan and exports/imports plan when present', () => {
  const legacyJson = JSON.stringify({
    app: 'shed',
    version: 1,
    exportedAt: '2026-11-01T10:00:00.000Z',
    profile: DEFAULT_PROFILE,
    foods: [],
    log: [
      {
        id: 'l1',
        date: '2026-08-15',
        meal: 'lunch',
        foodId: null,
        name: 'Turkey wrap',
        servings: 1,
        amountText: '1 serving',
        nutrients: { ...emptyNutrients(), calories: 410 },
        createdAt: '2026-08-15T12:00:00.000Z',
      },
    ],
  });
  const legacyRes = parseBackup(legacyJson);
  assert.equal(legacyRes.ok, true);
  if (!legacyRes.ok) return;
  assert.deepEqual(legacyRes.backup.plan, []);
  assert.equal(legacyRes.backup.log.length, 1);
  assert.equal(legacyRes.summary.includes('planned'), false);
  assert.ok(legacyRes.summary.includes('including any existing meal plans'));

  const plan: PlanEntry[] = [
    {
      id: 'p1',
      date: '2026-11-27',
      meal: 'breakfast',
      foodId: 'f1',
      name: 'Greek yogurt',
      servings: 1,
      amountText: '1 serving',
      nutrients: { ...emptyNutrients(), calories: 150, protein: 15 },
      createdAt: '2026-11-25T12:00:00.000Z',
    },
  ];
  const exported = buildBackup(DEFAULT_PROFILE, [], [], plan);
  assert.equal(exported.version, 1);
  assert.equal(exported.plan?.length, 1);

  const roundTrip = parseBackup(JSON.stringify(exported));
  assert.equal(roundTrip.ok, true);
  if (!roundTrip.ok) return;
  assert.equal(roundTrip.backup.plan?.length, 1);
  assert.ok(roundTrip.summary.includes('1 planned item over 1 day'));
  assert.ok(roundTrip.summary.includes('including any existing meal plans'));
});

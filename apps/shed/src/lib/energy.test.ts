import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeEnergy, mifflinStJeor, DEFAULT_PROFILE, cmToFtIn, ftInToCm, kgToLb, lbToKg, type Profile } from './energy.ts';
import { scaleNutrients, servingsFromAmount, sumNutrients, emptyNutrients } from './nutrition.ts';

test('Mifflin-St Jeor reference values', () => {
  // 30 y, 70 kg, 175 cm: 700 + 1093.75 - 150 = 1643.75
  assert.equal(mifflinStJeor('male', 70, 175, 30), 1648.75);
  assert.equal(mifflinStJeor('female', 70, 175, 30), 1482.75);
});

const base: Profile = { ...DEFAULT_PROFILE, sex: 'male', age: 30, heightCm: 175, weightKg: 70, activity: 'moderate' };

test('maintain uses TDEE', () => {
  const r = computeEnergy(base)!;
  assert.equal(r.bmr, 1649);
  assert.equal(r.tdee, Math.round(1648.75 * 1.55));
  assert.equal(r.target, Math.round((1648.75 * 1.55) / 10) * 10);
  assert.equal(r.limitedBy, null);
});

test('steady loss subtracts 500', () => {
  const r = computeEnergy({ ...base, goal: 'lose', pace: 'steady' })!;
  assert.equal(r.adjustment, -500);
  assert.equal(r.limitedBy, null);
});

test('deficit is capped at 25% of TDEE', () => {
  // 30 y, 165 cm, 70 kg woman, light activity: TDEE ~1953, so 25% (~488) is less than 500
  const p: Profile = { ...DEFAULT_PROFILE, sex: 'female', age: 30, heightCm: 165, weightKg: 70, activity: 'light', goal: 'lose', pace: 'steady' };
  const r = computeEnergy(p)!;
  assert.equal(r.limitedBy, 'deficit-cap');
  assert.equal(r.adjustment, -Math.round(r.tdee * 0.25));
});

test('loss target stops at the floor', () => {
  // TDEE ~1487; -500 capped to -372 gives ~1115, below the 1200 floor
  const p: Profile = { ...DEFAULT_PROFILE, sex: 'female', age: 40, heightCm: 160, weightKg: 60, activity: 'sedentary', goal: 'lose', pace: 'steady' };
  const r = computeEnergy(p)!;
  assert.equal(r.target, 1200);
  assert.equal(r.limitedBy, 'floor');
});

test('never suggests a surplus when trying to lose', () => {
  const p: Profile = { ...DEFAULT_PROFILE, sex: 'female', age: 90, heightCm: 140, weightKg: 35, activity: 'sedentary', goal: 'lose', pace: 'steady' };
  const r = computeEnergy(p)!;
  assert.ok(r.target <= r.tdee + 10);
});

test('incomplete profile returns null', () => {
  assert.equal(computeEnergy(DEFAULT_PROFILE), null);
});

test('unit conversions round-trip', () => {
  assert.deepEqual(cmToFtIn(ftInToCm(5, 10)), { ft: 5, inch: 10 });
  assert.ok(Math.abs(lbToKg(kgToLb(80)) - 80) < 1e-9);
});

test('serving math', () => {
  const per = { ...emptyNutrients(), calories: 230, fat: 8, protein: 3, sodium: 160 };
  assert.equal(servingsFromAmount(1.5, 'servings', null), 1.5);
  assert.equal(servingsFromAmount(110, 'grams', 55), 2);
  assert.equal(servingsFromAmount(40, 'grams', null), null);
  const s = scaleNutrients(per, 1.5);
  assert.equal(s.calories, 345);
  assert.equal(s.fat, 12);
  assert.equal(s.carbs, null);
  const t = sumNutrients([s, per]);
  assert.equal(t.calories, 575);
  assert.equal(t.sodium, 400);
});

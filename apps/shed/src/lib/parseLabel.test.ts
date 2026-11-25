import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNutritionLabel } from './parseLabel.ts';

test('clean modern label text', () => {
  const text = `Nutrition Facts
8 servings per container
Serving size 2/3 cup (55g)
Amount per serving
Calories 230
% Daily Value*
Total Fat 8g 10%
Saturated Fat 1g 5%
Trans Fat 0g
Cholesterol 0mg 0%
Sodium 160mg 7%
Total Carbohydrate 37g 13%
Dietary Fiber 4g 14%
Total Sugars 12g
Includes 10g Added Sugars 20%
Protein 3g`;
  const r = parseNutritionLabel(text);
  assert.equal(r.servingsPerContainer, 8);
  assert.equal(r.servingSize, '2/3 cup');
  assert.equal(r.servingGrams, 55);
  assert.deepEqual(r.nutrients, {
    calories: 230,
    fat: 8,
    satFat: 1,
    cholesterol: 0,
    sodium: 160,
    carbs: 37,
    fiber: 4,
    sugar: 12,
    protein: 3,
  });
  assert.deepEqual(r.uncertain, []);
  assert.equal(r.found, 5);
});

test('typical OCR noise: g read as 9, O for 0, split calories, pipes', () => {
  const text = `Nutrition Facts
About 6 servings per container
Serving size 1 bar (409)
Amount per serving
Calories
190
% Daily Value*
Total Fat 89 10%
Saturated Fat 3.59 18%
Cholesterol Omg 0%
Sodium 120m9 5%
Total Carbohydrate 299 11%
Dietary Fiber 29 7%
Total Sugars 139
| Includes 12g Added Sugars 24%
Protein 4g`;
  const r = parseNutritionLabel(text);
  assert.equal(r.servingsPerContainer, 6);
  assert.equal(r.servingGrams, 40);
  assert.equal(r.servingSize, '1 bar');
  assert.equal(r.nutrients.calories, 190);
  assert.equal(r.nutrients.fat, 8); // 10% of 78 g -> 8, not 89
  assert.equal(r.nutrients.satFat, 3.5); // 18% of 20 g -> 3.6, so 3.5 not 3.59
  assert.equal(r.nutrients.cholesterol, 0);
  assert.equal(r.nutrients.sodium, 120);
  assert.equal(r.nutrients.carbs, 29); // 11% of 275 -> 30, closer to 29 than 299
  assert.equal(r.nutrients.fiber, 2); // 7% of 28 -> 2
  assert.equal(r.nutrients.sugar, 13); // no %DV; 139 g is implausible per serving
  assert.equal(r.nutrients.protein, 4);
});

test('older label layout with Servings Per Container About N and calorie footer', () => {
  const text = `Nutrition Facts
Serving Size 1 cup (228g)
Servings Per Container About 2
Amount Per Serving
Calories 250 Calories from Fat 110
Total Fat 12g 18%
Saturated Fat 3g 15%
Trans Fat 3g
Cholesterol 30mg 10%
Sodium 470mg 20%
Total Carbohydrate 31g 10%
Dietary Fiber 0g 0%
Sugars 5g
Protein 5g
Calories per gram:
Fat 9 • Carbohydrate 4 • Protein 4`;
  const r = parseNutritionLabel(text);
  assert.equal(r.servingsPerContainer, 2);
  assert.equal(r.servingGrams, 228);
  assert.equal(r.nutrients.calories, 250);
  assert.equal(r.nutrients.fat, 12);
  assert.equal(r.nutrients.satFat, 3);
  assert.equal(r.nutrients.cholesterol, 30);
  assert.equal(r.nutrients.sodium, 470);
  assert.equal(r.nutrients.carbs, 31);
  assert.equal(r.nutrients.fiber, 0);
  assert.equal(r.nutrients.sugar, 5);
  assert.equal(r.nutrients.protein, 5);
});

test('less-than values and missing fields', () => {
  const r = parseNutritionLabel(`Serving size 1 tbsp (15 mL)
Calories 10
Total Fat 0g 0%
Sodium 290mg 13%
Total Carb. <1g 0%
Protein less than 1g`);
  assert.equal(r.servingSize, '1 tbsp (15 mL)');
  assert.equal(r.servingGrams, null);
  assert.equal(r.nutrients.calories, 10);
  assert.equal(r.nutrients.carbs, 0.5);
  assert.equal(r.nutrients.protein, 0.5);
  assert.equal(r.nutrients.fiber, null);
  assert.equal(r.nutrients.sugar, null);
});

test('garbage text finds nothing', () => {
  const r = parseNutritionLabel('qwerty\n12 34\nhello world');
  assert.equal(r.found, 0);
  assert.equal(r.nutrients.calories, null);
});

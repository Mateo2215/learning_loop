/**
 * Testy bramy zaliczenia materiału (computeSectionStatus).
 * Uruchom: node --test lib/sessions/section-status.test.ts (Node ≥22 strip-types).
 *
 * Reguła zaliczenia: średnia ≥7 ORAZ żadne pytanie poniżej 6.
 *   - jakieś pytanie <6           → needs_followup (twarda luka)
 *   - wszystkie ≥6 i średnia ≥7   → done
 *   - wszystkie ≥6 i średnia <7   → below_threshold
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSectionStatus } from "./section-status.ts";

test("brak pytań → fresh", () => {
  assert.equal(computeSectionStatus([]).status, "fresh");
});

test("żadne jeszcze nieocenione → fresh", () => {
  assert.equal(computeSectionStatus([null, null]).status, "fresh");
});

test("część nieocenionych → in_progress", () => {
  assert.equal(computeSectionStatus([8, null, 7]).status, "in_progress");
});

test("wszystkie ≥6 i średnia ≥7 → done (szóstka nie blokuje)", () => {
  const s = computeSectionStatus([6, 7, 7, 8, 8]);
  assert.equal(s.status, "done");
  assert.equal(s.below_floor_count, 0);
  assert.equal(s.avg, 7.2);
});

test("klasyczny komplet siódemek → done", () => {
  assert.equal(computeSectionStatus([7, 7, 7]).status, "done");
});

test("pytanie poniżej 6 → needs_followup, mimo wysokiej średniej", () => {
  const s = computeSectionStatus([5, 8, 8, 8, 8]);
  assert.equal(s.status, "needs_followup");
  assert.equal(s.below_floor_count, 1);
  assert.equal(s.avg, 7.4); // średnia ≥7, a i tak nie 'done' (luka <6 wygrywa)
});

test("wszystkie ≥6, ale średnia <7 → below_threshold (osiągalny po zmianie)", () => {
  const s = computeSectionStatus([6, 6, 6, 7, 7]);
  assert.equal(s.status, "below_threshold");
  assert.equal(s.below_floor_count, 0);
  assert.equal(s.avg, 6.4);
});

test("same szóstki → below_threshold (średnia 6 <7, brak luki <6)", () => {
  const s = computeSectionStatus([6, 6, 6]);
  assert.equal(s.status, "below_threshold");
  assert.equal(s.below_floor_count, 0);
});

test("weak_count nadal liczy <7 (pytania wracające do powtórki)", () => {
  // 6 i 6 są weak (<7) choć ≥ podłogi; służą do podniesienia średniej.
  const s = computeSectionStatus([6, 6, 8, 9, 9]);
  assert.equal(s.weak_count, 2);
  assert.equal(s.below_floor_count, 0);
  assert.equal(s.status, "done"); // średnia 7.6
});

test("granica: dokładnie średnia 7 → done", () => {
  assert.equal(computeSectionStatus([6, 7, 8]).status, "done"); // avg = 7
});

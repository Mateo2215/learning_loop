/**
 * Testy bramy zaliczenia materiału (computeSectionStatus).
 * Uruchom: node --test lib/sessions/section-status.test.ts (Node ≥22 strip-types).
 *
 * Reguła zaliczenia: WSZYSTKIE pytania odpowiedziane ORAZ żadne poniżej 6.
 *   - nic nieocenione            → fresh
 *   - część nieocenionych        → in_progress
 *   - wszystkie ocenione, jakieś <6 → needs_followup
 *   - wszystkie ocenione, żadne <6  → done (średnia nie bramkuje)
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

test("wszystkie ≥6, niska średnia → done (średnia nie bramkuje)", () => {
  const s = computeSectionStatus([6, 6, 6]);
  assert.equal(s.status, "done");
  assert.equal(s.below_floor_count, 0);
  assert.equal(s.avg, 6); // średnia <7, a i tak zaliczone — żadne <6
});

test("szóstka nie blokuje zaliczenia", () => {
  const s = computeSectionStatus([6, 7, 7, 8, 8]);
  assert.equal(s.status, "done");
  assert.equal(s.below_floor_count, 0);
});

test("klasyczny komplet siódemek → done", () => {
  assert.equal(computeSectionStatus([7, 7, 7]).status, "done");
});

test("pytanie poniżej 6 → needs_followup, mimo wysokiej średniej", () => {
  const s = computeSectionStatus([5, 8, 8, 8, 8]);
  assert.equal(s.status, "needs_followup");
  assert.equal(s.below_floor_count, 1);
  assert.equal(s.avg, 7.4); // wysoka średnia nie maskuje luki <6
});

test("kilka pytań <6 → needs_followup, below_floor_count je liczy", () => {
  const s = computeSectionStatus([3, 5, 6, 7, 9]);
  assert.equal(s.status, "needs_followup");
  assert.equal(s.below_floor_count, 2); // 3 i 5
});

test("luka <6 wśród nieukończonych → najpierw in_progress (nie needs_followup)", () => {
  // Materiał niedokończony nie przechodzi w needs_followup, dopóki wszystkie
  // pytania nie zostaną ocenione.
  assert.equal(computeSectionStatus([5, null, 8]).status, "in_progress");
});

test("weak_count nadal liczy <7 (display 'opanowane'), niezależnie od bramy", () => {
  // 6 i 6 są weak (<7) ale ≥ podłogi — nie blokują i nie wracają do Deep Dive.
  const s = computeSectionStatus([6, 6, 8, 9, 9]);
  assert.equal(s.weak_count, 2);
  assert.equal(s.below_floor_count, 0);
  assert.equal(s.mastered_count, 3);
  assert.equal(s.status, "done");
});

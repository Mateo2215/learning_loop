/**
 * Testy adaptacyjnej drabiny interwałów audytu.
 * Uruchom: node --test lib/audits/intervals.test.ts (Node ≥22 strip-types).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { nextAuditInterval, AUDIT_INTERVAL_LADDER } from "./intervals.ts";

test("round 1, dobry wynik → awans na round 2 (21 dni)", () => {
  assert.deepEqual(nextAuditInterval(1, 9), { intervalDays: 21, nextRound: 2 });
});

test("round 1, średni wynik → ten sam szczebel (7 dni)", () => {
  assert.deepEqual(nextAuditInterval(1, 5), { intervalDays: 7, nextRound: 1 });
});

test("round 1, słaby wynik → spadek z podłogą 7 dni, round nie poniżej 1", () => {
  assert.deepEqual(nextAuditInterval(1, 2), { intervalDays: 7, nextRound: 1 });
});

test("round 2, słaby wynik → spadek na round 1 (7 dni)", () => {
  assert.deepEqual(nextAuditInterval(2, 3), { intervalDays: 7, nextRound: 1 });
});

test("kolejne dobre wyniki wspinają się po drabinie", () => {
  assert.deepEqual(nextAuditInterval(2, 8), { intervalDays: 60, nextRound: 3 });
  assert.deepEqual(nextAuditInterval(3, 8), { intervalDays: 150, nextRound: 4 });
  assert.deepEqual(nextAuditInterval(4, 8), { intervalDays: 365, nextRound: 5 });
});

test("sufit drabiny — wysoki round nie przekracza ostatniego szczebla", () => {
  const last = AUDIT_INTERVAL_LADDER[AUDIT_INTERVAL_LADDER.length - 1];
  assert.deepEqual(nextAuditInterval(5, 10), { intervalDays: last, nextRound: 6 });
  assert.deepEqual(nextAuditInterval(9, 10), { intervalDays: last, nextRound: 10 });
});

test("średni wynik na wyższym szczeblu utrzymuje interwał", () => {
  assert.deepEqual(nextAuditInterval(3, 6), { intervalDays: 60, nextRound: 3 });
});

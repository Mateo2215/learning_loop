/**
 * Wraps `ts-fsrs` with the project's configuration. Single source of truth
 * for FSRS state mutations — never touch fsrs_* fields directly from elsewhere.
 *
 * Config per CLAUDE.md:
 *   request_retention: 0.90    target retention rate
 *   maximum_interval: 365      cap at 1 year
 *   enable_fuzz: true          slight interval randomization
 *   weights: undefined         use library defaults, will adapt later
 */

import {
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type RecordLog,
} from "ts-fsrs";
import type { Item } from "@/lib/db/types";

const PARAMS = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 180,
  enable_fuzz: true,
});

const SCHEDULER = fsrs(PARAMS);

export type FsrsRating = 1 | 2 | 3 | 4; // Again | Hard | Good | Easy

/** FSRS-relevant subset of an item row. */
export type ItemFsrsState = Pick<
  Item,
  | "fsrs_stability"
  | "fsrs_difficulty"
  | "fsrs_due_date"
  | "fsrs_last_review"
  | "fsrs_review_count"
  | "fsrs_lapse_count"
>;

/** DB columns returned by `applyRating` to write back to `items` plus the review row data. */
export interface ApplyRatingResult {
  itemUpdate: {
    fsrs_stability: number;
    fsrs_difficulty: number;
    fsrs_due_date: string;
    fsrs_last_review: string;
    fsrs_review_count: number;
    fsrs_lapse_count: number;
    is_leech: boolean;
  };
}

/**
 * Compute next FSRS state given an item and a rating.
 *
 * Leech detection per CLAUDE.md: 4+ failures in last 10 reviews → mark as leech.
 * We approximate this with `fsrs_lapse_count >= 4` once the item has been seen
 * at least 10 times; tightening to a sliding window of the last 10 reviews can
 * happen once we have a need (probably M2). Leeches stay in rotation, not
 * suspended.
 */
export function applyRating(
  current: ItemFsrsState,
  rating: FsrsRating,
  now: Date = new Date()
): ApplyRatingResult {
  const card = itemToCard(current, now);
  const log: RecordLog = SCHEDULER.repeat(card, now);

  const ratingKey = (
    {
      1: Rating.Again,
      2: Rating.Hard,
      3: Rating.Good,
      4: Rating.Easy,
    } as const
  )[rating];

  const next = log[ratingKey];
  const nextCard = next.card;

  const lapseCount = nextCard.lapses;
  const reviewCount = (current.fsrs_review_count ?? 0) + 1;
  const isLeech = reviewCount >= 10 && lapseCount >= 4;

  return {
    itemUpdate: {
      fsrs_stability: nextCard.stability,
      fsrs_difficulty: nextCard.difficulty,
      fsrs_due_date: nextCard.due.toISOString(),
      fsrs_last_review: now.toISOString(),
      fsrs_review_count: reviewCount,
      fsrs_lapse_count: lapseCount,
      is_leech: isLeech,
    },
  };
}

/**
 * Initial FSRS values for a freshly-generated item that has never been reviewed.
 * Items start with `due_date = now`, so they appear in the queue immediately.
 */
export function initialFsrsState(now: Date = new Date()): {
  fsrs_stability: null;
  fsrs_difficulty: null;
  fsrs_due_date: string;
  fsrs_last_review: null;
  fsrs_review_count: 0;
  fsrs_lapse_count: 0;
} {
  return {
    fsrs_stability: null,
    fsrs_difficulty: null,
    fsrs_due_date: now.toISOString(),
    fsrs_last_review: null,
    fsrs_review_count: 0,
    fsrs_lapse_count: 0,
  };
}

export type IntervalPreview = Record<FsrsRating, string>;

/**
 * Simulates all 4 ratings for the current item state and returns human-readable
 * next-due labels (e.g. "10 min", "4 d") without mutating anything.
 */
export function previewIntervals(current: ItemFsrsState, now: Date = new Date()): IntervalPreview {
  const card = itemToCard(current, now);
  const log: RecordLog = SCHEDULER.repeat(card, now);

  function fmt(due: Date): string {
    const ms = due.getTime() - now.getTime();
    const min = Math.round(ms / 60_000);
    if (min < 60) return `${min} min`;
    const h = Math.round(ms / 3_600_000);
    if (h < 24) return `${h} h`;
    const d = Math.round(ms / 86_400_000);
    if (d < 30) return `${d} d`;
    return `${Math.round(d / 30)} mies.`;
  }

  return {
    1: fmt(log[Rating.Again].card.due),
    2: fmt(log[Rating.Hard].card.due),
    3: fmt(log[Rating.Good].card.due),
    4: fmt(log[Rating.Easy].card.due),
  };
}

function itemToCard(s: ItemFsrsState, now: Date): FsrsCard {
  // ts-fsrs's createEmptyCard is the canonical "new" state. For seen cards
  // we hydrate from the stored fsrs_* fields.
  if (s.fsrs_review_count === 0 || s.fsrs_stability == null || s.fsrs_difficulty == null) {
    return {
      due: s.fsrs_due_date ? new Date(s.fsrs_due_date) : now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: s.fsrs_lapse_count ?? 0,
      state: State.New,
      last_review: undefined,
      learning_steps: 0,
    };
  }

  const lastReview = s.fsrs_last_review ? new Date(s.fsrs_last_review) : undefined;
  const due = s.fsrs_due_date ? new Date(s.fsrs_due_date) : now;

  return {
    due,
    stability: Number(s.fsrs_stability),
    difficulty: Number(s.fsrs_difficulty),
    elapsed_days: lastReview
      ? Math.max(0, (now.getTime() - lastReview.getTime()) / 86_400_000)
      : 0,
    scheduled_days: 0,
    reps: s.fsrs_review_count,
    lapses: s.fsrs_lapse_count,
    state: s.fsrs_lapse_count > 0 ? State.Review : State.Review,
    last_review: lastReview,
    learning_steps: 0,
  };
}

// Plaza dance party: one round of a tiny rhythm game. Prompts land on the beat; tap the
// matching move button as the ring closes. Pure logic (no DOM, no sound), driven by main.js.
// Scoring is personal. Each hit plays an ordinary emote for friends to see, so the prompts
// are spaced to stay inside the server's emote rate limit (EMOTE_LIMIT in schema.js).
import { DANCE_MOVES } from './data.js';

export const DANCE = Object.freeze({
  beat: 0.6, // seconds per beat (100 beats a minute)
  lead: 4, // beats of music before the first prompt
  every: 2, // beats between prompts
  prompts: 12,
  show: 1.0, // seconds a prompt is on screen before its beat
  perfect: 0.16, // tap within this many seconds of the beat
  good: 0.38, // ...or this many, either side
});
/** Seconds between two prompts: at most one emote each, slower than the emote limit (the tests check). */
export const DANCE_GAP = DANCE.beat * DANCE.every;

export class DanceRound {
  constructor(rand = Math.random) {
    this.prompts = [];
    for (let i = 0; i < DANCE.prompts; i++) {
      let move = DANCE_MOVES[Math.floor(rand() * DANCE_MOVES.length) % DANCE_MOVES.length];
      // never the same move three times running
      if (i > 1 && this.prompts[i - 1].move === move && this.prompts[i - 2].move === move) move = DANCE_MOVES[(DANCE_MOVES.indexOf(move) + 1) % DANCE_MOVES.length];
      this.prompts.push({ i, move, at: (DANCE.lead + i * DANCE.every) * DANCE.beat, result: null });
    }
    this.cursor = 0; // first prompt not yet hit or missed
    this.hits = 0;
    this.perfects = 0;
    this.length = this.prompts[this.prompts.length - 1].at + DANCE.beat * 2;
  }

  /** The prompt to show at time t (seconds since the music started), or null between prompts. */
  current(t) {
    const p = this.prompts[this.cursor];
    return p && t >= p.at - DANCE.show ? p : null;
  }

  /**
   * A move button was tapped at time t. Returns 'perfect' | 'good' | 'miss' (wrong move), or
   * null when no prompt is close enough to its beat yet (early taps are simply ignored).
   */
  tap(move, t) {
    const p = this.prompts[this.cursor];
    if (!p || Math.abs(t - p.at) > DANCE.good) return null;
    this.cursor++;
    if (move !== p.move) return (p.result = 'miss');
    this.hits++;
    if (Math.abs(t - p.at) <= DANCE.perfect) {
      this.perfects++;
      return (p.result = 'perfect');
    }
    return (p.result = 'good');
  }

  /** Call every frame: prompts nobody tapped in time become misses. Returns how many just did. */
  advance(t) {
    let missed = 0;
    while (this.cursor < this.prompts.length && t > this.prompts[this.cursor].at + DANCE.good) {
      this.prompts[this.cursor++].result = 'miss';
      missed++;
    }
    return missed;
  }

  done(t) {
    return this.cursor >= this.prompts.length && t >= this.length;
  }

  /** One star for joining in, up to three for hitting nearly everything. */
  stars() {
    const f = this.hits / this.prompts.length;
    return f >= 0.85 ? 3 : f >= 0.5 ? 2 : 1;
  }
}

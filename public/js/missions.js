// Reviewer missions: picture challenges that are ticked off by filming reviews.
// Pure data in, data out (no DOM), so the scrapbook, the menu tags and the tests all agree.
// Missions are personal and live on the device; nothing here is ever sent to friends.
import { MISSIONS, MISSION_SLOTS, FOOD_TAGS, RANKS, RESTAURANTS, BUILDS } from './data.js';

const BY_ID = new Map(MISSIONS.map((m) => [m.id, m])); // a Map, so saved ids like "constructor" find nothing
const KEY_OK = /^[a-z0-9]{1,24}$/;

/** { active: [{ id, have, seen }], done, next }: three missions on the go, how many finished, which comes next. */
export function newMissions() {
  return { active: MISSIONS.slice(0, MISSION_SLOTS).map((m) => ({ id: m.id, have: 0, seen: [] })), done: 0, next: MISSION_SLOTS };
}

/** The next mission in the list that is not already on the go. */
function deal(state) {
  for (let tries = 0; tries < MISSIONS.length; tries++) {
    const m = MISSIONS[state.next % MISSIONS.length];
    state.next = (state.next + 1) % MISSIONS.length;
    if (!state.active.some((a) => a.id === m.id)) return { id: m.id, have: 0, seen: [] };
  }
  return null;
}

/** Clean up saved mission progress (anything odd is dropped and dealt again). */
export function repairMissions(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  if (!Array.isArray(src.active)) return newMissions(); // nothing saved yet
  const state = {
    active: [],
    done: Number.isInteger(src.done) && src.done >= 0 && src.done < 100000 ? src.done : 0,
    next: Number.isInteger(src.next) && src.next >= 0 ? src.next % MISSIONS.length : MISSION_SLOTS % MISSIONS.length,
  };
  for (const a of src.active.slice(0, MISSION_SLOTS)) {
    const def = a && BY_ID.get(a.id);
    if (!def || state.active.some((x) => x.id === def.id)) continue;
    const seen = Array.isArray(a.seen) ? [...new Set(a.seen.filter((k) => typeof k === 'string' && KEY_OK.test(k)))].slice(0, def.need) : [];
    const have = Number.isInteger(a.have) ? Math.max(0, Math.min(def.need - 1, a.have)) : 0;
    state.active.push({ id: def.id, have: def.each ? Math.min(have, seen.length) : have, seen: def.each ? seen : [] });
  }
  while (state.active.length < MISSION_SLOTS) {
    const fresh = deal(state);
    if (!fresh) break;
    state.active.push(fresh);
  }
  return state;
}

/** Does a review count toward mission `def`? ev = { rid, fid, stars, react, mystery, isNew }. */
function counts(def, ev) {
  switch (def.kind) {
    case 'tag': return FOOD_TAGS[def.tag].includes(ev.fid);
    case 'react': return ev.react === def.react;
    case 'mystery': return !!ev.mystery;
    case 'new': return !!ev.isNew;
    case 'stars': return ev.stars >= 5;
    default: return true;
  }
}
const advances = (def, slot, ev) => counts(def, ev) && !(def.each && slot.seen.includes(ev[def.each]));

/**
 * A review was saved. Returns { state, completed }: the new mission state (the old one is not
 * changed) and the missions that review finished. A finished mission is replaced by the next one.
 */
export function applyReview(old, ev) {
  const state = { ...old, active: old.active.map((a) => ({ ...a, seen: [...a.seen] })) };
  state.active.forEach((slot) => {
    const def = BY_ID.get(slot.id);
    if (!advances(def, slot, ev)) return;
    slot.have++;
    if (def.each) slot.seen.push(ev[def.each]);
  });
  return finishMissions(state);
}

/** Finish and replace any slots whose progress has reached the goal. */
function finishMissions(state) {
  const completed = [];
  state.active.forEach((slot, i) => {
    const def = BY_ID.get(slot.id);
    if (slot.have < def.need) return;
    completed.push(def);
    state.done++;
    state.active[i] = null;
  });
  // deal replacements into the empty slots (never a mission that is still on the go)
  const kept = state.active.filter(Boolean);
  state.active = state.active.map((slot) => {
    if (slot) return slot;
    const fresh = deal({ get active() { return kept; }, get next() { return state.next; }, set next(v) { state.next = v; } });
    if (fresh) kept.push(fresh);
    return fresh;
  }).filter(Boolean);
  return { state, completed };
}

/** Fold in another tab's progress without erasing unfinished missions or counting shared reviews twice. */
export function mergeMissions(session, saved) {
  const base = session.done > saved.done ? session : saved;
  const state = { ...base, active: base.active.map((a) => ({ ...a, seen: [...a.seen] })) };
  // Different rounds may reuse a mission id: only pool progress from the same round.
  if (session.done !== saved.done || session.next !== saved.next) return state;
  for (const slot of state.active) {
    const other = session.active.find((a) => a.id === slot.id);
    if (!other) continue;
    const def = BY_ID.get(slot.id);
    slot.seen = [...new Set([...slot.seen, ...other.seen])];
    slot.have = def.each ? slot.seen.length : Math.max(slot.have, other.have);
  }
  return finishMissions(state).state;
}

/** Would reviewing this food move an active mission along? (for the 🎯 tags on the menu) */
export function menuGoal(state, ev) {
  return state.active.some((slot) => {
    const def = BY_ID.get(slot.id);
    return def.kind !== 'stars' && def.kind !== 'mystery' && advances(def, slot, ev);
  });
}

/** Mission cards for the scrapbook: [{ ...mission, have, hints }], hints = emoji of foods that count. */
export function missionCards(state) {
  return state.active.map((slot) => {
    const def = BY_ID.get(slot.id);
    const hints = [];
    if (def.kind === 'tag' || def.kind === 'react') {
      const foods = [...RESTAURANTS.flatMap((r) => r.menu), ...Object.values(BUILDS).map((b) => ({ ...b, id: b.fid }))];
      for (const item of foods) {
        if (counts(def, { fid: item.id, react: item.react }) && !hints.includes(item.emoji)) hints.push(item.emoji);
      }
    }
    return { ...def, have: slot.have, hints: hints.slice(0, 6) };
  });
}

/** Reviewer rank for a number of finished missions, and how many more the next rank needs. */
export function missionRank(done) {
  let i = 0;
  while (i + 1 < RANKS.length && done >= RANKS[i + 1].at) i++;
  const next = RANKS[i + 1] || null;
  return { ...RANKS[i], next, toGo: next ? next.at - done : 0 };
}

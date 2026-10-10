// Sticker passport: what a reviewer has earned, worked out from their saved reviews.
// Pure data in, data out (no DOM), so the closet, the scrapbook and the tests all agree.
import { RESTAURANTS, BADGES } from './data.js';

/**
 * reviews: [{ rid, fid, ... }] as returned by storage.loadReviews().
 * Returns { stickers: [restaurant ids], badges: [{ ...badge, have, need, where, earned }], hats: [hat ids] }.
 */
export function passportProgress(reviews) {
  const tried = new Map(RESTAURANTS.map((r) => [r.id, new Set()]));
  const visited = new Set();
  for (const rv of reviews) {
    if (!tried.has(rv.rid)) continue;
    visited.add(rv.rid);
    if (rv.fid) tried.get(rv.rid).add(rv.fid);
  }
  const stickers = RESTAURANTS.filter((r) => visited.has(r.id)).map((r) => r.id);

  // "Try every food at one restaurant" counts the menu you are closest to finishing.
  let best = { have: 0, need: RESTAURANTS[0].menu.length, where: '' };
  for (const r of RESTAURANTS) {
    const have = r.menu.filter((m) => tried.get(r.id).has(m.id)).length;
    const need = r.menu.length;
    if (have * best.need > best.have * need) best = { have, need, where: r.name };
  }

  const badges = BADGES.map((b) => {
    const p = b.kind === 'menu' ? best : { have: Math.min(stickers.length, b.need), need: b.need, where: '' };
    return { ...b, ...p, earned: p.have >= p.need };
  });
  return { stickers, badges, hats: ['none', ...badges.filter((b) => b.earned).map((b) => b.hat)] };
}

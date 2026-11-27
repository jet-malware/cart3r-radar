// Synthetic TEST data generator. Produces fake accounts/transactions only,
// so you can exercise and tune your own detection rules safely.

export const COUNTRIES = ['US', 'GB', 'DE', 'FR', 'PL', 'UA', 'CA', 'NL', 'ES', 'IT'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];

/** One normal-looking transaction, with a small chance of a suspicious pattern. */
export function genTransaction(rnd, account, ts) {
  const home = account.home_country;
  const base = {
    account_id: account.id,
    amount: Math.round((5 + Math.exp(rnd() * 5.2)) * 100) / 100,   // ~ $7 .. $1000
    country: home, ip_country: home,
    channel: pick(rnd, ['web', 'web', 'mobile', 'mobile', 'pos']),
    payee_new: 0, status: 'approved', created_at: ts,
  };
  const roll = rnd();
  if (roll < 0.015) return [{ ...base, amount: 2000 + Math.round(rnd() * 6000) }];                 // high amount
  if (roll < 0.035) return [{ ...base, ip_country: pick(rnd, COUNTRIES.filter(c => c !== home)) }]; // geo mismatch
  if (roll < 0.045) return [{ ...base, channel: 'transfer', payee_new: 1, amount: 900 + Math.round(rnd() * 3000) }];
  if (roll < 0.052) {                                                                              // small-decline burst
    return Array.from({ length: 4 }, (_, i) => ({
      ...base, amount: 1 + Math.round(rnd() * 3), status: 'declined', created_at: ts + i * 20_000,
    }));
  }
  if (roll < 0.058) {                                                                              // rapid burst
    return Array.from({ length: 6 }, (_, i) => ({
      ...base, amount: 20 + Math.round(rnd() * 80), created_at: ts + i * 40_000,
    }));
  }
  return [base];
}

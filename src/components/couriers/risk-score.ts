/**
 * Return-risk score for a buyer's phone (FR-CUS-06). Pure, so the device can
 * score its own history offline and the server can add network counts.
 */
export type Counts = { delivered: number; returned: number; cancelled: number };
export type NetworkCounts = Counts & { merchants: number };
export type RiskLevel = "new" | "trusted" | "watch" | "risky";

export type RiskResult = {
  level: RiskLevel;
  /** 0 (safe) – 100 (very likely to refuse). */
  score: number;
  own: Counts;
  network: NetworkCounts | null;
  /** True when a high-risk buyer should pay the delivery charge in advance. */
  askAdvance: boolean;
};

/**
 * Bayesian-smoothed return rate: a prior of 1 return in 10 parcels (roughly
 * the Bangladeshi COD baseline) so one bad experience doesn't brand a buyer,
 * but a pattern does. Cancellations count as half a return; the shop's own
 * history weighs double versus other shops.
 */
export function scoreRisk(own: Counts, network: NetworkCounts | null, flagged = false): RiskResult {
  const n = network ?? { delivered: 0, returned: 0, cancelled: 0, merchants: 0 };
  const bad = 2 * (own.returned + own.cancelled * 0.5) + n.returned + n.cancelled * 0.5;
  const good = 2 * own.delivered + n.delivered;
  const priorBad = 1;
  const priorGood = 9;
  const rate = (bad + priorBad) / (bad + good + priorBad + priorGood);
  const evidence = own.delivered + own.returned + own.cancelled + n.delivered + n.returned + n.cancelled;
  const score = Math.round(Math.min(1, rate / 0.5) * 100);
  let level: RiskLevel = evidence === 0 ? "new" : rate >= 0.25 && own.returned + n.returned >= 2 ? "risky" : rate >= 0.16 ? "watch" : "trusted";
  if (flagged) level = "risky";
  return { level, score: flagged ? Math.max(score, 80) : score, own, network, askAdvance: level === "risky" };
}

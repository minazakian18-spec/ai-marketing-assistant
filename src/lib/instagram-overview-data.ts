export type InstagramPeriod = 7 | 30 | 90;
export const instagramOverviewMetrics = {
  reach: "12.840",
  engagement: "6,8%",
  reachTrend: "+18%",
  engagementTrend: "+0,9 pp",
};
export const bestInstagramPost = {
  title: "Weekendactie 🍕",
  caption:
    "Dit weekend zetten we onze favorieten in de spotlight. Ontdek jouw nieuwe favoriet en geniet samen van iets lekkers.",
  reach: "4.820",
  interactions: "318",
  engagement: "7,2%",
};
export function instagramOverviewSeries(period: InstagramPeriod) {
  const shapes: Record<InstagramPeriod, number[]> = {
    7: [24, 31, 28, 40, 37, 46, 54],
    30: [20, 29, 25, 38, 32, 44, 41, 50, 46, 60, 55, 67],
    90: [16, 22, 20, 31, 28, 38, 34, 48, 44, 54, 51, 68],
  };
  const factor = period === 7 ? 20 : period === 30 ? 35 : 95;
  return {
    reach: shapes[period].map((v) => v * factor),
    engagement: shapes[period].map(
      (v, i) => Math.round((3.2 + v / 18 + ((i % 3) - 1) * 0.45) * 10) / 10,
    ),
  };
}

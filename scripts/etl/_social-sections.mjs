/**
 * SocialAuto insight transforms — pure helpers consumed by
 * materialize-datalake-snapshots.mjs and unit-tested directly.
 *
 * Input: the insights JSON written to lake/socialauto-insights/<team>.json
 * by SocialAuto's datalake_export task (build_team_insights output), plus
 * lake/socialauto-monetization/gates.json for the gates section.
 *
 * The upstream engine already applies the robust statistics — shrinkage,
 * z-scores, Theil-Sen slopes, Wilson bounds, counter-reset counts — so
 * these transforms surface the honest-confidence fields rather than
 * re-deriving from raw means.
 */

export function socialEngagement(insights) {
	if (!insights?.platforms) return null;
	return Object.entries(insights.platforms)
		.map(([platform, p]) => ({
			platform,
			focus_tier: p.focus_tier ?? null,
			confidence: p.confidence ?? null,
			posts: p.posts ?? 0,
			impressions: p.impressions ?? 0,
			engagement: p.engagement ?? 0,
			avg_er_pct: p.avg_engagement_rate ?? 0,
			// Wilson 95% lower bound — the honest ER floor for small samples
			er_wilson_low_pct: p.avg_engagement_rate_wilson_low ?? null,
			median_er_pct: p.median_engagement_rate ?? 0,
			median_eng_per_post: p.median_engagement_per_post ?? 0,
			// shrunk rates: empirical-Bayes pull toward platform mean so a
			// tiny-sample bucket can't masquerade as a winner
			media_er_shrunk_pct: p.media_avg_er_shrunk ?? null,
			text_er_shrunk_pct: p.text_avg_er_shrunk ?? null,
			er_by_followers_pct: p.er_by_followers_pct ?? null,
			benchmark_verdict:
				p.benchmark?.verdict ??
				(p.er_by_followers_pct == null
					? "below_min_followers_50"
					: "no_benchmark_for_platform"),
			momentum_7d_pct: p.momentum_7d_engagement_pct ?? null,
			// z-scores are the trustable momentum signal — raw % alone
			// over-reads small samples (4→2 is -50% but noise)
			momentum_7d_engagement_z: p.momentum_7d_engagement_z ?? null,
			momentum_7d_impressions_z: p.momentum_7d_impressions_z ?? null,
			momentum_significant:
				Math.abs(p.momentum_7d_engagement_z ?? 0) >= 1.645,
			engagement_7d: p.engagement_7d ?? 0,
			followers: p.follower_growth?.current ?? null,
			follower_net: p.follower_growth?.net ?? null,
			// Theil–Sen slope (median pairwise) — survives bad endpoint scrapes
			follower_slope_per_day: p.follower_growth?.slope_per_day ?? null,
			// learned best windows (null when sample/margin insufficient —
			// dead-night scheduler artifacts are already excluded upstream)
			best_hour_athens: p.best_hour_athens?.[0] ?? null,
			best_weekday_athens: p.best_weekday_athens?.[0] ?? null,
			best_hour_sample: p.best_hour_sample ?? 0,
			counter_resets: p.data_quality?.counter_resets ?? 0,
			data_warnings: (p.data_warnings || []).join("; ") || "none",
		}))
		.sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
}

export function socialOutliers(insights) {
	if (!insights?.platforms) return null;
	const rows = [];
	for (const [platform, p] of Object.entries(insights.platforms)) {
		for (const o of p.outliers || []) {
			rows.push({
				platform,
				post_id: o.post_id ?? null,
				kind: o.kind,
				engagement: o.engagement ?? 0,
				engagement_rate: o.engagement_rate ?? 0,
				platform_median: o.platform_median_engagement ?? null,
			});
		}
		const a = p.follower_growth?.anomaly;
		if (a) {
			rows.push({
				platform,
				post_id: null,
				kind: "follower_anomaly",
				engagement: a.delta,
				engagement_rate: null,
				platform_median: null,
			});
		}
	}
	return rows.sort((a, b) => Math.abs(b.engagement) - Math.abs(a.engagement));
}

export function socialRecommendations(insights) {
	if (!insights?.recommendations) return null;
	return insights.recommendations.map((r) => ({
		type: r.type ?? null,
		priority: r.priority ?? null,
		platform: r.platform ?? null,
		text: String(r.text ?? "").slice(0, 500),
	}));
}

/**
 * Monetization gates — lake/socialauto-monetization/gates.json rows
 * written by SocialAuto's datalake export (one per active account, with
 * per-criterion met/current/target). Gold section feeds the dashboard and
 * the LLM insight prompts, so gate distance is part of the daily picture.
 */
export function socialMonetization(gates) {
	if (!gates?.length) return null;
	return gates.map((g) => {
		const criteria = g.criteria || [];
		return {
			platform: g.platform ?? null,
			handle: g.username ?? g.account_id ?? null,
			account_type: g.account_type ?? null,
			followers: g.followers ?? null,
			// Theil–Sen slope upstream — already robust to bad scrapes
			follower_slope_per_day: g.gain_per_day ?? null,
			program: g.program ?? null,
			// funnel role for accounts without a creator program
			role: g.role ?? null,
			criteria_met: criteria.filter((c) => c.met === true).length,
			criteria_total: criteria.length,
			criteria_unknown: criteria.filter((c) => c.met == null).length,
			evaluated_at: g.evaluated_at ?? null,
			error: g.error ?? null,
		};
	});
}


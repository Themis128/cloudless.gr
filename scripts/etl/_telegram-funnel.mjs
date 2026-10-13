/**
 * Telegram channel funnel aggregation — pure helper consumed by
 * materialize-datalake-snapshots.mjs and unit-tested directly.
 *
 * Inputs are silver JSON rows written by SocialAuto's datalake_export
 * Celery task:
 *   - channels:  lake/socialauto-telegram/channels.json rows
 *     (chat registry + named invite links — URLs stripped upstream)
 *   - events:    lake/socialauto-account-events/events.json rows
 *     (member_joined / member_left / join_request / channel_post,
 *      invite_link_name in meta_data is the source-attribution key)
 *   - followers: lake/socialauto-followers/followers.json rows
 *     (member-count snapshots synced daily from getChatMemberCount)
 *
 * Output rows follow the {metric, value} convention used by the other
 * SocialAuto sections; join-source rows carry an extra `source` field.
 */

const DAY_MS = 86400000;

/** Count events of a type occurring within `days` of `now`. */
function countWithin(events, type, days, now) {
	return events.filter(
		(e) =>
			e.event_type === type &&
			e.occurred_at &&
			now - new Date(e.occurred_at).getTime() <= days * DAY_MS
	);
}

/**
 * @param {Array} channels  telegram channel dimension rows
 * @param {Array} events    socialauto account-events rows
 * @param {Array} followers follower/member snapshot rows
 * @returns {Array|null} section rows, or null when no telegram data exists
 */
export function telegramFunnel(channels, events, followers) {
	const chans = channels || [];
	const evs = (events || []).filter((e) => e.platform === "telegram");
	const foll = (followers || []).filter(
		(f) => f.platform === "telegram" && f.captured_at
	);
	if (!chans.length && !evs.length && !foll.length) return null;

	const now = Date.now();

	// member-count series → latest value + net deltas vs 7d/30d baselines.
	// Zero readings are failed scrapes, not real counts — drop them before
	// any delta or slope math (a 0 would read as a mass exodus).
	const series = [...foll]
		.filter((s) => Number(s.followers) > 0)
		.sort((a, b) => new Date(a.captured_at) - new Date(b.captured_at));
	const atOrBefore = (t) => {
		let v = null;
		for (const s of series) {
			if (new Date(s.captured_at).getTime() <= t) v = s.followers;
		}
		return v;
	};
	const members = series.length ? series[series.length - 1].followers : null;
	const netDelta = (days) => {
		if (members == null) return null;
		const base = atOrBefore(now - days * DAY_MS);
		return base == null ? null : members - base;
	};

	// Theil–Sen slope: median of all pairwise followers/day slopes over the
	// snapshot window. Robust where a net delta isn't — one corrupted scrape
	// at a window edge can't flip the trend sign.
	const theilSenPerDay = () => {
		if (series.length < 2) return null;
		const slopes = [];
		for (let i = 0; i < series.length; i++) {
			for (let j = i + 1; j < series.length; j++) {
				const dt =
					(new Date(series[j].captured_at) - new Date(series[i].captured_at)) /
					DAY_MS;
				if (dt <= 0) continue;
				slopes.push((series[j].followers - series[i].followers) / dt);
			}
		}
		if (!slopes.length) return null;
		slopes.sort((a, b) => a - b);
		const mid = slopes.length >> 1;
		const med =
			slopes.length % 2 ? slopes[mid] : (slopes[mid - 1] + slopes[mid]) / 2;
		return Math.round(med * 100) / 100;
	};

	const joins30 = countWithin(evs, "member_joined", 30, now);
	const leaves30 = countWithin(evs, "member_left", 30, now);
	const posts30 = countWithin(evs, "channel_post", 30, now);
	const joinReqs = evs.filter((e) => e.event_type === "join_request").length;

	const rows = [
		{ metric: "channels_administered", value: chans.length },
		{ metric: "channel_managed", value: chans.some((c) => c.managed) ? 1 : 0 },
		{ metric: "members", value: members },
		{ metric: "member_net_7d", value: netDelta(7) },
		{ metric: "member_net_30d", value: netDelta(30) },
		{ metric: "member_slope_per_day", value: theilSenPerDay() },
		{ metric: "joins_30d", value: joins30.length },
		{ metric: "leaves_30d", value: leaves30.length },
		{
			metric: "churn_30d_pct",
			value: members
				? Math.round((leaves30.length / members) * 1000) / 10
				: null,
		},
		{ metric: "join_requests", value: joinReqs },
		{ metric: "channel_posts_30d", value: posts30.length },
		{
			metric: "joins_per_post_30d",
			value: posts30.length
				? Math.round((joins30.length / posts30.length) * 100) / 100
				: null,
		},
	];

	// join-source attribution — named invite links (ig / threads / website)
	const bySource = new Map();
	for (const j of joins30) {
		const src = j.meta_data?.invite_link_name || "(direct)";
		bySource.set(src, (bySource.get(src) || 0) + 1);
	}
	for (const [source, n] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
		rows.push({ metric: "join_source", source, value: n });
	}

	// channel inventory rows — title + named-link count per chat
	for (const c of chans) {
		rows.push({
			metric: "channel",
			source: c.chat_id,
			value: (c.invite_links || []).length,
			title: c.title || null,
			managed: !!c.managed,
		});
	}
	return rows;
}

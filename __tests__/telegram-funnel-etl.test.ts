/**
 * Unit tests for scripts/etl/_telegram-funnel.mjs — the Telegram channel
 * funnel aggregation consumed by materialize-datalake-snapshots.mjs.
 */
import { describe, expect, it } from "vitest";
import { telegramFunnel } from "../scripts/etl/_telegram-funnel.mjs";

const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString();

const channels = [
	{
		account_id: "a1",
		team_id: "t1",
		chat_id: "-100999",
		title: "Cloudless — Automation HQ",
		type: "channel",
		bot_status: "administrator",
		managed: true,
		invite_links: [
			{ name: "ig", created_at: daysAgo(2) },
			{ name: "threads", created_at: daysAgo(2) },
		],
	},
];

const events = [
	// joins — attributed to named links
	...Array.from({ length: 5 }, () => ({
		platform: "telegram",
		event_type: "member_joined",
		occurred_at: daysAgo(3),
		meta_data: { chat_id: "-100999", invite_link_name: "ig" },
	})),
	...Array.from({ length: 2 }, () => ({
		platform: "telegram",
		event_type: "member_joined",
		occurred_at: daysAgo(10),
		meta_data: { chat_id: "-100999", invite_link_name: "threads" },
	})),
	{ platform: "telegram", event_type: "member_joined", occurred_at: daysAgo(1), meta_data: {} },
	{ platform: "telegram", event_type: "member_left", occurred_at: daysAgo(4), meta_data: {} },
	{ platform: "telegram", event_type: "join_request", occurred_at: daysAgo(2), meta_data: {} },
	// posts
	{ platform: "telegram", event_type: "channel_post", occurred_at: daysAgo(2), meta_data: { kind: "photo" } },
	{ platform: "telegram", event_type: "channel_post", occurred_at: daysAgo(6), meta_data: { kind: "message" } },
	// old join outside the 30d window — must not count
	{ platform: "telegram", event_type: "member_joined", occurred_at: daysAgo(45), meta_data: { invite_link_name: "ig" } },
	// non-telegram noise — must be filtered out
	{ platform: "facebook", event_type: "member_joined", occurred_at: daysAgo(1), meta_data: {} },
];

const followers = [
	{ platform: "telegram", followers: 10, captured_at: daysAgo(35) },
	{ platform: "telegram", followers: 12, captured_at: daysAgo(10) },
	{ platform: "telegram", followers: 14, captured_at: daysAgo(5) },
	{ platform: "telegram", followers: 20, captured_at: daysAgo(0) },
	{ platform: "linkedin", followers: 500, captured_at: daysAgo(0) },
];

const metric = (rows: Array<Record<string, unknown>>, name: string) =>
	rows.find((r) => r.metric === name)?.value;

describe("telegramFunnel", () => {
	it("returns null when no telegram data exists", () => {
		expect(telegramFunnel([], [], [])).toBeNull();
		expect(telegramFunnel(null, null, null)).toBeNull();
		expect(
			telegramFunnel([], [{ platform: "facebook", event_type: "x" }], [])
		).toBeNull();
	});

	it("computes member count and net deltas from snapshots", () => {
		const rows = telegramFunnel(channels, events, followers)!;
		expect(metric(rows, "members")).toBe(20);
		// baseline 7d ago = 12 (latest snapshot ≤7d back is the 10d-old one) → +8
		expect(metric(rows, "member_net_7d")).toBe(8);
		// baseline 30d ago = 10 → +10
		expect(metric(rows, "member_net_30d")).toBe(10);
	});

	it("counts joins/leaves/posts within the 30d window", () => {
		const rows = telegramFunnel(channels, events, followers)!;
		expect(metric(rows, "joins_30d")).toBe(8); // 5 ig + 2 threads + 1 direct
		expect(metric(rows, "leaves_30d")).toBe(1);
		expect(metric(rows, "channel_posts_30d")).toBe(2);
		expect(metric(rows, "join_requests")).toBe(1);
		expect(metric(rows, "joins_per_post_30d")).toBe(4);
		expect(metric(rows, "churn_30d_pct")).toBe(5);
	});

	it("attributes joins to named invite-link sources", () => {
		const rows = telegramFunnel(channels, events, followers)!;
		const sources = rows.filter((r) => r.metric === "join_source");
		const bySource = Object.fromEntries(
			sources.map((r) => [r.source as string, r.value as number])
		);
		expect(bySource.ig).toBe(5);
		expect(bySource.threads).toBe(2);
		expect(bySource["(direct)"]).toBe(1);
		// sorted desc
		expect(sources[0].source).toBe("ig");
	});

	it("lists channel inventory rows with invite-link counts", () => {
		const rows = telegramFunnel(channels, events, followers)!;
		expect(metric(rows, "channels_administered")).toBe(1);
		expect(metric(rows, "channel_managed")).toBe(1);
		const ch = rows.find((r) => r.metric === "channel");
		expect(ch?.title).toBe("Cloudless — Automation HQ");
		expect(ch?.managed).toBe(true);
		expect(ch?.value).toBe(2);
	});

	it("handles events-only input (no dimension/follower tables yet)", () => {
		const rows = telegramFunnel(null, events, null)!;
		expect(metric(rows, "members")).toBeNull();
		expect(metric(rows, "member_net_7d")).toBeNull();
		expect(metric(rows, "joins_30d")).toBe(8);
		expect(metric(rows, "channels_administered")).toBe(0);
	});
});

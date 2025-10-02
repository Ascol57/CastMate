import { defineTrigger } from "castmate-core"
import { t } from "castmate-translation"
import { Range } from "castmate-schema"
import { onChannelAuth } from "./api-harness"
import { ViewerCache } from "./viewer-cache"
import { TwitchViewer, TwitchViewerGroup } from "castmate-plugin-twitch-shared"
import { inTwitchViewerGroup } from "./group"

export function setupRaids() {
	const raid = defineTrigger({
		id: "raid",
		name: t("plugins.twitch.triggers.raid.name"),
		description: t("plugins.twitch.triggers.raid.description"),
		icon: "mdi mdi-parachute",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				raiders: {
					type: Range,
					name: t("plugins.twitch.common.raiders"),
					default: { min: 1 },
					required: true,
				},
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {} },
			},
		},
		context: {
			type: Object,
			properties: {
				raider: { type: TwitchViewer, required: true, default: "27082158" },
				raiders: { type: Number, required: true, default: 15 },
			},
		},
		async handle(config, context) {
			if (!(await inTwitchViewerGroup(context.raider, config.group, context))) {
				return false
			}

			return Range.inRange(config.raiders, context.raiders)
		},
	})

	const raidOut = defineTrigger({
		id: "raidOut",
		name: t("plugins.twitch.triggers.raidOut.name"),
		description: t("plugins.twitch.triggers.raidOut.description"),
		icon: "mdi mdi-parachute",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				raiders: {
					type: Range,
					name: t("plugins.twitch.common.raiders"),
					default: { min: 1 },
					required: true,
				},
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {} },
			},
		},
		context: {
			type: Object,
			properties: {
				raiders: { type: Number, required: true, default: 15 },
				raidedStreamer: { type: TwitchViewer, required: true, default: "27082158" },
			},
		},
		async handle(config, context) {
			if (!(await inTwitchViewerGroup(context.raidedStreamer, config.group, context))) {
				return false
			}

			return Range.inRange(config.raiders, context.raiders)
		},
	})

	onChannelAuth((channel, service) => {
		service.eventsub.onChannelRaidTo(channel.twitchId, async (event) => {
			raid({
				raider: event.raidingBroadcasterId,
				raiders: event.viewers,
			})
		})

		service.eventsub.onChannelRaidFrom(channel.twitchId, (event) => {
			raidOut({
				raiders: event.viewers,
				raidedStreamer: event.raidedBroadcasterId,
			})
		})
	})
}

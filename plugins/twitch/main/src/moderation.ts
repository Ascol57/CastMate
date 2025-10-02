import { defineAction, defineTrigger } from "castmate-core"
import { t } from "castmate-translation"
import { onChannelAuth } from "./api-harness"
import { TwitchAccount } from "./twitch-auth"
import { ViewerCache } from "./viewer-cache"
import { TwitchViewer, TwitchViewerGroup } from "castmate-plugin-twitch-shared"
import { Duration } from "castmate-schema"
import { inTwitchViewerGroup } from "./group"

export function setupModeration() {
	defineAction({
		id: "timeout",
		name: t("plugins.twitch.actions.timeout.name"),
		description: t("plugins.twitch.actions.timeout.description"),
		icon: "mdi mdi-timer-remove-outline",
		config: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, name: t("plugins.twitch.common.viewer"), required: true, template: true },
				duration: { type: Duration, name: t("plugins.twitch.common.duration"), required: true, template: true, default: 15 },
				reason: { type: String, name: t("plugins.twitch.common.reason"), template: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await TwitchAccount.channel.apiClient.moderation.banUser(TwitchAccount.channel.twitchId, {
				user: config.viewer,
				duration: config.duration,
				reason: config.reason ?? "",
			})
		},
	})

	defineAction({
		id: "ban",
		name: t("plugins.twitch.actions.ban.name"),
		description: t("plugins.twitch.actions.ban.description"),
		icon: "mdi mdi-cancel",
		config: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, name: t("plugins.twitch.common.viewer"), required: true, template: true },
				reason: { type: String, name: t("plugins.twitch.common.reason"), template: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await TwitchAccount.channel.apiClient.moderation.banUser(TwitchAccount.channel.twitchId, {
				user: config.viewer,
				reason: config.reason ?? "",
			})
		},
	})

	defineAction({
		id: "unban",
		name: t("plugins.twitch.actions.unban.name"),
		description: t("plugins.twitch.actions.unban.description"),
		icon: "mdi mdi-cancel",
		config: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, name: t("plugins.twitch.common.viewer"), required: true, template: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await TwitchAccount.channel.apiClient.moderation.unbanUser(TwitchAccount.channel.twitchId, config.viewer)
		},
	})

	const ban = defineTrigger({
		id: "ban",
		name: t("plugins.twitch.triggers.ban.name"),
		description: t("plugins.twitch.triggers.ban.description"),
		icon: "mdi mdi-cancel",
		config: {
			type: Object,
			properties: {
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {} },
			},
		},
		context: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, default: "27082158" },
			},
		},
		async handle(config, context, mapping) {
			if (!(await inTwitchViewerGroup(context.viewer, config.group, context))) {
				return false
			}

			return true
		},
	})

	const timedout = defineTrigger({
		id: "timeout",
		name: t("plugins.twitch.triggers.timeout.name"),
		description: t("plugins.twitch.triggers.timeout.description"),
		icon: "mdi mdi-timer-remove-outline",
		config: {
			type: Object,
			properties: {
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {} },
			},
		},
		context: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, default: "27082158" },
			},
		},
		async handle(config, context, mapping) {
			if (!(await inTwitchViewerGroup(context.viewer, config.group, context))) {
				return false
			}

			return true
		},
	})

	onChannelAuth((channel, service) => {
		service.eventsub.onChannelModeratorAdd(channel.twitchId, (event) => {
			ViewerCache.getInstance().setIsMod(event.userId, false)
		})

		service.eventsub.onChannelModeratorRemove(channel.twitchId, (event) => {
			ViewerCache.getInstance().setIsMod(event.userId, false)
		})

		service.eventsub.onChannelBan(channel.twitchId, (event) => {
			if (event.isPermanent) {
				ban({ viewer: event.userId })
			} else {
				timedout({ viewer: event.userId })
			}
		})
	})
}

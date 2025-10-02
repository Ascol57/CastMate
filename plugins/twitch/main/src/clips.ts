import { defineAction } from "castmate-core"
import { t } from "castmate-translation"
import { TwitchAccount } from "./twitch-auth"
import { TwitchAPIService, onChannelAuth } from "./api-harness"

export function setupClips() {
	defineAction({
		id: "createClip",
		name: t("plugins.twitch.actions.createClip.name"),
		description: t("plugins.twitch.actions.createClip.description"),
		icon: "mdi mdi-filmstrip",
		config: {
			type: Object,
			properties: {},
		},
		result: {
			type: Object,
			properties: {
				clipId: { type: String, required: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			const clipId = await TwitchAccount.channel.apiClient.clips.createClip({
				channel: TwitchAccount.channel.twitchId,
				createAfterDelay: true,
			})
			return { clipId }
		},
	})

	defineAction({
		id: "streamMarker",
		name: t("plugins.twitch.actions.streamMarker.name"),
		description: t("plugins.twitch.actions.streamMarker.description"),
		icon: "mdi mdi-map-marker-star",
		config: {
			type: Object,
			properties: {
				markerName: { type: String, name: t("plugins.twitch.actions.streamMarker.config.markerName"), template: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await TwitchAccount.channel.apiClient.streams.createStreamMarker(
				TwitchAccount.channel.twitchId,
				config.markerName
			)
		},
	})
}

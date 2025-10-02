import { defineState, defineTrigger, startPerfTime, usePluginLogger } from "castmate-core"
import { onChannelAuth } from "./api-harness"
import { ViewerCache } from "./viewer-cache"
import { TwitchViewer, TwitchViewerGroup } from "castmate-plugin-twitch-shared"
import { inTwitchViewerGroup } from "./group"
import { TwitchAccount } from "./twitch-auth"
import { t } from "castmate-translation"

export function setupFollows() {
	const logger = usePluginLogger()

	const follow = defineTrigger({
		id: "follow",
		name: t("plugins.twitch.triggers.follow.name"),
		description: t("plugins.twitch.triggers.follow.description"),
		icon: "mdi mdi-heart",
		version: "0.0.1",
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
		async handle(config, context) {
			if (!(await inTwitchViewerGroup(context.viewer, config.group, context))) {
				return false
			}
			return true
		},
	})

	const followers = defineState("followers", {
		type: Number,
		required: true,
		default: 0,
		name: t("plugins.twitch.states.followers"),
	})

	const lastFollower = defineState("lastFollower", {
		type: TwitchViewer,
		name: t("plugins.twitch.states.lastFollower"),
	})

	async function updateFollowCount() {
		const perf = startPerfTime(`Follow Count Update`)

		const followersResp = await TwitchAccount.channel.apiClient.channels.getChannelFollowers(
			TwitchAccount.channel.twitchId
		)
		ViewerCache.getInstance().cacheFollowQuery(followersResp)

		followers.value = followersResp.total

		lastFollower.value = await ViewerCache.getInstance().getResolvedViewer(followersResp.data[0].userId)

		perf.stop(logger)
	}

	onChannelAuth(async (account, service) => {
		service.eventsub.onChannelFollow(account.twitchId, account.twitchId, async (event) => {
			ViewerCache.getInstance().cacheFollowEvent(event)

			lastFollower.value = await ViewerCache.getInstance().getResolvedViewer(event.userId)

			follow({
				viewer: event.userId,
			})

			followers.value += 1
		})

		await updateFollowCount()
	})
}

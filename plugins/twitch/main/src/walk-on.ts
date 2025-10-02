import { defineTrigger, onLoad } from "castmate-core"
import { t } from "castmate-translation"
import { TwitchViewer, TwitchViewerGroup, TwitchViewerUnresolved } from "castmate-plugin-twitch-shared"
import { inTwitchViewerGroup } from "./group"
import { ViewerCache, onViewerSeen } from "./viewer-cache"
import { onChannelAuth, onStreamOnline } from "./api-harness"

export function setupWalkOns() {
	let walkedOnViewers = new Set<TwitchViewerUnresolved>()

	function resetWalkons() {
		walkedOnViewers = new Set()
	}

	const walkon = defineTrigger({
		id: "walkon",
		name: t("plugins.twitch.triggers.walkon.name"),
		icon: "mdi mdi-walk",
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
			if (walkedOnViewers.has(context.viewer)) {
				return false
			}

			return await inTwitchViewerGroup(context.viewer, config.group, context)
		},
	})

	onViewerSeen(async (viewer) => {
		const walkedOn = await walkon({
			viewer,
		})

		if (walkedOn) {
			walkedOnViewers.add(viewer)
		}
	})

	onStreamOnline(() => {
		resetWalkons()
	})
}

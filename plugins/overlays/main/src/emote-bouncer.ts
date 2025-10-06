import { EmoteCache, defineAction } from "castmate-core"
import { OverlayWidget } from "castmate-plugin-overlays-shared"
import { OverlayWebsocketService } from "./websocket-bridge"
import { t } from "castmate-translation"

export function setupEmoteBouncer() {
	defineAction({
		id: "spawnEmotes",
		name: t("plugins.overlays.actions.spawnEmotes.name"),
		description: t("plugins.overlays.actions.spawnEmotes.description"),
		icon: "mdi mdi-emoticon",
		config: {
			type: Object,
			properties: {
				bouncer: {
					type: OverlayWidget,
					required: true,
					name: t("plugins.overlays.common.emoteBouncer"),
					widgetType: { plugin: "overlays", widget: "emote-bounce" },
				},
				message: { type: String, required: true, template: true, name: t("plugins.overlays.common.emoteMessage") },
			},
		},
		async invoke(config, contextData, abortSignal) {
			const parsed = EmoteCache.getInstance().parseMessage(config.message)

			OverlayWebsocketService.getInstance().callOverlayRPC(config.bouncer.widgetId, "spawnEmotes", parsed)
		},
	})
}

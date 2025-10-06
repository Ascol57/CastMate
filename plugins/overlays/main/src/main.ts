import { definePlugin } from "castmate-core"
import { generatedTranslationsFromFiles, registerPluginTranslations, t } from "castmate-translation"

const translationFiles = {
	en: (import.meta.glob('../../lang/en.yml', {
		query: '?raw',
		eager: true
	})["../../lang/en.yml"] as any)?.default,
	fr: (import.meta.glob('../../lang/fr.yml', {
		query: '?raw',
		eager: true
	})["../../lang/fr.yml"] as any)?.default
}

registerPluginTranslations("overlays", generatedTranslationsFromFiles(translationFiles))

import { setupOverlayResources } from "./overlay-resource"
import { setupWebsockets } from "./websocket-bridge"

import { OverlayTextStyle } from "castmate-plugin-overlays-shared"
import { setupEmoteBouncer } from "./emote-bouncer"
import { setupAlerts } from "./alerts"

export default definePlugin(
	{
		id: "overlays",
		name: t("plugins.overlays.plugin.name"),
		description: t("plugins.overlays.plugin.description"),
		color: "#CC63A2",
		icon: "mdi mdi-web",
	},
	() => {
		//Do not remove, forces bundler to init Overlay-Shared module
		OverlayTextStyle

		setupOverlayResources()
		setupAlerts()
		setupWebsockets()
		setupEmoteBouncer()
	}
)

export { OverlayWebsocketService, handleWidgetRPC } from "./websocket-bridge"

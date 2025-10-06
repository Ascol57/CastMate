import { defineAction, defineTrigger, onLoad, onUnload, definePlugin, defineSatellitePlugin } from "castmate-core"
import { setupLights, LightResource, PollingLight } from "./light"
import { setupPlugs, PlugResource, PollingPlug } from "./plug"
import { generatedTranslationsFromFiles, registerPluginTranslations, t } from "castmate-translation"

export { LightResource, PlugResource, PollingLight, PollingPlug }

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

registerPluginTranslations("iot", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "iot",
		name: t("plugins.iot.plugin.name"),
		description: t("plugins.iot.plugin.description"),
		icon: "mdi mdi-lightbulb-on-outline",
		color: "#E2C74D",
	},
	() => {
		//Plugin Intiialization
		setupLights("castmate")
		setupPlugs("castmate")
	}
)

export const satelliteIoTPlugin = defineSatellitePlugin(
	{
		id: "iot",
		name: t("plugins.iot.plugin.name"),
		description: t("plugins.iot.plugin.description"),
		icon: "mdi mdi-lightbulb-on-outline",
		color: "#E2C74D",
	},
	() => {
		//Plugin Intiialization
		setupLights("satellite")
		setupPlugs("satellite")
	}
)

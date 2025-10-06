import { defineAction, defineTrigger, onLoad, onUnload, definePlugin, defineSetting } from "castmate-core"
import { setupLights } from "./resources"
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

registerPluginTranslations("tplink-kasa", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "tplink-kasa",
		name: t("plugins.tplink-kasa.plugin.name"),
		description: t("plugins.tplink-kasa.plugin.description"),
		icon: "iot iot-kasa",
		color: "#7F743F",
	},
	() => {
		const subnetMask = defineSetting("subnetMask", {
			type: String,
			required: true,
			name: t("plugins.tplink-kasa.settings.subnetMask"),
			default: "255.255.255.255",
		})

		setupLights(subnetMask)
	}
)

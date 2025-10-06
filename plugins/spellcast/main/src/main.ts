import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	reactiveRef,
	onCloudPubSubMessage,
} from "castmate-core"
import { TwitchViewer } from "castmate-plugin-twitch-shared"
import { setupSpells, SpellHook } from "./spell"
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

registerPluginTranslations("spellcast", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "spellcast",
		name: t("plugins.spellcast.plugin.name"),
		description: t("plugins.spellcast.plugin.description"),
		icon: "sci sci-spellcast",
		color: "#488EE2",
	},
	() => {
		setupSpells()
	}
)

export { SpellHook }

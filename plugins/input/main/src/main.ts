import { defineAction, defineTrigger, onLoad, onUnload, definePlugin } from "castmate-core"

import { setupKeyboard } from "./keyboard"
import { InputInterface } from "castmate-plugin-input-native"

import { setupMouse } from "./mouse"
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

registerPluginTranslations("input", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "input",
		name: t("plugins.input.plugin.name"),
		description: t("plugins.input.plugin.description"),
		icon: "mdi mdi-keyboard",
		color: "#826262",
	},
	() => {
		const inputInterface = new InputInterface()

		onLoad(() => {
			inputInterface.startEvents()
		})

		onUnload(() => {
			inputInterface.stopEvents()
		})

		setupKeyboard(inputInterface)
		setupMouse(inputInterface)
	}
)

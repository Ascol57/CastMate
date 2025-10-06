import { definePlugin, usePluginLogger } from "castmate-core"
import { setupVariableActions } from "./actions"
import { setupViewerVariables } from "./viewer-variables"

import { registerPluginTranslations, generatedTranslationsFromFiles, t } from "castmate-translation"

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

registerPluginTranslations("variables", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "variables",
		name: t("plugins.variables.plugin.name"),
		description: t("plugins.variables.plugin.description"),
		icon: "mdi mdi-variable",
		color: "#D3934A",
	},
	() => {
		setupVariableActions()
		setupViewerVariables()
	}
)

import { defineAction, defineTrigger, onLoad, onUnload, definePlugin, StreamPlanManager } from "castmate-core"
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

registerPluginTranslations("stream-plans", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "stream-plans",
		name: t("plugins.stream-plans.plugin.name"),
		description: t("plugins.stream-plans.plugin.description"),
		icon: "mdi mdi-notebook",
		color: "#67E033",
	},
	() => {
		defineAction({
			id: "nextSegment",
			name: t("plugins.stream-plans.actions.nextSegment.name"),
			icon: "mdi mdi-skip-next",
			description: t("plugins.stream-plans.actions.nextSegment.description"),
			config: {
				type: Object,
				properties: {},
			},
			async invoke(config, contextData, abortSignal) {
				await StreamPlanManager.getInstance().startNextSegment()
			},
		})

		defineAction({
			id: "prevSegment",
			name: t("plugins.stream-plans.actions.prevSegment.name"),
			icon: "mdi mdi-skip-previous",
			description: t("plugins.stream-plans.actions.prevSegment.description"),
			config: {
				type: Object,
				properties: {},
			},
			async invoke(config, contextData, abortSignal) {
				await StreamPlanManager.getInstance().startPrevSegment()
			},
		})
	}
)

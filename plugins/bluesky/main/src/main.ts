import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	defineResourceSetting,
	definePluginResource,
} from "castmate-core"
import { BlueSkyAccount } from "./bluesky-account"
import { t, registerPluginTranslations, generatedTranslationsFromFiles } from "castmate-translation"
import path from "path"

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

registerPluginTranslations("bluesky", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "bluesky",
		name: t("plugins.bluesky.plugin.name"),
		description: t("plugins.bluesky.plugin.description"),
		color: "#1086FE",
		icon: "bsi bsi-logo",
	},
	() => {
		definePluginResource(BlueSkyAccount)

		defineResourceSetting(BlueSkyAccount, t("plugins.bluesky.settings.BlueSkyAccounts"))

		defineAction({
			id: "post",
			name: t("plugins.bluesky.actions.post.name"),
			description: t("plugins.bluesky.actions.post.description"),
			icon: "bsi bsi-logo",
			config: {
				type: Object,
				properties: {
					account: { type: BlueSkyAccount, name: t("plugins.bluesky.common.account"), required: true },
					text: { type: String, name: t("plugins.bluesky.common.text"), required: true, template: true, multiLine: true },
				},
			},
			async invoke(config, contextData, abortSignal) {
				config.account.agent.post({
					text: config.text,
				})
			},
		})
	}
)

import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	useSetting,
	getSettingValue,
	defineTransformTrigger,
} from "castmate-core"
import { OBSConnection, onOBSWebsocketEvent } from "castmate-plugin-obs-main"
import { Command, getCommandDataSchema, matchAndParseCommand } from "castmate-schema"
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

registerPluginTranslations("advss", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "advss",
		name: t("plugins.advss.plugin.name"),
		description: t("plugins.advss.plugin.description"),
		color: "#256eff",
		icon: "advi advi-advss",
	},
	() => {
		defineAction({
			id: "AdvSSMessage",
			name: t("plugins.advss.actions.AdvSSMessage.name"),
			icon: "advi advi-advss",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.advss.actions.AdvSSMessage.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					message: { type: String, required: true, name: t("plugins.advss.actions.AdvSSMessage.config.message"), template: true },
				},
			},
			async invoke(config, contextData, abortSignal) {
				await config.obs.connection.call("CallVendorRequest", {
					vendorName: "AdvancedSceneSwitcher",
					requestType: "AdvancedSceneSwitcherMessage",
					requestData: {
						message: config.message,
					},
				})
			},
		})

		const advssEvent = defineTransformTrigger({
			id: "advssEvent",
			name: t("plugins.advss.triggers.advssEvent.name"),
			icon: "advi advi-advss",
			config: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.advss.triggers.advssEvent.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					message: { type: Command, required: true, name: t("plugins.advss.triggers.advssEvent.config.message") },
				},
			},
			invokeContext: {
				type: Object,
				properties: {
					obs: {
						type: OBSConnection,
						name: t("plugins.advss.triggers.advssEvent.config.obs"),
						required: true,
						default: () => getSettingValue<OBSConnection>("obs", "obsDefault"),
					},
					message: { type: String, required: true, name: t("plugins.advss.triggers.advssEvent.context.message") },
				},
			},
			async context(config) {
				return {
					type: Object,
					properties: {
						message: { type: String, required: true, default: "Thanks for using CastMate!" },
						...getCommandDataSchema(config.message).properties,
					},
				}
			},
			async handle(config, context, mapping) {
				const matchResult = await matchAndParseCommand(context.message, config.message)

				if (matchResult == null) return undefined

				const finalContext = {
					...context,
					...matchResult,
				}

				return finalContext
			},
		})

		onOBSWebsocketEvent("VendorEvent", (obs, ev) => {
			if (ev.vendorName == "AdvancedSceneSwitcher" && ev.eventType == "AdvancedSceneSwitcherEvent") {
				const message = ev.eventData.message
				if (message == null || typeof message != "string") return

				advssEvent({
					obs,
					message,
				})
			}
		})
	}
)

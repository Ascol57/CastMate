import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	defineFlowAction,
	usePluginLogger,
} from "castmate-core"
import { OverlayWebsocketService, handleWidgetRPC } from "castmate-plugin-overlays-main"
import { OverlayWidget } from "castmate-plugin-overlays-shared"
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

registerPluginTranslations("random", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "random",
		name: t("plugins.random.plugin.name"),
		description: t("plugins.random.plugin.description"),
		icon: "mdi mdi-dice-multiple",
		color: "#EFCC3E",
	},
	() => {
		const logger = usePluginLogger()

		defineFlowAction({
			id: "random",
			name: t("plugins.random.actions.random.name"),
			description: t("plugins.random.actions.random.description"),
			icon: "mdi mdi-dice-multiple",
			config: {
				type: Object,
				properties: {},
			},
			flowConfig: {
				type: Object,
				properties: {
					weight: { type: Number, name: t("plugins.random.common.weight"), required: true, default: 1 },
				},
			},
			async invoke(config, flows, contextData, abortSignal) {
				let weightTotal = 0
				for (const [key, flow] of Object.entries(flows)) {
					weightTotal += flow.weight
				}

				//console.log("Random Weight Total", weightTotal)

				let targetWeight = Math.random() * weightTotal

				//console.log("Random Target Weight", targetWeight)

				for (const [key, flow] of Object.entries(flows)) {
					targetWeight -= flow.weight

					//console.log("   ", targetWeight)

					if (targetWeight <= 0) {
						//console.log("Random", key)
						return key
					}
				}

				return ""
			},
		})

		defineAction({
			id: "spinWheel",
			name: t("plugins.random.actions.spinWheel.name"),
			description: t("plugins.random.actions.spinWheel.description"),
			icon: "mdi mdi-tire",
			config: {
				type: Object,
				properties: {
					widget: {
						type: OverlayWidget,
						required: true,
						name: t("plugins.random.common.wheel"),
						widgetType: { plugin: "random", widget: "wheel" },
					},
					strength: {
						type: Number,
						required: true,
						template: true,
						name: t("plugins.random.common.strength"),
						default: 1,
					},
				},
			},
			async invoke(config, contextData, abortSignal) {
				await OverlayWebsocketService.getInstance().callOverlayRPC(
					config.widget.widgetId,
					"spinWheel",
					config.strength
				)
			},
		})

		const wheelLanded = defineTrigger({
			id: "wheelLanded",
			name: t("plugins.random.triggers.wheelLanded.name"),
			description: t("plugins.random.triggers.wheelLanded.description"),
			config: {
				type: Object,
				properties: {
					wheel: {
						type: OverlayWidget,
						required: true,
						name: t("plugins.random.common.wheel"),
						widgetType: { plugin: "random", widget: "wheel" },
					},
					item: {
						type: String,
						name: t("plugins.random.common.item"),
					},
				},
			},
			context: {
				type: Object,
				properties: {
					wheel: {
						type: OverlayWidget,
						required: true,
						name: t("plugins.random.common.wheel"),
						widgetType: { plugin: "random", widget: "wheel" },
						view: false,
					},
					item: { type: String, required: true, name: t("plugins.random.common.item") },
				},
			},
			async handle(config, context, mapping) {
				if (config.wheel.overlayId != context.wheel.overlayId) return false
				if (config.wheel.widgetId != context.wheel.widgetId) return false

				if (config.item != null) {
					if (context.item != config.item) {
						return false
					}
				}

				return true
			},
		})

		handleWidgetRPC("wheelLanded", (overlay, widgetId, item: string) => {
			logger.log("wheelLanded", widgetId, item)
			wheelLanded({
				wheel: { overlayId: overlay.id, widgetId },
				item,
			})
		})
	}
)

import { defineAction, usePluginLogger, ViewerData } from "castmate-core"
import { TwitchViewer } from "castmate-plugin-twitch-shared"
import { DynamicType } from "castmate-schema"
import { ViewerCache as TwitchViewerCache } from "castmate-plugin-twitch-main"
import { t } from "castmate-translation"

export function setupViewerVariables() {
	const logger = usePluginLogger()

	defineAction({
		id: "setViewerVar",
		name: t("plugins.variables.actions.setViewerVar.name"),
		description: t("plugins.variables.actions.setViewerVar.description"),
		icon: "mdi mdi-account-alert",
		config: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, name: "Viewer", default: "{{ viewer }}", template: true },
				variable: {
					type: String,
					name: t("plugins.variables.common.variable"),
					required: true,
					async enum() {
						return ViewerData.getInstance().variables.map((d) => d.name)
					},
				},
				value: {
					type: DynamicType,
					template: true,
					async dynamicType(context: { variable: string }) {
						const variable = ViewerData.getInstance().getVariable(context.variable)

						if (!variable) {
							return {
								type: String,
								name: t("plugins.variables.common.value"),
								required: true,
							}
						}

						return {
							...variable.schema,
							name: t("plugins.variables.common.value"),
							template: true,
						}
					},
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			const viewerDisp = await TwitchViewerCache.getInstance().getDisplayDataById(config.viewer)

			if (!viewerDisp) throw new Error(`Unable to Resolve Twitch Viewer ${config.viewer}`)

			logger.log("Set viewer var", config.variable, config.value, viewerDisp)

			await ViewerData.getInstance().setViewerValue(
				"twitch",
				config.viewer,
				viewerDisp.displayName,
				config.variable,
				config.value
			)
		},
	})

	defineAction({
		id: "offsetViewerVar",
		name: t("plugins.variables.actions.offsetViewerVar.name"),
		description: t("plugins.variables.actions.offsetViewerVar.description"),
		icon: "mdi mdi-account-alert",
		config: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, name: "Viewer", default: "{{ viewer }}", template: true },
				variable: {
					type: String,
					name: t("plugins.variables.common.variable"),
					required: true,
					async enum() {
						return ViewerData.getInstance()
							.variables.filter((v) => v.schema.type == Number)
							.map((d) => d.name)
					},
				},
				offset: {
					type: DynamicType,
					template: true,
					async dynamicType(context: { variable: string }) {
						const variable = ViewerData.getInstance().getVariable(context.variable)

						if (!variable) {
							return {
								type: String,
								name: t("plugins.variables.common.value"),
								required: true,
							}
						}

						return {
							...variable.schema,
							name: t("plugins.variables.common.value"),
							template: true,
						}
					},
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			const viewerDisp = await TwitchViewerCache.getInstance().getDisplayDataById(config.viewer)

			if (!viewerDisp) throw new Error(`Unable to Resolve Twitch Viewer ${config.viewer}`)

			logger.log("Set viewer var", config.variable, config.offset, viewerDisp)

			await ViewerData.getInstance().offsetViewerValue(
				"twitch",
				config.viewer,
				viewerDisp.displayName,
				config.variable,
				config.offset
			)
		},
	})
}

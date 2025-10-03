import { ReactiveRef, defineAction } from "castmate-core"
import { t } from "castmate-translation"
import { OBSConnection } from "./connection"

export function setupScenes(obsDefault: ReactiveRef<OBSConnection>) {
	defineAction({
		id: "scene",
		name: t("plugins.obs.actions.scene.name"),
		description: t("plugins.obs.actions.scene.description"),
		icon: "mdi mdi-swap-horizontal-bold",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				scene: {
					type: String,
					name: t("plugins.obs.common.scene"),
					required: true,
					//template: true,
					async enum(context: { obs: OBSConnection }) {
						return (await context?.obs?.getSceneAndGroupNames()) ?? []
					},
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (!config.obs) return
			await config.obs.connection.call("SetCurrentProgramScene", { sceneName: config.scene })
		},
	})

	defineAction({
		id: "prevScene",
		name: t("plugins.obs.actions.prev_scene.name"),
		description: t("plugins.obs.actions.prev_scene.description"),
		icon: "mdi mdi-skip-backward",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (!config.obs) return
			await config.obs.popScene()
		},
	})
}

import { ReactiveRef, defineAction } from "castmate-core"
import { OBSConnection } from "./connection"
import { Toggle } from "castmate-schema"
import { t } from "castmate-translation"

export function setupToggles(obsDefault: ReactiveRef<OBSConnection>) {
	defineAction({
		id: "streamStartStop",
		name: t("plugins.obs.actions.toggle_streaming.name"),
		description: t("plugins.obs.actions.toggle_streaming.description"),
		icon: "mdi mdi-broadcast",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnection"),
					required: true,
					default: () => obsDefault.value,
				},
				streaming: {
					type: Toggle,
					name: t("plugins.obs.common.streaming"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-broadcast",
					falseIcon: "mdi mdi-broadcast-off",
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (config.streaming == "toggle") {
				await config.obs.connection.call("ToggleStream")
			} else if (config.streaming === true) {
				await config.obs.connection.call("StartStream")
			} else if (config.streaming === false) {
				await config.obs.connection.call("StopStream")
			}
		},
	})

	defineAction({
		id: "recordingStartStop",
		name: t("plugins.obs.actions.toggle_recording.name"),
		description: t("plugins.obs.actions.toggle_recording.description"),
		icon: "mdi mdi-record",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				recording: {
					type: Toggle,
					name: t("plugins.obs.common.recording"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-record",
					falseIcon: "mdi mdi-stop",
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (config.recording == "toggle") {
				await config.obs.connection.call("ToggleRecord")
			} else if (config.recording === true) {
				await config.obs.connection.call("StartRecord")
			} else if (config.recording === false) {
				await config.obs.connection.call("StopRecord")
			}
		},
	})

	defineAction({
		id: "virtualCamStartStop",
		name: t("plugins.obs.actions.toggle_virtual_cam.name"),
		icon: "mdi mdi-webcam",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				virtualCam: {
					type: Toggle,
					name: t("plugins.obs.common.virtualCam"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-camera",
					falseIcon: "mdi mdi-camera-off",
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (config.virtualCam == "toggle") {
				await config.obs.connection.call("ToggleVirtualCam")
			} else if (config.virtualCam === true) {
				await config.obs.connection.call("StartVirtualCam")
			} else if (config.virtualCam === false) {
				await config.obs.connection.call("StopVirtualCam")
			}
		},
	})

	defineAction({
		id: "replayBufferStartStop",
		name: t("plugins.obs.actions.toggle_replay_buffer.name"),
		description: t("plugins.obs.actions.toggle_replay_buffer.description"),
		icon: "mdi mdi-replay",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				replayBuffer: {
					type: Toggle,
					name: t("plugins.obs.common.replayBuffer"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-record",
					falseIcon: "mdi mdi-stop",
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			if (config.replayBuffer == "toggle") {
				await config.obs.connection.call("ToggleReplayBuffer")
			} else if (config.replayBuffer === true) {
				await config.obs.connection.call("StartReplayBuffer")
			} else if (config.replayBuffer === false) {
				await config.obs.connection.call("StopReplayBuffer")
			}
		},
	})

	defineAction({
		id: "replaySave",
		name: t("plugins.obs.actions.save_replay.name"),
		description: t("plugins.obs.actions.save_replay.description"),
		icon: "mdi mdi-content-save",
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
		result: {
			type: Object,
			properties: {
				replayFile: { type: String, required: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			await config.obs.connection.call("SaveReplayBuffer")

			const { savedReplayPath } = await config.obs.connection.call("GetLastReplayBufferReplay")

			return {
				replayFile: savedReplayPath,
			}
		},
	})

	defineAction({
		id: "toggleStudioMode",
		name: t("plugins.obs.actions.toggle_studio_mode.name"),
		description: t("plugins.obs.actions.toggle_studio_mode.description"),
		icon: "mdi mdi-dock-window",
		config: {
			type: Object,
			properties: {
				obs: {
					type: OBSConnection,
					name: t("plugins.obs.common.obsConnections"),
					required: true,
					default: () => obsDefault.value,
				},
				studioMode: {
					type: Toggle,
					name: t("plugins.obs.common.studioMode"),
					required: true,
					default: true,
					template: true,
					trueIcon: "mdi mdi-dock-window",
					falseIcon: "mdi mdi-rectangle-outline",
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			let studioModeEnabled = config.studioMode

			if (studioModeEnabled == "toggle") {
				studioModeEnabled = !config.obs.state.studioModeEnabled
			}

			await config.obs.connection.call("SetStudioModeEnabled", { studioModeEnabled })
		},
	})

	defineAction({
		id: "triggerStudioModeTransition",
		name: t("plugins.obs.actions.trigger_studio_mode_transition.name"),
		icon: "mdi mdi-transition",
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
			await config.obs.connection.call("TriggerStudioModeTransition")
		},
	})
}

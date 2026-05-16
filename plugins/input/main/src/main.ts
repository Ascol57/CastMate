import { defineAction, defineTrigger, defineSetting, onLoad, onUnload, definePlugin } from "castmate-core"

import { setupKeyboard } from "./keyboard"
import { InputInterface } from "castmate-plugin-input-native"

import { setupMouse } from "./mouse"

export default definePlugin(
	{
		id: "input",
		name: "Input",
		description: "Input!",
		icon: "mdi mdi-keyboard",
		color: "#826262",
	},
	() => {
		// Only register the Linux-input-backend setting on Linux so it doesn't
		// clutter the settings UI on Windows / macOS (where it has no effect).
		// The value still persists across platform-switches because CastMate's
		// settings store keeps unknown keys; a Windows install just won't show
		// it.
		const linuxInputBackend =
			process.platform === "linux"
				? defineSetting("linuxInputBackend", {
						type: String,
						name: "Linux Input Backend",
						description:
							"Which Linux backend should simulate / capture keyboard and mouse events. " +
							"\"auto\" tries X11 (XTest) first and falls back to /dev/uinput if no display " +
							"is reachable. X11 supports global key capture; uinput is required on pure " +
							"Wayland sessions but cannot capture global hotkeys.",
						enum: ["auto", "x11", "uinput"],
						default: "auto",
						required: true,
				  })
				: undefined

		const inputInterface =
			process.platform === "linux"
				? new InputInterface({
						backend: (linuxInputBackend?.value as "auto" | "x11" | "uinput") ?? "auto",
				  })
				: new InputInterface()

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

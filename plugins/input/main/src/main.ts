import { defineAction, defineTrigger, onLoad, onUnload, definePlugin } from "castmate-core"

import { setupKeyboard } from "./keyboard"
import { InputInterface } from "castmate-plugin-input-native"

import { setupMouse } from "./mouse"
import { t } from "castmate-translation"

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

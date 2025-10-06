import { KeyCombo, KeyboardKey, Keys, MirrorKey, UnmirrorKey, VKToKey } from "castmate-plugin-input-shared"
import { abortableSleep, defineAction, defineTrigger, onLoad, onProfilesChanged } from "castmate-core"
import { Duration } from "castmate-schema"
import { InputInterface } from "castmate-plugin-input-native"
import { t } from "castmate-translation"

function isComboPressed(inputInterface: InputInterface, combo: KeyCombo) {
	for (const keyName of combo) {
		const key = Keys[keyName]

		const mirroredName = MirrorKey(keyName)

		//console.log("Checking", keyName, mirroredName)

		if (!inputInterface.isKeyDown(key.windowsVKCode)) {
			if (!mirroredName) return false

			const mirrorKey = Keys[mirroredName]
			if (!mirrorKey) return false

			if (!inputInterface.isKeyDown(mirrorKey.windowsVKCode)) {
				return false
			}
		}
	}

	return true
}

export function setupKeyboard(inputInterface: InputInterface) {
	onLoad(() => { })

	defineAction({
		id: "pressKey",
		name: t("plugins.input.actions.pressKey.name"),
		description: t("plugins.input.actions.pressKey.description"),
		icon: "mdi mdi-keyboard",
		duration: {
			dragType: "length",
			rightSlider: {
				sliderProp: "duration",
			},
		},
		config: {
			type: Object,
			properties: {
				key: { type: KeyboardKey, name: t("plugins.input.common.key"), required: true },
				duration: { type: Duration, name: t("plugins.input.common.duration"), required: true, default: 0.1, template: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			const key = Keys[config.key]
			inputInterface.simulateKeyDown(key.windowsVKCode)

			await abortableSleep(config.duration * 1000, abortSignal)

			inputInterface.simulateKeyUp(key.windowsVKCode)
		},
	})

	const keyboardShortcut = defineTrigger({
		id: "keyboardShortcut",
		name: t("plugins.input.triggers.keyboardShortcut.name"),
		description: t("plugins.input.triggers.keyboardShortcut.description"),
		icon: "mdi mdi-keyboard",
		context: {
			type: Object,
			properties: {
				combo: { type: KeyCombo, name: t("plugins.input.common.combo"), required: true, view: false },
			},
		},
		config: {
			type: Object,
			properties: {
				combo: { type: KeyCombo, name: t("plugins.input.common.combo"), required: true },
			},
		},
		async handle(config, context) {
			return KeyCombo.equals(config.combo, context.combo)
		},
	})

	let activeCombos = new Set<KeyCombo>()

	inputInterface.on("key-pressed", (vkCode) => {
		try {
			let keyName = VKToKey[vkCode]
			//console.log("Pressed", keyName, vkCode.toString(16))
			if (keyName == null) return

			keyName = UnmirrorKey(keyName)

			for (const combo of activeCombos) {
				if (combo.includes(keyName)) {
					//Check the rest of the keys
					if (isComboPressed(inputInterface, combo)) {
						keyboardShortcut({ combo })
					}
				}
			}
		} catch (err) {
			console.error(err)
		}
	})

	onProfilesChanged((activeProfiles, inactiveProfiles) => {
		activeCombos = new Set<KeyCombo>()

		for (const profile of activeProfiles) {
			for (const trigger of profile.iterTriggers(keyboardShortcut)) {
				activeCombos.add(trigger.config.combo)
			}
		}
	})
}

import { Duration, Toggle, Timer, isTimerStarted, offsetTimer, pauseTimer, setTimer, startTimer } from "castmate-schema"
import {
	defineAction,
	defineTrigger,
	onLoad,
	onUnload,
	definePlugin,
	abortableSleep,
	usePluginLogger,
} from "castmate-core"
import { setupTimers } from "./timers"
import { VariableManager } from "castmate-plugin-variables-main"
import { registerPluginTranslations, generatedTranslationsFromFiles, t } from "castmate-translation"

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

registerPluginTranslations("time", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
	{
		id: "time",
		name: t("plugins.time.plugin.name"),
		description: t("plugins.time.plugin.description"),
		icon: "mdi mdi-clock-outline",
		color: "#8DC1C0",
	},
	() => {
		const logger = usePluginLogger()

		defineAction({
			id: "delay",
			name: t("plugins.time.actions.delay.name"),
			description: t("plugins.time.actions.delay.description"),
			icon: "mdi mdi-timer-sand",
			duration: {
				dragType: "length",
				rightSlider: {
					sliderProp: "duration",
				},
			},
			config: {
				duration: { type: Duration, name: t("plugins.time.common.duration"), template: true, required: true, default: 1.0 }, type: Object,
				properties: {

				},
			},
			async invoke(config, contextData, abortSignal) {
				const start = Date.now()
				await abortableSleep(config.duration * 1000, abortSignal)
				const end = Date.now()

				const waited = (end - start) / 1000
				const delta = config.duration - waited
				const absDelta = Math.abs(delta)

				if (absDelta > 0.01) {
					logger.error(
						`Delay Inaccuracy! Waited ${waited}/${config.duration} : ${abortSignal.aborted ? "aborted" : "not aborted"
						}`
					)
				}
			},
		})

		defineAction({
			id: "toggleTimer",
			name: t("plugins.time.actions.toggleTimer.name"),
			description: t("plugins.time.actions.toggleTimer.description"),
			icon: "mdi mdi-timer-outline",
			config: {
				type: Object,
				properties: {
					timer: {
						type: String,
						name: t("plugins.time.common.timer"),
						required: true,
						async enum() {
							return VariableManager.getInstance()
								.variableDefinitions.filter((v) => v.schema.type == Timer)
								.map((v) => v.id)
						},
					},
					on: {
						type: Toggle,
						name: t("plugins.time.toggle"),
						required: true,
						default: true,
						template: true,
						trueIcon: "mdi mdi-timer-play-outline",
						falseIcon: "mdi mdi-timer-pause-outline",
					},
				},
			},
			result: {
				type: Object,
				properties: {
					timerRunning: { type: Boolean, name: t("plugins.time.common.timerRunning"), required: true },
				},
			},
			async invoke(config, contextData, abortSignal) {
				const timer = VariableManager.getInstance().getVariable<Timer>(config.timer)
				if (!timer) {
					logger.error("Missing Timer", config.timer)
					return { timerRunning: false }
				}

				let on = config.on
				if (on == "toggle") {
					on = !isTimerStarted(timer.ref.value)
				}

				if (on) {
					timer.ref.value = startTimer(timer.ref.value)
				} else {
					timer.ref.value = pauseTimer(timer.ref.value)
				}

				return {
					timerRunning: on,
				}
			},
		})

		defineAction({
			id: "setTimer",
			name: t("plugins.time.actions.setTimer.name"),
			description: t("plugins.time.actions.setTimer.description"),
			icon: "mdi mdi-timer-outline",
			config: {
				type: Object,
				properties: {
					timer: {
						type: String,
						required: true,
						name: t("plugins.time.common.timer"),
						async enum() {
							return VariableManager.getInstance()
								.variableDefinitions.filter((v) => v.schema.type == Timer)
								.map((v) => v.id)
						},
					},
					duration: { type: Duration, name: t("plugins.time.common.duration"), template: true, required: true, default: 5 },
				},
			},
			async invoke(config, contextData, abortSignal) {
				const timer = VariableManager.getInstance().getVariable<Timer>(config.timer)
				if (!timer) {
					logger.error("Missing Timer", config.timer)
					return
				}

				timer.ref.value = setTimer(timer.ref.value, config.duration)
			},
		})

		defineAction({
			id: "offsetTimer",
			name: t("plugins.time.actions.offsetTimer.name"),
			description: t("plugins.time.actions.offsetTimer.description"),
			icon: "mdi mdi-timer-plus-outline",
			config: {
				type: Object,
				properties: {
					timer: {
						type: String,
						required: true,
						name: t("plugins.time.common.timer"),
						async enum() {
							return VariableManager.getInstance()
								.variableDefinitions.filter((v) => v.schema.type == Timer)
								.map((v) => v.id)
						},
					},
					duration: { type: Duration, name: t("plugins.time.common.duration"), template: true, required: true, default: 5 },
				},
			},
			async invoke(config, contextData, abortSignal) {
				const timer = VariableManager.getInstance().getVariable<Timer>(config.timer)
				if (!timer) {
					logger.error("Missing Timer", config.timer)
					return
				}

				timer.ref.value = offsetTimer(timer.ref.value, config.duration)
			},
		})

		setupTimers()
	}
)

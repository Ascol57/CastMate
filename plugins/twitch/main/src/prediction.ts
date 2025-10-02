import { defineAction, defineState, defineTrigger } from "castmate-core"
import { onChannelAuth } from "./api-harness"
import { Duration } from "castmate-schema"
import { t } from "castmate-translation"

export function setupPredictions() {
	defineAction({
		id: "createPrediction",
		name: t("plugins.twitch.actions.createPrediction.name"),
		description: t("plugins.twitch.actions.createPrediction.description"),
		icon: "mdi mdi-crystal-ball",
		duration: {
			dragType: "length",
			rightSlider: {
				sliderProp: "duration",
			},
		},
		config: {
			type: Object,
			properties: {
				title: { type: String, name: t("plugins.twitch.common.title"), template: true, required: true, default: "" },
				duration: { type: Duration, name: t("plugins.twitch.common.duration"), template: true, required: true, default: 30 },
				outcomes: {
					type: Array,
					name: t("plugins.twitch.common.choices"),
					items: {
						type: String,
						name: t("plugins.twitch.common.choice"),
						template: true,
					},
					required: true,
				},
			},
		},
		async invoke(config, contextData, abortSignal) { },
	})

	const predictionStarted = defineTrigger({
		id: "predictionStarted",
		name: t("plugins.twitch.triggers.predictionStarted.name"),
		description: t("plugins.twitch.triggers.predictionStarted.description"),
		icon: "mdi mdi-crystal-ball",
		config: {
			type: Object,
			properties: {
				title: { type: String, required: true, name: t("plugins.twitch.common.title"), default: "" },
			},
		},
		context: {
			type: Object,
			properties: {
				title: { type: String, required: true, default: "Test Prediction" },
				outcomes: {
					type: Array,
					items: {
						type: Object,
						properties: {
							title: { type: String, required: true },
							color: { type: String, required: true },
							points: { type: Number, required: true },
						},
					},
					required: true,
					default: [
						{ title: "Item A", color: "BLUE", points: 0 },
						{ title: "Item A", color: "PINK", points: 0 },
					],
				},
			},
		},
		async handle(config, context) {
			return config.title == context.title
		},
	})

	const predictionLocked = defineTrigger({
		id: "predictionLocked",
		name: t("plugins.twitch.triggers.predictionLocked.name"),
		description: t("plugins.twitch.triggers.predictionLocked.description"),
		icon: "mdi mdi-crystal-ball",
		config: {
			type: Object,
			properties: {
				title: { type: String, required: true, name: t("plugins.twitch.common.title"), default: "" },
			},
		},
		context: {
			type: Object,
			properties: {
				title: { type: String, required: true, default: "Test Prediction" },
				total: { type: Number, required: true, default: 100 },
				outcomes: {
					type: Array,
					items: {
						type: Object,
						properties: {
							title: { type: String, required: true },
							color: { type: String, required: true },
							points: { type: Number, required: true },
						},
					},
					default: [
						{ title: "Item A", color: "BLUE", points: 75 },
						{ title: "Item A", color: "PINK", points: 25 },
					],
				},
			},
		},
		async handle(config, context) {
			return config.title == context.title
		},
	})

	const predictionSettled = defineTrigger({
		id: "predictionSettled",
		name: t("plugins.twitch.triggers.predictionSettled.name"),
		description: t("plugins.twitch.triggers.predictionSettled.description"),
		icon: "mdi mdi-crystal-ball",
		config: {
			type: Object,
			properties: {
				title: { type: String, required: true, name: t("plugins.twitch.common.title"), default: "" },
			},
		},
		context: {
			type: Object,
			properties: {
				title: { type: String, required: true, default: "Test Prediction" },
				total: { type: Number, required: true, default: 100 },
				outcomes: {
					type: Array,
					items: {
						type: Object,
						properties: {
							title: { type: String, required: true },
							color: { type: String, required: true },
							points: { type: Number, required: true },
						},
					},
					default: [
						{ title: "Item A", color: "BLUE", points: 75 },
						{ title: "Item A", color: "PINK", points: 25 },
					],
				},
			},
		},
		async handle(config, context) {
			return config.title == context.title
		},
	})

	const predictionTitle = defineState("predictionTitle", {
		type: String,
		name: t("plugins.twitch.states.predictionTitle"),
	})

	const predictionId = defineState("predictionId", {
		type: String,
		name: t("plugins.twitch.states.predictionId"),
	})

	const predictionExists = defineState("predictionExists", {
		type: Boolean,
		required: true,
		default: false,
		name: t("plugins.twitch.states.predictionExists"),
	})

	const predictionTotal = defineState("predictionTotal", {
		type: Number,
		required: true,
		default: 0,
		name: t("plugins.twitch.states.predictionTotal"),
	})

	onChannelAuth((channel, service) => {
		service.eventsub.onChannelPredictionBegin(channel.twitchId, (event) => {
			predictionTitle.value = event.title
			predictionExists.value = true
			predictionId.value = event.id
			predictionTotal.value = 0

			predictionStarted({
				title: event.title,
				outcomes: event.outcomes.map((o) => ({ title: o.title, color: o.color, points: 0 })),
			})
		})

		service.eventsub.onChannelPredictionEnd(channel.twitchId, (event) => {
			predictionTitle.value = undefined
			predictionExists.value = false
			predictionId.value = undefined
			predictionTotal.value = 0

			let total = 0
			for (let o of event.outcomes) {
				total += o.channelPoints
			}

			predictionSettled({
				title: event.title,
				total,
				outcomes: event.outcomes.map((o) => ({ title: o.title, color: o.color, points: o.channelPoints })),
			})
		})

		service.eventsub.onChannelPredictionLock(channel.twitchId, (event) => {
			let total = 0
			for (let o of event.outcomes) {
				total += o.channelPoints
			}

			predictionTotal.value = total

			predictionLocked({
				title: event.title,
				total,
				outcomes: event.outcomes.map((o) => ({ title: o.title, color: o.color, points: o.channelPoints })),
			})
		})

		service.eventsub.onChannelPredictionProgress(channel.twitchId, (event) => {
			let total = 0
			for (let o of event.outcomes) {
				total += o.channelPoints
			}
			predictionTotal.value = total
		})
	})
}

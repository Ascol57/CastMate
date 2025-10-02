import { defineState, defineTrigger, startPerfTime, usePluginLogger } from "castmate-core"
import { Range } from "castmate-schema"
import { onChannelAuth } from "./api-harness"
import { t } from "castmate-translation"

export function setupHypeTrains() {
	const logger = usePluginLogger()

	const hypeTrainStarted = defineTrigger({
		id: "hypeTrainStarted",
		name: t("plugins.twitch.hypeTrainStarted.name"),
		description: t("plugins.twitch.hypeTrainStarted.description"),
		icon: "mdi mdi-train-car-caboose",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {},
		},
		context: {
			type: Object,
			properties: {
				level: { type: Number, required: true, default: 1 },
				progress: { type: Number, required: true, default: 0 },
				goal: { type: Number, required: true, default: 100 },
				total: { type: Number, required: true, default: 0 },
			},
		},
		async handle(config, context) {
			return true
		},
	})

	const hypeTrainLevelUp = defineTrigger({
		id: "hypeTrainLevelUp",
		name: t("plugins.twitch.hypeTrainLevelUp.name"),
		description: t("plugins.twitch.hypeTrainLevelUp.description"),
		icon: "mdi mdi-train-car-caboose",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				level: {
					type: Range,
					name: t("plugins.twitch.common.level"),
					default: { min: 1 },
					required: true,
				},
			},
		},
		context: {
			type: Object,
			properties: {
				level: { type: Number, required: true, default: 2 },
				progress: { type: Number, required: true, default: 50 },
				goal: { type: Number, required: true, default: 100 },
				total: { type: Number, required: true, default: 150 },
			},
		},
		async handle(config, context) {
			return Range.inRange(config.level, context.level)
		},
	})

	const hypeTrainEnded = defineTrigger({
		id: "hypeTrainEnded",
		name: t("plugins.twitch.hypeTrainEnded.name"),
		description: t("plugins.twitch.hypeTrainEnded.description"),
		icon: "mdi mdi-train-car-caboose",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				level: {
					type: Range,
					name: t("plugins.twitch.common.level"),
					default: { min: 1 },
					required: true,
				},
			},
		},
		context: {
			type: Object,
			properties: {
				level: { type: Number, required: true, default: 3 },
				progress: { type: Number, required: true, default: 30 },
				goal: { type: Number, required: true, default: 300 },
				total: { type: Number, required: true, default: 230 },
			},
		},
		async handle(config, context) {
			return Range.inRange(config.level, context.level)
		},
	})

	const hypeTrainLevel = defineState("hypeTrainLevel", {
		type: Number,
		name: t("plugins.twitch.states.hypeTrainLevel"),
		required: true,
		default: 0,
	})
	const hypeTrainProgress = defineState("hypeTrainProgress", {
		type: Number,
		name: t("plugins.twitch.states.hypeTrainProgress"),
		required: true,
		default: 0,
	})
	const hypeTrainGoal = defineState("hypeTrainGoal", {
		type: Number,
		name: t("plugins.twitch.states.hypeTrainGoal"),
		required: true,
		default: 0,
	})
	const hypeTrainTotal = defineState("hypeTrainTotal", {
		type: Number,
		name: t("plugins.twitch.states.hypeTrainTotal"),
		required: true,
		default: 0,
	})
	const hypeTrainExists = defineState("hypeTrainExists", {
		type: Boolean,
		name: t("plugins.twitch.states.hypeTrainExists"),
		required: true,
		default: false,
	})

	onChannelAuth(async (channel, service) => {
		const perf = startPerfTime(`HypeTrains`)

		service.eventsub.onChannelHypeTrainBegin(channel.twitchId, (event) => {
			hypeTrainLevel.value = event.level
			hypeTrainProgress.value = event.progress
			hypeTrainGoal.value = event.goal
			hypeTrainTotal.value = event.total
			hypeTrainExists.value = true

			hypeTrainStarted({
				level: event.level,
				progress: event.progress,
				goal: event.goal,
				total: event.total,
			})
		})

		service.eventsub.onChannelHypeTrainEnd(channel.twitchId, (event) => {
			const progress = hypeTrainProgress.value
			const goal = hypeTrainGoal.value

			hypeTrainLevel.value = 0
			hypeTrainProgress.value = 0
			hypeTrainGoal.value = 0
			hypeTrainTotal.value = 0
			hypeTrainExists.value = false

			hypeTrainEnded({
				level: event.level,
				progress,
				goal,
				total: event.total,
			})
		})

		service.eventsub.onChannelHypeTrainProgress(channel.twitchId, (event) => {
			const levelUp = event.level > hypeTrainLevel.value

			hypeTrainLevel.value = event.level
			hypeTrainProgress.value = event.progress
			hypeTrainGoal.value = event.goal
			hypeTrainTotal.value = event.total

			if (levelUp) {
				hypeTrainLevelUp({
					level: event.level,
					progress: event.progress,
					goal: event.goal,
					total: event.total,
				})
			}
		})

		const hypeTrain = await channel.apiClient.hypeTrain.getHypeTrainEventsForBroadcaster(channel.twitchId)

		const event = hypeTrain.data[0]

		if (event) {
			if (event.expiryDate > new Date()) {
				//Hypetrain is running
				hypeTrainLevel.value = event.level
				hypeTrainTotal.value = event.total
				hypeTrainGoal.value = event.goal
				//hypeTrainProgress.value = event.TWITCH NEEDS TO FIX THIS
				hypeTrainExists.value = true
			}
		}

		perf.stop(logger)
	})
}

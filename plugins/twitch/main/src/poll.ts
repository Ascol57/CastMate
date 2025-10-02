import { defineAction, defineState, defineTrigger } from "castmate-core"
import { t } from "castmate-translation"
import { TwitchAPIService, onChannelAuth } from "./api-harness"
import { TwitchAccount } from "./twitch-auth"
import { abortableSleep, setAbortableTimeout } from "castmate-core/src/util/abort-utils"
import { Duration } from "castmate-schema"
import _maxBy from "lodash/maxBy"

export function setupPolls() {
	const pollId = defineState("pollId", {
		type: String,
		name: t("plugins.twitch.states.pollId"),
	})

	const pollTitle = defineState("pollTitle", {
		type: String,
		name: t("plugins.twitch.states.pollTitle"),
	})

	defineAction({
		id: "createPoll",
		name: t("plugins.twitch.actions.createPoll.name"),
		description: t("plugins.twitch.actions.createPoll.description"),
		icon: "mdi mdi-poll",
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
				choices: {
					type: Array,
					name: t("plugins.twitch.common.choices"),
					items: { type: String, name: t("plugins.twitch.common.choice"), required: true },
					required: true,
					default: [],
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			const poll = await TwitchAccount.channel.apiClient.polls.createPoll(TwitchAccount.channel.twitchId, {
				title: config.title,
				duration: config.duration,
				choices: config.choices,
			})

			await abortableSleep(config.duration, abortSignal, async () => {
				await TwitchAccount.channel.apiClient.polls.endPoll(TwitchAccount.channel.twitchId, poll.id) //TODO: Should abort show the result
			})
		},
	})

	const pollStarted = defineTrigger({
		id: "pollStarted",
		name: t("plugins.twitch.triggers.pollStarted.name"),
		description: t("plugins.twitch.triggers.pollStarted.description"),
		icon: "mdi mdi-poll",
		config: {
			type: Object,
			properties: {
				title: { type: String },
			},
		},
		context: {
			type: Object,
			properties: {
				title: { type: String, required: true, default: "Test Poll" },
				totalVotes: { type: Number, required: true, default: 0 },
				choices: {
					type: Array,
					items: {
						type: Object,
						properties: {
							title: { type: String },
							votes: { type: Number },
							fraction: { type: Number },
						},
					},
					default: [
						{ title: "Item A", votes: 0, fraction: 0 },
						{ title: "Item B", votes: 0, fraction: 0 },
					],
				},
			},
		},
		async handle(config, context) {
			return false
		},
	})

	const pollEnded = defineTrigger({
		id: "pollEnded",
		name: t("plugins.twitch.triggers.pollEnded.name"),
		description: t("plugins.twitch.triggers.pollEnded.description"),
		icon: "mdi mdi-poll",
		config: {
			type: Object,
			properties: {},
		},
		context: {
			type: Object,
			properties: {
				title: { type: String, required: true, default: "Test Poll" },
				totalVotes: { type: Number, required: true, default: 10 },
				winner: {
					type: Object,
					properties: {
						title: { type: String, required: true, default: "Item A" },
						votes: { type: Number, required: true, default: 7 },
						fraction: { type: Number, required: true, default: 0.7 },
					},
				},
				choices: {
					type: Array,
					items: {
						type: Object,
						properties: {
							title: { type: String, required: true },
							votes: { type: Number, required: true },
							fraction: { type: Number, required: true },
						},
					},
					default: [
						{ title: "Item A", votes: 7, fraction: 0.7 },
						{ title: "Item B", votes: 3, fraction: 0.3 },
					],
				},
			},
		},
		async handle(config, context) {
			return false
		},
	})

	onChannelAuth((account, service) => {
		service.eventsub.onChannelPollBegin(account.twitchId, (event) => {
			const totalVotes = 0
			const choices = event.choices.map((c) => ({
				title: c.title,
				votes: 0,
				fraction: 0,
			}))

			pollTitle.value = event.title
			pollId.value = event.id
			pollStarted({
				title: event.title,
				totalVotes,
				choices,
			})
		})

		service.eventsub.onChannelPollEnd(account.twitchId, (event) => {
			pollId.value = undefined

			let totalVotes = 0
			for (const choice of event.choices) {
				totalVotes += choice.totalVotes
			}
			const choices = event.choices.map((c) => ({
				title: c.title,
				votes: c.totalVotes,
				fraction: c.totalVotes / totalVotes,
			}))
			const winner = _maxBy(choices, (r) => r.votes)
			if (!winner) return
			pollEnded({
				title: event.title,
				totalVotes,
				winner,
				choices,
			})
		})

		service.eventsub.onChannelPollProgress(account.twitchId, (event) => { })
	})
}

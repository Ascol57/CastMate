import { ChatClient, ChatMessage, parseEmotePositions } from "@twurple/chat"
import { defineTrigger, defineAction, defineTransformTrigger, usePluginLogger, onLoad, EmoteCache } from "castmate-core"
import { t } from "castmate-translation"
import { TwitchAccount } from "./twitch-auth"
import { TwitchAPIService, onBotAuth, onChannelAuth } from "./api-harness"
import {
	Color,
	Command,
	Range,
	getCommandDataSchema,
	matchAndParseCommand,
	EmoteParsedString,
	Duration,
} from "castmate-schema"
import { ViewerCache } from "./viewer-cache"
import { TwitchViewer, TwitchViewerGroup, testViewer } from "castmate-plugin-twitch-shared"
import { inTwitchViewerGroup } from "./group"
import { OverlayWebsocketService } from "castmate-plugin-overlays-main"
import { HelixChatAnnouncementColor } from "@twurple/api"

function parseEmotesFromMsg(chatMessage: ChatMessage): EmoteParsedString {
	const result: EmoteParsedString = []

	const parsedEmotes = parseEmotePositions(chatMessage.text, chatMessage.emoteOffsets)

	let index = 0
	for (const emote of parsedEmotes) {
		const emoteIndex = emote.position
		if (emoteIndex > index) {
			result.push({
				type: "message",
				message: chatMessage.text.substring(index, emote.position),
			})
		}

		result.push({
			type: "emote",
			emote: {
				id: emote.id,
				provider: "twitch",
				name: emote.name,
				urls: {
					url1x: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/light/1.0`,
					url2x: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/light/2.0`,
					url3x: `https://static-cdn.jtvnw.net/emoticons/v2/${emote.id}/default/light/3.0`,
				},
				aspectRatio: 1,
			},
		})

		index = emote.position + emote.length
	}

	if (index < chatMessage.text.length) {
		result.push({
			type: "message",
			message: chatMessage.text.substring(index),
		})
	}

	return result
}

export function setupChat() {
	const logger = usePluginLogger()

	defineAction({
		id: "chat",
		name: t("plugins.twitch.actions.chat.name"),
		description: t("plugins.twitch.actions.chat.description"),
		icon: "mdi mdi-chat",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				message: { type: String, template: true, required: true, default: "", name: t("plugins.twitch.common.message") },
			},
		},
		async invoke(config, context, abortSignal) {
			await TwitchAPIService.getInstance().chatClient.say(
				TwitchAccount.channel.config.name.toLowerCase(),
				config.message
			)
		},
	})

	const chatCommandCooldownMap = new Map<string, number>()

	const chat = defineTransformTrigger({
		id: "chat",
		name: t("plugins.twitch.triggers.chat.name"),
		description: t("plugins.twitch.triggers.chat.description"),
		icon: "mdi mdi-chat",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				command: {
					type: Command,
					name: t("plugins.twitch.common.command"),
					required: true,
				},
				cooldown: { type: Duration, name: t("plugins.twitch.common.cooldown") },
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {} },
			},
		},
		invokeContext: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, default: "27082158", name: t("plugins.twitch.common.viewer") },
				message: { type: String, required: true, default: t("plugins.twitch.common.messageDefault") },
				messageId: { type: String, required: true, default: "1234", view: false },
			},
		},
		async context(config) {
			return {
				type: Object,
				properties: {
					viewer: { type: TwitchViewer, required: true, default: "27082158" },
					message: { type: String, required: true, default: t("plugins.twitch.common.messageDefault") },
					messageId: { type: String, required: true, default: "1234", view: false },
					...getCommandDataSchema(config.command).properties,
				},
			}
		},
		async handle(config, context, mapping) {
			const matchResult = await matchAndParseCommand(context.message, config.command)

			if (matchResult == null) return undefined

			const finalContext = {
				...context,
				...matchResult,
			}

			if (!(await inTwitchViewerGroup(context.viewer, config.group, finalContext))) {
				return undefined
			}

			if (config.cooldown) {
				const now = Date.now()
				const slug = `${mapping.profileId}.${mapping.triggerId}`
				const lastCommandTime = chatCommandCooldownMap.get(slug)
				if (lastCommandTime != null) {
					if (now - lastCommandTime < config.cooldown * 1000) {
						return undefined
					}
				}
				chatCommandCooldownMap.set(slug, now)
			}

			return finalContext
		},
	})

	const firstTimeChat = defineTrigger({
		id: "firstTimeChat",
		name: t("plugins.twitch.triggers.firstTimeChat.name"),
		description: t("plugins.twitch.triggers.firstTimeChat.description"),
		icon: "mdi mdi-medal",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {},
		},
		context: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, default: "27082158", name: t("plugins.twitch.common.viewer") },
				message: { type: String, required: true, default: t("plugins.twitch.common.messageDefault") },
				messageId: { type: String, required: true, default: "1234", view: false },
			},
		},
		async handle(config, context) {
			return true
		},
	})

	defineAction({
		id: "shoutout",
		name: t("plugins.twitch.actions.shoutout.name"),
		description: t("plugins.twitch.actions.shoutout.description"),
		icon: "mdi mdi-bullhorn",
		config: {
			type: Object,
			properties: {
				streamer: { type: TwitchViewer, name: t("plugins.twitch.common.streamer"), required: true, template: true },
			},
		},
		async invoke(config, contextData, abortSignal) {
			const channel = TwitchAccount.channel
			await channel.apiClient.chat.shoutoutUser(channel.twitchId, config.streamer)
		},
	})

	const shoutoutSent = defineTrigger({
		id: "shoutoutSent",
		name: t("plugins.twitch.triggers.shoutoutSent.name"),
		description: t("plugins.twitch.triggers.shoutoutSent.description"),
		icon: "mdi mdi-chat",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {} },
			},
		},
		context: {
			type: Object,
			properties: {
				viewer: { type: TwitchViewer, required: true, default: "27082158" },
			},
		},
		async handle(config, context) {
			if (!(await inTwitchViewerGroup(context.viewer, config.group, context))) {
				return false
			}

			return true
		},
	})

	defineAction({
		id: "annoucement",
		name: t("plugins.twitch.actions.announcement.name"),
		description: t("plugins.twitch.actions.announcement.description"),
		icon: "mdi mdi-chat-alert",
		config: {
			type: Object,
			properties: {
				message: { type: String, name: t("plugins.twitch.common.message"), required: true, template: true, default: "" },
				color: {
					type: String,
					name: t("plugins.twitch.common.color"),
					required: true,
					default: "primary",
					enum: ["primary", "blue", "green", "orange", "purple"],
				},
			},
		},
		async invoke(config, contextData, abortSignal) {
			await TwitchAccount.bot.apiClient.asUser(TwitchAccount.bot.twitchId, async (ctx) => {
				await ctx.chat.sendAnnouncement(TwitchAccount.channel.twitchId, {
					message: config.message,
					color: config.color as HelixChatAnnouncementColor,
				})
			})
		},
	})

	const bits = defineTrigger({
		id: "bits",
		name: t("plugins.twitch.triggers.bits.name"),
		description: t("plugins.twitch.triggers.bits.description"),
		icon: "twi twi-bits",
		version: "0.0.1",
		config: {
			type: Object,
			properties: {
				bits: { type: Range, name: t("plugins.twitch.common.bits"), required: true, default: {} },
				group: { type: TwitchViewerGroup, name: t("plugins.twitch.common.viewerGroup"), required: true, default: {}, anonymous: true },
			},
		},
		context: {
			type: Object,
			properties: {
				bits: { type: Number, required: true, default: 100 },
				viewer: { type: TwitchViewer, required: true, default: "27082158" },
				message: { type: String, required: true, default: t("plugins.twitch.common.messageDefault") },
			},
		},
		async handle(config, context) {
			if (!(await inTwitchViewerGroup(context.viewer, config.group, context))) {
				return false
			}
			return Range.inRange(config.bits, context.bits)
		},
	})

	onBotAuth((account, service) => {
		service.chatClient.onMessage(async (channel, user, message, msgInfo) => {
			logger.log("ChatMsg", message)
			const context = {
				viewer: msgInfo.userInfo.userId,
				message,
				messageId: msgInfo.id,
			}

			const twitchOnlyEmotes = parseEmotesFromMsg(msgInfo)
			const allEmotes = EmoteCache.getInstance().parseThirdParty(twitchOnlyEmotes)

			OverlayWebsocketService.getInstance().sendOverlayMessage("twitch_message", allEmotes)

			ViewerCache.getInstance().cacheChatUser(msgInfo.userInfo)

			if (msgInfo.isFirst) {
				firstTimeChat(context)
			}

			chat(context)
		})
	})

	onChannelAuth((account, service) => {
		service.eventsub.onChannelShoutoutCreate(account.twitchId, account.twitchId, async (event) => {
			shoutoutSent({
				viewer: event.shoutedOutBroadcasterId,
			})
		})

		service.eventsub.onChannelCheer(account.twitchId, async (event) => {
			ViewerCache.getInstance().cacheCheerEvent(event)

			bits({
				bits: event.bits,
				viewer: event.userId ?? "anonymous",
				message: event.message,
			})
		})
	})
}

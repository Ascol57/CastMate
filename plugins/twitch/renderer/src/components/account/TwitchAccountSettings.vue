<template>
	<div class="flex flex-row mt-3 justify-content-center gap-4">
		<div class="flex flex-column align-items-center gap-1">
			<h3 class="my-0">{{ tSync("plugins.twitch.renderer.twitchAccountSettings.channelAccount") }}</h3>
			<span class="my-0 text-300">{{ tSync("plugins.twitch.renderer.twitchAccountSettings.channelAccountDescription") }}</span>
			<account-widget account-type="TwitchAccount" account-id="channel" />
		</div>
		<div class="flex flex-column align-items-center gap-1">
			<h3 class="my-0">{{ tSync("plugins.twitch.renderer.twitchAccountSettings.botAccount") }}</h3>
			<span class="my-0 text-300">{{ tSync("plugins.twitch.renderer.twitchAccountSettings.botAccountDescription") }}</span>
			<account-widget account-type="TwitchAccount" account-id="bot" />
		</div>
	</div>
</template>

<script setup lang="ts">
import { AccountWidget, tSync } from "castmate-ui-core"

const props = defineProps<{}>()
</script>

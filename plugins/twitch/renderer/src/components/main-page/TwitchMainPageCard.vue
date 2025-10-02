<template>
	<main-page-card>
		<template #header> <i class="mdi mdi-twitch twitch-purple" /> {{ tSync("plugins.twitch.plugin.name") }} </template>
		<div class="flex flex-column flex-grow-1 gap-2">
			<unauthed-twitch-account-error
				account-id="channel"
				:category="tSync('plugins.twitch.common.channel')"
				:auth-message="tSync('plugins.twitch.mainPage.channelAccountDescription')"
			/>
			<unauthed-twitch-account-error
				account-id="bot"
				:category="tSync('plugins.twitch.common.bot')"
				:auth-message="tSync('plugins.twitch.mainPage.botAccountDescription')"
			/>
			<div class="flex flex-row justify-content-center">
				<twitch-stats />
			</div>
			<stream-info-dashboard-card />
		</div>
	</main-page-card>
</template>

<script setup lang="ts">
import { MainPageCard } from "castmate-ui-core"

import UnauthedTwitchAccountError from "./UnauthedTwitchAccountError.vue"
import TwitchStats from "./TwitchStats.vue"
import StreamInfoDashboardCard from "../stream-info/StreamInfoDashboardCard.vue"
import { tSync } from "castmate-ui-core"
</script>

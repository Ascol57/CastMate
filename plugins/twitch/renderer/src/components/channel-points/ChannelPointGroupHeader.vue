<template>
	<li class="header text-center mb-1 pb-2" :style="{ borderBottom: `solid 2px #e6e6e6` }">
		<template v-if="item.config.controllable"> {{ tSync("plugins.twitch.renderer.channelPointGroupHeader.castmateRewards") }} </template>
		<template v-else> {{ tSync("plugins.twitch.renderer.channelPointGroupHeader.otherRewards") }} </template>
	</li>
</template>

<script setup lang="ts">
import { ChannelPointRewardConfig } from "castmate-plugin-twitch-shared"
import { ResourceData } from "castmate-schema"
import { tSync } from "castmate-ui-core"

const props = defineProps<{
	item: ResourceData<ChannelPointRewardConfig>
}>()
</script>

<style scoped>
.header {
	font-weight: 600;
	color: #e6e6e6;
}
</style>

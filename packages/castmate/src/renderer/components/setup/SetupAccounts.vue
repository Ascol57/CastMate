<template>
	<div>
		<h1 class="text-center mb-0">
			<i class="mdi mdi-twitch twitch-purple"></i>{{ tSync('setup.setup_twitch') }} <migration-check-box
				:checked="ready" />
		</h1>
		<p class="m-0 mb-4 text-center">
			{{ tSync('setup.twitch_text_line_1') }}<br />
			<span class="p-text-secondary text-sm">
				{{ tSync('setup.twitch_text_line_2') }}
			</span>
		</p>
		<div class="flex-grow-1 flex flex-row justify-content-center align-items-center gap-4 account-box">
			<div class="flex flex-column align-items-center gap-1">
				<h3 class="my-0">{{ tSync('setup.channel_account') }}</h3>
				<span class="my-0 text-300">{{ tSync('setup.channel_account_description') }}</span>
				<account-widget account-type="TwitchAccount" account-id="channel" />
			</div>
			<div class="flex flex-column align-items-center gap-1">
				<h3 class="my-0">{{ tSync('setup.bot_account') }}</h3>
				<span class="my-0 text-300">{{ tSync('setup.bot_account_description') }}</span>
				<account-widget account-type="TwitchAccount" account-id="bot" />
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { TwitchAccountConfig } from "castmate-plugin-twitch-shared"
import { AccountState, ResourceData } from "castmate-schema"

import { AccountWidget, useResourceArray, useResourceStore, tSync, getCurrentLanguage } from "castmate-ui-core"
import { computed, onMounted, useModel, watch } from "vue"
import MigrationCheckBox from "../migration/MigrationCheckBox.vue"

const resourceStore = useResourceStore()
const twitchAccounts = useResourceArray<ResourceData<TwitchAccountConfig, AccountState>>("TwitchAccount")

const props = defineProps<{
	ready: boolean
}>()

const ready = useModel(props, "ready")

const readyComputed = computed(() => {
	for (const account of twitchAccounts.value) {
		if (!account.state.authenticated) return false
	}
	return true
})

onMounted(() => {
	watch(
		readyComputed,
		() => {
			ready.value = readyComputed.value
		},
		{ immediate: true }
	)
})
</script>

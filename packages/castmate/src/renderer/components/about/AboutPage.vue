<template>
	<scrolling-tab-body>
		<h1>{{ $tSync("about.title") }}</h1>
		<h3>v{{ version }}</h3>

		<p>
			<a href="https://www.castmate.io/" target="_blank"> {{ $tSync("about.home_page") }} </a>
			<br />
			<a href="https://www.github.com/LordTocs/CastMate" target="_blank"> {{ $tSync("about.github") }} </a>
			<br />
			<a href="https://discord.gg/txt4DUzYJM" target="_blank"> {{ $tSync("about.discord") }} </a>
			<br />
			<a href="https://github.com/LordTocs/CastMate/blob/main/LICENSE.md" target="_blank"> {{ $tSync("about.license") }} </a>
		</p>
	</scrolling-tab-body>
</template>

<script setup lang="ts">
import { ScrollingTabBody, useIpcCaller, useIpcMessage } from "castmate-ui-core"
import { onMounted, ref } from "vue"

const version = ref("")

const getVersion = useIpcCaller<() => string>("windowFuncs", "getVersion")

onMounted(async () => {
	version.value = await getVersion()
})
</script>

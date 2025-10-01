<template>
	<div class="pb-2">
		<div style="width: 800px">
			{{ tSync('plugins.obs.renderer.connection_edit.setup_description') }}
			<ol>
				<li class="text-center">
					{{ tSync('plugins.obs.renderer.connection_edit.step_1') }}<br />
					<img src="../../img/WebsocketServerSettings.png" class="mt-1" />
				</li>
				<li class="text-center">
					{{ tSync('plugins.obs.renderer.connection_edit.step_2') }}
					<img src="../../img/EnableWebsocketServer.png" class="mt-1" />
				</li>

				<li class="text-center">
					{{ tSync('plugins.obs.renderer.connection_edit.step_3') }}
					<img src="../../img/ShowConnectInfo.png" class="mt-1" />
				</li>

				<li class="text-center">
					{{ tSync('plugins.obs.renderer.connection_edit.step_4') }}
				</li>
			</ol>
		</div>
		<div class="flex flex-column gap-5">
			<p-float-label variant="on" style="flex: 1">
				<p-input-text v-model="model.name" fluid />
				<label>{{ tSync('plugins.obs.renderer.connection_edit.connection_name') }}</label>
			</p-float-label>
			<div class="flex flex-row gap-1">
				<p-button @click="readQR" :v-tooltip="tSync('plugins.obs.renderer.connection_edit.scan_qr_tooltip')">
					<i class="mdi mdi-qrcode-scan" style="font-size: x-large" />
				</p-button>
				<div class="flex flex-column gap-3 flex-grow-1">
					<div class="flex flex-row gap-1">
						<p-float-label variant="on" style="flex: 1">
							<p-input-text v-model="model.host" fluid />
							<label>{{ tSync('plugins.obs.renderer.connection_edit.ip_address') }}</label>
						</p-float-label>
						<p-float-label variant="on">
							<p-input-number
								v-model="model.port"
								:use-grouping="false"
								:min="0"
								:max="65535"
								:pt="{ pcInputText: { root: 'port-input' } }"
							/>
							<label>{{ tSync('plugins.obs.renderer.connection_edit.port') }}</label>
						</p-float-label>
					</div>
					<p-float-label variant="on">
						<p-password v-model="model.password" toggle-mask fluid :feedback="false" />
						<label>{{ tSync('plugins.obs.renderer.connection_edit.websocket_password') }}</label>
					</p-float-label>
				</div>
				<p-button :severity="testSeverity" :loading="testing" @click="testDetails">
					<template v-if="testSuccess == null"> {{ tSync('plugins.obs.renderer.connection_edit.test') }} </template>
					<template v-else-if="testSuccess"> <i class="mdi mdi-check-bold" /> </template>
					<template v-else> <i class="mdi mdi-close-thick" /> </template>
				</p-button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { computed, ref, useModel } from "vue"
import { OBSConnectionConfig } from "castmate-plugin-obs-shared"

import PFloatLabel from "primevue/floatlabel"
import PInputText from "primevue/inputtext"
import PInputNumber from "primevue/inputnumber"
import PPassword from "primevue/password"
import PButton from "primevue/button"
import { useIpcCaller, tSync } from "castmate-ui-core"

const props = defineProps<{
	modelValue: OBSConnectionConfig
	resourceId: string
	resourceType: string
}>()

const model = useModel(props, "modelValue")

interface OBSConnectDetails {
	host: string
	port: number
	password: string
}

const attemptQRReading = useIpcCaller<() => OBSConnectDetails | undefined>("obs", "attemptQRReading")
const testOBSConnectionDetails = useIpcCaller<
	(hostname: string, port: number, password: string | undefined) => boolean
>("obs", "testOBSConnectionDetails")

async function readQR() {
	console.log("READ QR")
	const result = await attemptQRReading()
	console.log("QR READ", result)

	if (result) {
		model.value.host = result.host
		model.value.port = result.port
		model.value.password = result.password
	}
}

const testSuccess = ref<boolean>()
const testSeverity = computed(() => {
	if (testSuccess.value == null) return undefined
	if (testSuccess.value) return "success"
	return "danger"
})
const testing = ref(false)

async function testDetails() {
	testing.value = true
	testSuccess.value = await testOBSConnectionDetails(model.value.host, model.value.port, model.value.password)
	testing.value = false
}
</script>

<style scoped>
:deep(.port-input) {
	width: 100px;
}

.code-like {
	font-family: monospace;
	border: solid 1px var(--surface-border);
	border-radius: var(--border-radius);
	padding: 0.2rem 0.5rem;
}
</style>

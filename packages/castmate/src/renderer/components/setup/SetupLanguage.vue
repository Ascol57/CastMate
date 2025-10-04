<template>
    <div class="flex justify-content-center align-items-center h-full">
        <div class="flex flex-column align-items-center gap-1">
            <h3 class="my-0">Welcome to Castmate! Please select your preferred language:</h3>
            <c-dropdown v-model="selectedLanguage" :options="availableLanguages" :label="label" local-path="language"
                option-value="code" option-label="name" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useModel, watch } from "vue"
import { CDropdown, getCurrentLanguage, setCurrentLanguage, tSync } from "castmate-ui-core"

const props = defineProps<{
    ready: boolean
}>()

const ready = useModel(props, "ready")
const selectedLanguage = ref<string>()
const availableLanguages = ref<Array<{ code: string; name: string }>>([])

const language = {
    en: "English",
    fr: "Français",
    de: "Deutsch",
    es: "Español",
    it: "Italiano",
    ja: "日本語",
    ko: "한국어",
    pt: "Português",
    ru: "Русский",
    zh: "中文",
}

onMounted(async () => {
    try {
        const langs = ['en', 'fr'] // Replace with actual import from castmate-translation
        availableLanguages.value = langs.map(lang => ({ code: lang, name: language[lang as keyof typeof language] || lang }))
        ready.value = true
        selectedLanguage.value = getCurrentLanguage()
    } catch (error) {
        console.error("Failed to load available languages:", error)
        ready.value = false
    }
})

const label = computed(() => {
    return tSync("system.language")
})

// Appelle setCurrentLanguage uniquement après l'initialisation
let firstRun = true
watch(selectedLanguage, (val) => {
    if (firstRun) {
        firstRun = false
        return
    }
    if (val) setCurrentLanguage(val)
})
</script>

<style scoped></style>
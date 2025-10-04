import { useIpcCaller } from "./electron"
import { ref, reactive } from "vue"

interface GeneratedTranslations {
    [language: string]: { [key: string]: any }
}

class TranslationUIService {
    private static instance: TranslationUIService | null = null
    private currentLanguage = ref<string>('en')
    private availableLanguages = ref<string[]>([])
    private translations = reactive<GeneratedTranslations>({})
    private initialized = ref<boolean>(false)

    private getTranslationIPC = useIpcCaller<(key: string) => string>("translation", "getTranslation")
    private setLanguageIPC = useIpcCaller<(language: string) => boolean>("translation", "setLanguage")
    private getAvailableLanguagesIPC = useIpcCaller<() => string[]>("translation", "getAvailableLanguages")
    private getCurrentLanguageIPC = useIpcCaller<() => string>("translation", "getCurrentLanguage")
    private getAllTranslationsIPC = useIpcCaller<() => GeneratedTranslations>("translation", "getAllTranslations")
    private initializeIPC = useIpcCaller<() => boolean>("translation", "initialize")
    private registerPluginTranslationsIPC = useIpcCaller<(pluginId: string, translations: GeneratedTranslations) => boolean>("translation", "registerPluginTranslations")
    private refreshLanguageIPC = useIpcCaller<() => boolean>("translation", "refreshLanguage")

    private constructor() { }

    static getInstance(): TranslationUIService {
        if (!TranslationUIService.instance) {
            TranslationUIService.instance = new TranslationUIService()
        }
        return TranslationUIService.instance
    }

    async initialize() {
        if (this.initialized.value) {
            return
        }

        try {
            // Initialize the main process translation service
            await this.initializeIPC()

            // Load current state
            this.currentLanguage.value = await this.getCurrentLanguageIPC()
            this.availableLanguages.value = await this.getAvailableLanguagesIPC()

            // Load all translations for local caching
            const allTranslations = await this.getAllTranslationsIPC()
            Object.assign(this.translations, allTranslations)

            this.initialized.value = true
        } catch (error) {
            console.error("Failed to initialize translation UI service:", error)
        }
    }

    async t(key: string): Promise<string> {
        if (!this.initialized.value) {
            await this.initialize()
        }

        try {
            return await this.getTranslationIPC(key)
        } catch (error) {
            console.error("Failed to get translation for key:", key, error)
            return key
        }
    }

    // Synchronous version using cached translations
    tSync(key: string): string {
        if (!this.initialized.value) {
            return key
        }

        // Split the key by dots to navigate nested structure
        const keyParts = key.split('.')

        // Try current language first
        let translation = this.getNestedTranslation(this.translations[this.currentLanguage.value], keyParts)

        if (translation && typeof translation === 'string') {
            return translation
        }

        // Fallback to "en" if translation not found in current language
        const fallbackTranslation = this.getNestedTranslation(this.translations['en'], keyParts)

        const result = (fallbackTranslation && typeof fallbackTranslation === 'string') ? fallbackTranslation : key
        return result
    }

    private getNestedTranslation(translationObj: any, keyParts: string[]): any {
        if (!translationObj) return undefined

        let current = translationObj
        for (const part of keyParts) {
            if (current && typeof current === 'object' && part in current) {
                current = current[part]
            } else {
                return undefined
            }
        }
        return current
    }

    async setLanguage(language: string) {
        try {
            await this.setLanguageIPC(language)
            this.currentLanguage.value = language

            // Refresh translations after language change
            const allTranslations = await this.getAllTranslationsIPC()
            Object.assign(this.translations, allTranslations)
        } catch (error) {
            console.error("Failed to set language:", language, error)
        }
    }

    getCurrentLanguage(): string {
        return this.currentLanguage.value
    }

    getAvailableLanguages(): string[] {
        return this.availableLanguages.value
    }

    getTranslations(): GeneratedTranslations {
        return this.translations
    }

    isInitialized(): boolean {
        return this.initialized.value
    }

    // Public method to refresh language
    refreshLanguage() {
        this.refreshLanguageIPC()
    }
}

// Export the singleton instance
const TranslationUIServiceInstance = TranslationUIService.getInstance()

// Convenience function for quick access to translation (async version)
export async function t(key: string): Promise<string> {
    return await TranslationUIServiceInstance.t(key)
}

// Convenience function for quick access to translation (sync version using cache)
export function tSync(key: string): string {
    return TranslationUIServiceInstance.tSync(key)
}

export function getCurrentLanguage(): string {
    return TranslationUIServiceInstance.getCurrentLanguage()
}

export function setCurrentLanguage(language: string) {
    return TranslationUIServiceInstance.setLanguage(language)
}

export function refreshLanguage() {
    TranslationUIServiceInstance.refreshLanguage()
}

// Initialize the service when imported
TranslationUIServiceInstance.initialize()
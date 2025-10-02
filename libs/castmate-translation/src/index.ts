import { usePluginLogger, defineIPCFunc } from "castmate-core"
import * as yaml from 'yaml'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ============================================================================
// Types and Interfaces
// ============================================================================

interface TranslationObject {
    [key: string]: any
}

interface GeneratedTranslations {
    [language: string]: TranslationObject
}

// ============================================================================
// Constants and Logger
// ============================================================================

const logger = usePluginLogger("translation")

// Import all YAML files using Vite's glob import
const translationFiles = import.meta.glob('../lang/**/*.{yml,yaml}', {
    query: '?raw',
    eager: true
})

// ============================================================================
// Core Translation Functions
// ============================================================================

export function generatedTranslationsFromFiles(filesContent: Object): GeneratedTranslations {
    console.log(filesContent)
    const result: GeneratedTranslations = {}

    // files content exemple: { 'en': 'content in yml...', 'fr': 'content in yml...' }

    // Process each file from the filesContent parameter
    for (const [lang, fileContent] of Object.entries(filesContent)) {
        try {
            // Parse the YAML content for this language
            result[lang] = yaml.parse(fileContent as string)
        } catch (error) {
            logger.error(`Error parsing YAML content for language ${lang}:`, error)
        }
    }

    return result
}

/**
 * Generate core translations from YAML files
 */
function generateCoreTranslations(): GeneratedTranslations {
    const result: GeneratedTranslations = {}

    // Process each imported file
    for (const [filePath, fileContent] of Object.entries(translationFiles)) {
        // Extract language and filename from path
        // Example: ../lang/en/setup.yml -> lang: 'en', filename: 'setup'
        const pathMatch = filePath.match(/\.\/lang\/([^\/]+)\/([^\/]+)\.(yml|yaml)$/)
        if (!pathMatch) {
            logger.error(`Unexpected file path format: ${filePath}`)
            continue
        }

        const [, lang, fileName] = pathMatch

        // Extract the actual content - it might be in a 'default' property
        const content = (fileContent as any)?.default || fileContent as string

        // Initialize language object if it doesn't exist
        if (!result[lang]) {
            result[lang] = {}
        }

        try {
            const parsedYaml = yaml.parse(content)
            result[lang][fileName] = parsedYaml
        } catch (error) {
            logger.error(`Error parsing YAML file ${filePath}:`, error)
            logger.error(`Content type: ${typeof content}, Content:`, content)
        }
    }

    return result
}

/**
 * Merge two translation objects deeply
 */
function mergeTranslations(target: GeneratedTranslations, source: GeneratedTranslations): GeneratedTranslations {
    const result = { ...target }

    for (const [lang, translations] of Object.entries(source)) {
        if (!result[lang]) {
            result[lang] = {}
        }

        // Deep merge the translations for this language
        result[lang] = { ...result[lang], ...translations }
    }

    return result
}

// ============================================================================
// Translation Service Implementation
// ============================================================================

class TranslationServiceImpl {
    private static instance: TranslationServiceImpl | null = null
    private translations: GeneratedTranslations = {}
    private currentLanguage: string = 'fr'
    private initialized: boolean = false
    private logger = usePluginLogger("translation")

    private constructor() { }

    static getInstance(): TranslationServiceImpl {
        if (!TranslationServiceImpl.instance) {
            TranslationServiceImpl.instance = new TranslationServiceImpl()
        }
        return TranslationServiceImpl.instance
    }

    async initialize() {
        if (this.initialized) {
            return
        }

        // Load and merge core translations
        const coreTranslations = generateCoreTranslations()
        this.translations = mergeTranslations(this.translations, coreTranslations)

        this.initialized = true
        this.logger.log('Translation service initialized with all plugin translations')
    }

    /**
     * Initialize synchronously with only core translations
     */
    initializeSync() {
        if (this.initialized) {
            return
        }

        const coreTranslations = generateCoreTranslations()
        this.translations = mergeTranslations(this.translations, coreTranslations)
        this.initialized = true
        logger.log('Translation service initialized synchronously (core only)')
    }

    /**
     * Initialize the translation service asynchronously with plugin support
     */
    async initializeAsync() {
        if (this.initialized) {
            return
        }

        await this.initialize()
    }

    /**
     * Register plugin translations
     * @param pluginId Plugin identifier
     * @param translations Translations object with language codes as keys
     */
    registerPluginTranslations(pluginId: string, translations: GeneratedTranslations) {
        logger.log(`Registering translations for plugin: ${pluginId}`)

        // Ensure the service is initialized before registering plugins
        if (!this.initialized) {
            logger.log("Translation service not initialized, initializing synchronously before registering plugin...")
            this.initializeSync()
        }

        // Merge plugin translations into the main structure
        for (const [lang, langTranslations] of Object.entries(translations)) {
            // Ensure the language object exists
            if (!this.translations[lang]) {
                this.translations[lang] = {}
            }

            // Ensure the plugins sub-object exists
            if (!this.translations[lang].plugins) {
                this.translations[lang].plugins = {}
            }

            // Now safely assign the plugin translations
            this.translations[lang].plugins[pluginId] = langTranslations
        }

        logger.log(`Plugin translations registered for ${pluginId}`)
        // Debug output - safely check if the structure exists
        if (this.translations.en?.plugins?.[pluginId]) {
            console.log(`Registered translations for ${pluginId}:`, this.translations.en.plugins[pluginId])
        }
    }

    t(key: string): string {
        if (!this.initialized) {
            logger.log("Translation Service not initialized, initializing synchronously...")
            // Pour l'instant, on initialise seulement les traductions du core
            const coreTranslations = generateCoreTranslations()
            this.translations = mergeTranslations(this.translations, coreTranslations)
            this.initialized = true
            logger.log("Plugin translations not loaded in synchronous initialization. Call initializeAsync() first.")
        }

        logger.log(`Looking for translation key: "${key}"`)
        logger.log(`Current language: ${this.currentLanguage}`)

        // Split the key by dots to navigate nested structure
        const keyParts = key.split('.')
        logger.log(`Key parts:`, keyParts)

        // Try current language first - check both core and plugin translations
        let translation = this.getNestedTranslation(this.translations[this.currentLanguage], keyParts)

        logger.log(`Found translation in current language:`, translation)
        if (translation && typeof translation === 'string') {
            return translation
        }

        // Fallback to "en" if translation not found in current language
        let fallbackTranslation = this.getNestedTranslation(this.translations['en'], keyParts)

        logger.log(`Fallback translation in 'en':`, fallbackTranslation)
        return (fallbackTranslation && typeof fallbackTranslation === 'string') ? fallbackTranslation : key
    }

    private getNestedTranslation(translationObj: TranslationObject | undefined, keyParts: string[]): any {
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

    setLanguage(language: string) {
        this.currentLanguage = language
    }

    getAvailableLanguages(): string[] {
        return Object.keys(this.translations)
    }

    getCurrentLanguage(): string {
        return this.currentLanguage
    }

    getAllTranslations(): GeneratedTranslations {
        // Merge core and plugin translations
        const merged: GeneratedTranslations = {}

        for (const lang of Object.keys(this.translations)) {
            merged[lang] = {
                ...this.translations[lang]
            }
        }

        return merged
    }
}

// Export the singleton instance for main process usage
export const TranslationService = TranslationServiceImpl.getInstance()

// Setup IPC functions for translation service
defineIPCFunc("translation", "getTranslation", (key: string) => {
    return TranslationService.t(key)
})

defineIPCFunc("translation", "setLanguage", (language: string) => {
    TranslationService.setLanguage(language)
    return true
})

defineIPCFunc("translation", "getAvailableLanguages", () => {
    return TranslationService.getAvailableLanguages()
})

defineIPCFunc("translation", "getCurrentLanguage", () => {
    return TranslationService.getCurrentLanguage()
})

defineIPCFunc("translation", "getAllTranslations", () => {
    return TranslationService.getAllTranslations()
})

defineIPCFunc("translation", "initialize", () => {
    // Use the synchronous method
    TranslationService.initializeSync()
    return true
})

defineIPCFunc("translation", "initializeAsync", async () => {
    await TranslationService.initializeAsync()
    return true
})

defineIPCFunc("translation", "registerPluginTranslations", (pluginId: string, translations: GeneratedTranslations) => {
    TranslationService.registerPluginTranslations(pluginId, translations)
    return true
})

export function registerPluginTranslations(pluginId: string, translations: GeneratedTranslations) {
    TranslationService.registerPluginTranslations(pluginId, translations)
}

// Convenience function for quick access to translation
export function t(key: string): string {
    return TranslationService.t(key)
}

export function tSync(key: string): string {
    if (!TranslationService['initialized']) {
        logger.log("Translation Service not initialized, initializing synchronously...")
        TranslationService.initializeSync()
        logger.log("Plugin translations not loaded in synchronous initialization. Call initializeAsync() first.")
    }

    return TranslationService.t(key)
}

// Initialize translation service with plugin support
export async function initializeTranslationService(): Promise<void> {
    await TranslationService.initializeAsync()
}
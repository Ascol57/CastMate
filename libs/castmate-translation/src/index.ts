import { usePluginLogger, defineIPCFunc, defineSetting, getSettingValue, setSettingValue } from "castmate-core"
import * as yaml from 'yaml'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { BrowserWindow } from 'electron'

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
// Utility Functions
// ============================================================================

/**
 * Get the user's preferred language from the system
 */
function getSystemLanguage(): string {
    try {
        // Use Intl API as fallback (works on all platforms)
        const intlLang = Intl.DateTimeFormat().resolvedOptions().locale
        if (intlLang) {
            // Extract language code (e.g., "en-US" -> "en")
            return intlLang.split('-')[0].toLowerCase()
        }

        // Default fallback
        return 'en'
    } catch (error) {
        logger.error('Error detecting system language:', error)
        return 'en'
    }
}

// ============================================================================
// Core Translation Functions
// ============================================================================

export function generatedTranslationsFromFiles(filesContent: Object): GeneratedTranslations {
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
    private currentLanguage: string = "en"
    private initialized: boolean = false
    private logger = usePluginLogger("translation")

    private constructor() {
        try {
            // Try to detect and set system language at initialization
            const systemLang = getSystemLanguage()
            this.currentLanguage = systemLang
            this.logger.log(`System language detected and set: ${this.currentLanguage}`)
        } catch (error) {
            this.logger.error("Error detecting system language in constructor:", error)
            this.currentLanguage = "en"
            this.logger.log("Fallback to 'en' due to error")
        }
    }

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

        try {
            // Load and merge core translations
            const coreTranslations = generateCoreTranslations()
            this.translations = mergeTranslations(this.translations, coreTranslations)

            // Validate and adjust current language based on available translations
            this.validateAndSetLanguage()

            this.initialized = true
            this.logger.log('Translation service initialized with all plugin translations')
        } catch (error) {
            this.logger.error('Error during translation service initialization:', error)
            // Set minimal state to prevent further errors
            this.translations = { en: {} }
            this.currentLanguage = 'en'
            this.initialized = true
            this.logger.log('Translation service initialized with minimal fallback state')
        }
    }

    /**
     * Validate that the current language is available in translations
     * If not available, fallback to 'en' or the first available language
     */
    private validateAndSetLanguage() {
        const availableLanguages = Object.keys(this.translations)

        if (availableLanguages.length === 0) {
            this.logger.log('No translations available, keeping current language setting')
            return
        }

        // Check if current language is available
        if (availableLanguages.includes(this.currentLanguage)) {
            this.logger.log(`Current language '${this.currentLanguage}' is available`)
            return
        }

        // Fallback to 'en' if available
        if (availableLanguages.includes('en')) {
            this.logger.log(`Current language '${this.currentLanguage}' not available, falling back to 'en'`)
            this.currentLanguage = 'en'
            return
        }

        // Fallback to first available language
        const firstLang = availableLanguages[0]
        this.logger.log(`Neither '${this.currentLanguage}' nor 'en' available, falling back to '${firstLang}'`)
        this.currentLanguage = firstLang
    }

    /**
     * Initialize synchronously with only core translations
     */
    initializeSync() {
        if (this.initialized) {
            return
        }

        try {
            const coreTranslations = generateCoreTranslations()
            this.translations = mergeTranslations(this.translations, coreTranslations)

            // Validate and adjust current language based on available translations
            this.validateAndSetLanguage()

            this.initialized = true
            logger.log('Translation service initialized synchronously (core only)')
        } catch (error) {
            logger.error('Error during synchronous translation service initialization:', error)
            // Set minimal state to prevent further errors
            this.translations = { en: {} }
            this.currentLanguage = 'en'
            this.initialized = true
            logger.log('Translation service initialized synchronously with minimal fallback state')
        }
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
        try {
            logger.log(`Registering translations for plugin: ${pluginId}`)

            // Ensure the service is initialized before registering plugins
            if (!this.initialized) {
                logger.log("Translation service not initialized, initializing synchronously before registering plugin...")
                this.initializeSync()
            }

            // Validate input parameters
            if (!pluginId || typeof pluginId !== 'string') {
                logger.error('Invalid pluginId provided to registerPluginTranslations')
                return
            }

            if (!translations || typeof translations !== 'object') {
                logger.error('Invalid translations object provided to registerPluginTranslations')
                return
            }

            // Merge plugin translations into the main structure
            for (const [lang, langTranslations] of Object.entries(translations)) {
                if (!lang || typeof langTranslations !== 'object') {
                    logger.error(`Invalid language entry for plugin ${pluginId}: ${lang}`)
                    continue
                }

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
        } catch (error) {
            logger.error(`Error registering plugin translations for ${pluginId}:`, error)
        }
    }

    t(key: string): string {
        try {
            if (!key || typeof key !== 'string') {
                logger.error('Invalid translation key provided:', key)
                return String(key) || 'INVALID_KEY'
            }

            if (!this.initialized) {
                logger.log("Translation Service not initialized, initializing synchronously...")
                this.initializeSync()
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

        } catch (error) {
            logger.error(`Error in translation lookup for key "${key}":`, error)
            return key // Return the key as fallback
        }
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
        setSettingValue("castmate", "language", language)
    }

    getAvailableLanguages(): string[] {
        return Object.keys(this.translations)
    }

    getCurrentLanguage(): string {
        return this.currentLanguage
    }

    getSystemLanguage(): string {
        return getSystemLanguage()
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

    // setSettingsValue("castmate", "language", language)

    // Rafraîchir la fenêtre pour appliquer le changement de langue (équivalent à Ctrl+R)
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
        windows.forEach(win => {
            win.webContents.reload()
        })
    }

    return true
})

defineIPCFunc("translation", "getAvailableLanguages", () => {
    return TranslationService.getAvailableLanguages()
})

defineIPCFunc("translation", "getCurrentLanguage", () => {
    return TranslationService.getCurrentLanguage()
})

defineIPCFunc("translation", "getSystemLanguage", () => {
    return TranslationService.getSystemLanguage()
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

// Export system language detection function
export function detectSystemLanguage(): string {
    return getSystemLanguage()
}

function refreshLanguage(): void {
    logger.log("Refreshing language to:", getSettingValue("castmate", "language") || "en")
    TranslationService.setLanguage(getSettingValue("castmate", "language") || "en")

    // Rafraîchir la fenêtre pour appliquer le changement de langue (équivalent à Ctrl+R)
    const windows = BrowserWindow.getAllWindows()
    if (windows.length > 0) {
        windows.forEach(win => {
            win.webContents.reload()
        })
    }
}

defineIPCFunc("translation", "refreshLanguage", () => {
    refreshLanguage()
    return true
})

export { refreshLanguage }
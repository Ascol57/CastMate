# CastMate Plugin Translation Guide

This comprehensive guide explains how to translate CastMate plugins and check the translation status across all plugins. The translation system supports both main (backend) and renderer (frontend) components.

## Overview

CastMate uses a centralized translation system built on YAML files that allows plugins to be translated into multiple languages. Currently, the system supports English (en) and French (fr), with the OBS plugin being the only fully translated plugin.

## Translation System Architecture

### Core Components

1. **Translation Library**: `libs/castmate-translation` - Core translation service
2. **YAML Files**: Language-specific translation files stored in `plugins/{plugin-name}/lang/`
3. **Translation Functions**: 
   - `t()` for main process (backend)
   - `tSync()` for renderer process (frontend)

### Current Translation Status

**Translated Plugins**: 6/28
- ✅ **OBS Plugin** - Fully translated (EN, FR)
- ✅ **Advanced Scene Switcher (advss)** - Fully translated (EN, FR)
- ✅ **Aitum** - Fully translated (EN, FR)
- ✅ **BlueSky** - Fully translated (EN, FR)
- ✅ **Dashboards** - Fully translated (EN, FR)
- ✅ **Discord** - Fully translated (EN, FR)

**Untranslated Plugins**: 22/28
- ❌ elgato, govee, http, input, iot, lifx, minecraft, os, overlays, philips-hue, random, remote, sound, spellcast, stream-plans, time, tplink-kasa, twinkly, twitch, variables, voicemod, wyze

## How to Translate a Plugin

### Step 1: Create Translation Directory Structure

Create a `lang` directory in your plugin folder:

```
plugins/{plugin-name}/
├── main/
├── renderer/
├── shared/
└── lang/          # Create this directory
    ├── en.yml     # English translations
    └── fr.yml     # French translations (optional)
```

### Step 2: Create Translation Files

#### English Translation File (`lang/en.yml`)

```yaml
# {Plugin Name} Plugin Translations - English
plugin:
  name: "Plugin Display Name"
  description: "Plugin description for users"

settings:
  setting_key:
    name: "Setting Display Name"
  another_setting: "Another Setting Name"

states:
  state_name:
    name: "State Display Name"

actions:
  action_name:
    name: "Action Display Name"
    description: "Action description"
    config:
      parameter_name: "Parameter Label"
      another_param: "Another Parameter"

triggers:
  trigger_name:
    name: "Trigger Display Name"
    description: "Trigger description"
    config:
      param: "Parameter Name"

# Renderer-specific translations
renderer:
  main_page:
    title: "Main Page Title"
    no_connections: "No connections configured"
    setup_button: "Setup Connection"
  
  connection:
    name: "Connection Name"
    host: "Host"
    port: "Port"
    password: "Password"
  
  # Component-specific translations
  components:
    form_labels:
      field_name: "Field Label"
```

#### French Translation File (`lang/fr.yml`)

```yaml
# Traductions du Plugin {Plugin Name} - Français
plugin:
  name: "Nom d'affichage du plugin"
  description: "Description du plugin pour les utilisateurs"

settings:
  setting_key:
    name: "Nom d'affichage du paramètre"
  another_setting: "Autre nom de paramètre"

states:
  state_name:
    name: "Nom d'affichage de l'état"

actions:
  action_name:
    name: "Nom d'affichage de l'action"
    description: "Description de l'action"
    config:
      parameter_name: "Libellé du paramètre"
      another_param: "Autre paramètre"

triggers:
  trigger_name:
    name: "Nom d'affichage du déclencheur"
    description: "Description du déclencheur"
    config:
      param: "Nom du paramètre"

# Traductions spécifiques au renderer
renderer:
  main_page:
    title: "Titre de la page principale"
    no_connections: "Aucune connexion configurée"
    setup_button: "Configurer la connexion"
  
  connection:
    name: "Nom de connexion"
    host: "Hôte"
    port: "Port"
    password: "Mot de passe"
  
  # Traductions spécifiques aux composants
  components:
    form_labels:
      field_name: "Libellé du champ"
```

### Step 3: Register Translations in Main Process

In your plugin's main entry file (`main/src/main.ts` or similar):

```typescript
import { definePlugin } from "castmate-core"
import { t, registerPluginTranslations, generatedTranslationsFromDirectory } from "castmate-translation"

const translationFiles = {
	en: (import.meta.glob('../../lang/en.yml', {
		query: '?raw',
		eager: true
	})["../../lang/en.yml"] as any)?.default,
	fr: (import.meta.glob('../../lang/fr.yml', {
		query: '?raw',
		eager: true
	})["../../lang/fr.yml"] as any)?.default
}

registerPluginTranslations("your-plugin-id", generatedTranslationsFromFiles(translationFiles))

export default definePlugin(
  {
    id: "your-plugin-id",
    name: "Your Plugin Name", // Can be translated: t("plugins.your-plugin-id.plugin.name")
    description: "Plugin description", // Can be translated: t("plugins.your-plugin-id.plugin.description")
    color: "#ff6b6b",
    icon: "your-icon-class",
  },
  () => {
    // Plugin initialization code
    
    // Example: Define a setting with translation
    const mySetting = defineSetting("mySetting", {
      type: String,
      name: t("plugins.your-plugin-id.settings.my_setting.name"),
      default: "default-value"
    })
    
    // Example: Define an action with translation
    const myAction = defineAction("myAction", {
      name: t("plugins.your-plugin-id.actions.my_action.name"),
      description: t("plugins.your-plugin-id.actions.my_action.description"),
      config: {
        parameter: {
          type: String,
          name: t("plugins.your-plugin-id.actions.my_action.config.parameter")
        }
      },
      async invoke() {
        // Action implementation
      }
    })
  }
)
```

### Step 4: Use Translations in Renderer (Frontend)

In your renderer components, import and use `tSync`:

```typescript
// main.ts or component files
import { tSync } from "castmate-ui-core"

// In Vue components
export default {
  setup() {
    return {
      tSync
    }
  }
}
```

```vue
<!-- In Vue templates -->
<template>
  <div>
    <h1>{{ tSync('plugins.your-plugin-id.renderer.main_page.title') }}</h1>
    <p-button @click="setup">
      {{ tSync('plugins.your-plugin-id.renderer.main_page.setup_button') }}
    </p-button>
    
    <!-- Form fields -->
    <input-text 
      :label="tSync('plugins.your-plugin-id.renderer.connection.name')"
      v-model="connection.name" 
    />
  </div>
</template>
```

### Step 5: Translation Key Structure

Follow this consistent naming convention:

```
plugins.{plugin-id}.{category}.{item}.{property}
```

Examples:
- `plugins.obs.plugin.name` - Plugin display name
- `plugins.obs.actions.scene.name` - Scene action name
- `plugins.obs.actions.scene.config.scene` - Scene parameter label
- `plugins.obs.renderer.main_page.no_connections` - Renderer main page message
- `plugins.obs.renderer.connection.host` - Connection form field

## Translation Best Practices

### 1. Consistent Structure
- Always follow the same YAML structure across languages
- Use the same keys in all language files
- Maintain consistent indentation (2 spaces)

### 2. Clear Context
- Provide meaningful descriptions in comments
- Group related translations logically
- Use descriptive key names

### 3. Pluralization and Context
- Consider plural forms where needed
- Provide context for translators in comments
- Use clear, concise translations

### 4. Testing Translations
- Test with both languages enabled
- Verify all UI elements are properly translated
- Check for text overflow in different languages

## Common Translation Patterns

### Plugin Definition
```yaml
plugin:
  name: "Plugin Name"
  description: "Brief description of what the plugin does"
```

### Actions and Triggers
```yaml
actions:
  action_id:
    name: "Action Display Name"
    description: "What this action does"
    config:
      param1: "Parameter 1 Label"
      param2: "Parameter 2 Label"

triggers:
  trigger_id:
    name: "Trigger Display Name"
    description: "When this trigger activates"
    config:
      condition: "Condition Label"
```

### Settings and States
```yaml
settings:
  setting_key:
    name: "Setting Display Name"
    description: "Setting explanation"

states:
  state_name:
    name: "State Display Name"
```

### Renderer Components
```yaml
renderer:
  main_page:
    title: "Main Page Title"
    subtitle: "Page description"
    buttons:
      add: "Add"
      remove: "Remove"
      edit: "Edit"
  
  forms:
    connection:
      name: "Connection Name"
      host: "Host Address"
      port: "Port Number"
    
    validation:
      required: "This field is required"
      invalid: "Invalid value"
```

## Checking Translation Status

### Automated Status Check

You can create a script to check which plugins have translations:

```powershell
# PowerShell command to check translation status
Get-ChildItem -Path "plugins" -Directory | ForEach-Object {
  $pluginName = $_.Name
  $langDir = Join-Path $_.FullName "lang"
  if (Test-Path $langDir) {
    $langFiles = Get-ChildItem -Path $langDir -Filter "*.yml"
    Write-Host "✅ $pluginName - Translated ($($langFiles.Count) languages)"
  } else {
    Write-Host "❌ $pluginName - Not translated"
  }
}
```

### Manual Verification

1. **Check for `lang` directory**: `plugins/{plugin-name}/lang/`
2. **Verify translation files**: `en.yml`, `fr.yml` (or other languages)
3. **Check main process registration**: Look for `registerPluginTranslations()` call
4. **Verify usage**: Search for `t()` and `tSync()` calls in code

## Real-World Example: OBS Plugin

The OBS plugin serves as the reference implementation. Here's how it's structured:

### Directory Structure
```
plugins/obs/
├── lang/
│   ├── en.yml    # 252 lines of English translations
│   └── fr.yml    # 252 lines of French translations
├── main/
│   └── src/
│       ├── main.ts        # Plugin registration + translations
│       ├── scenes.ts      # Uses t() for scene actions
│       ├── sources.ts     # Uses t() for source actions
│       └── ...
└── renderer/
    └── src/
        ├── main.ts                           # Uses tSync()
        ├── components/
        │   ├── main-page/ObsMainPageCard.vue # Uses tSync()
        │   └── transform/ObsTransformInput.vue # Uses tSync()
        └── ...
```

### Key Translation Categories
- **Plugin metadata**: Name, description
- **Actions**: 20+ actions with names, descriptions, and parameter labels
- **States**: Connection status, streaming status, recording status
- **Settings**: Connection settings, default values
- **Renderer**: UI labels, form fields, validation messages, transform controls

## Troubleshooting

### Common Issues

1. **Translations not loading**
   - Verify `registerPluginTranslations()` is called in main process
   - Check YAML file syntax (indentation, colons, quotes)
   - Ensure translation keys match exactly

2. **Key not found errors**
   - Verify translation key exists in YAML file
   - Check key spelling and capitalization
   - Ensure language file is properly structured

3. **Renderer translations not working**
   - Use `tSync()` instead of `t()` in renderer
   - Import from `castmate-ui-core`, not `castmate-translation`
   - Verify component has access to translation service

### Debugging Tips

1. **Enable translation logging** - Check console for translation debug messages
2. **Check browser console** for translation errors in renderer
3. **Verify YAML syntax** with online validators
4. **Test with both languages** to ensure completeness

## Contributing Translations

When contributing translations for a plugin:

1. **Fork the repository**
2. **Create the `lang` directory and translation files** following the OBS plugin structure
3. **Update the plugin's main file** to register translations
4. **Update components** to use translation functions (`t()` and `tSync()`)
5. **Test thoroughly** with multiple languages
6. **Submit a pull request** with clear description of what was translated

## Migration Strategy

To translate all 27 remaining plugins efficiently:

### Priority Order
1. **High-usage plugins**: twitch, discord, obs (done), overlays
2. **Core functionality**: variables, time, random, sound
3. **Hardware integrations**: elgato, philips-hue, lifx, govee
4. **Specialized plugins**: minecraft, spellcast, stream-plans
5. **Advanced integrations**: aitum, advss, wyze, voicemod

### Batch Processing
- Group similar plugins (e.g., all lighting plugins)
- Create consistent translation patterns
- Use the OBS plugin as template for structure

## Next Steps

This guide provides the foundation for implementing translations in CastMate plugins. The goal is to eventually translate all 28 plugins to provide a fully internationalized experience for users.

### Immediate Actions
1. Choose a plugin to translate (start with high-usage ones)
2. Create the `lang` directory and YAML files
3. Identify all user-facing strings in the plugin
4. Implement translation registration and usage
5. Test thoroughly and submit for review

### Long-term Goals
- Complete translation coverage across all plugins
- Add support for additional languages (Spanish, German, etc.)
- Create automated tools for translation validation
- Implement translation management workflows

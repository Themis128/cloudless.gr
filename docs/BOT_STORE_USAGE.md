# Bot Store Usage Guide

## Overview

The enhanced `botStore` consolidates all bot-related state management into a single Pinia store, replacing multiple composables with a centralized, reactive state management solution.

## Key Benefits

### 1. **Centralized State Management**
- All bot-related state in one place
- Consistent error handling
- Better debugging with Pinia devtools

### 2. **State Persistence**
- Form data persists across page navigation
- Builder progress maintained during multi-step creation
- Test conversation history preserved

### 3. **Reactive Updates**
- Automatic UI updates when state changes
- Computed properties for derived state
- Optimized re-renders

## Store Structure

### State
```typescript
interface BotState {
  // Core bot data
  bots: Bot[]
  loading: boolean
  error: string | null
  success: string | null
  
  // Builder state
  builderForm: BotForm
  builderStep: number
  builderSteps: Step[]
  
  // Validation state
  validationErrors: ValidationErrors
  
  // Test state
  testMessages: BotTestMessage[]
  testSteps: BotTestStep[]
  testProgress: number
  testInput: string
}
```

### Getters
- `allBots`, `botById`, `activeBots` - Core bot data
- `builderProgress`, `currentBuilderStep` - Builder state
- `hasValidationErrors` - Validation state
- `hasTestMessages`, `lastTestMessage` - Test state

### Actions
- CRUD operations: `fetchAll`, `createBot`, `updateBot`, `deleteBot`
- Builder actions: `updateBuilderForm`, `nextBuilderStep`, `submitBuilder`
- Validation actions: `validateField`, `validateAllFields`
- Test actions: `sendTestMessage`, `resetTest`

## Usage Examples

### Basic Store Usage

```vue
<script setup>
import { useBotStore } from '~/stores/botStore'

const botStore = useBotStore()

// Load bots on component mount
onMounted(() => {
  botStore.fetchAll()
})
</script>

<template>
  <div>
    <div v-if="botStore.loading">Loading...</div>
    <div v-else>
      <div v-for="bot in botStore.allBots" :key="bot.id">
        {{ bot.name }}
      </div>
    </div>
  </div>
</template>
```

### Bot Builder Usage

```vue
<script setup>
import { useBotStore } from '~/stores/botStore'

const botStore = useBotStore()

const handleFormUpdate = (field, value) => {
  botStore.updateBuilderForm(field, value)
}

const handleNextStep = () => {
  if (botStore.canProceedToNextStep) {
    botStore.nextBuilderStep()
  }
}

const handleSubmit = async () => {
  const success = await botStore.submitBuilder()
  if (success) {
    // Handle success
  }
}
</script>

<template>
  <div>
    <!-- Progress bar -->
    <v-progress-linear :value="botStore.builderProgress" />
    
    <!-- Current step -->
    <div>{{ botStore.currentBuilderStep?.title }}</div>
    
    <!-- Form fields -->
    <v-text-field
      :model-value="botStore.builderForm.name"
      @update:model-value="(value) => handleFormUpdate('name', value)"
      :error-messages="botStore.validationErrors.name"
    />
    
    <!-- Navigation -->
    <v-btn 
      @click="handleNextStep"
      :disabled="!botStore.canProceedToNextStep"
    >
      Continue
    </v-btn>
  </div>
</template>
```

### Bot Testing Usage

```vue
<script setup>
import { useBotStore } from '~/stores/botStore'

const props = defineProps<{ botId: number }>()
const botStore = useBotStore()

const sendMessage = async () => {
  await botStore.sendTestMessage(props.botId, botStore.testInput)
}

const resetConversation = () => {
  botStore.resetTest()
}
</script>

<template>
  <div>
    <!-- Test progress -->
    <v-progress-linear :value="botStore.testProgress" />
    
    <!-- Messages -->
    <div v-for="message in botStore.testMessages" :key="message.id">
      <div :class="message.role">
        {{ message.text }}
      </div>
    </div>
    
    <!-- Input -->
    <v-text-field
      v-model="botStore.testInput"
      @keyup.enter="sendMessage"
    />
    <v-btn @click="sendMessage">Send</v-btn>
    <v-btn @click="resetConversation">Reset</v-btn>
  </div>
</template>
```

## Migration from Composables

### Before (using composables)
```vue
<script setup>
import { useBotBuilder } from '~/composables/useBotBuilder'
import { useBotFormValidation } from '~/composables/useBotFormValidation'
import { useBotTest } from '~/composables/useBotTest'

const { form, step, nextStep, submitBot } = useBotBuilder()
const { nameError, validateName } = useBotFormValidation(form)
const { messages, sendMessage } = useBotTest(botId)
</script>
```

### After (using store)
```vue
<script setup>
import { useBotStore } from '~/stores/botStore'

const botStore = useBotStore()

// All state and actions available directly from store
// No need for multiple composables
</script>
```

## Best Practices

### 1. **Use StoreToRefs for Destructuring**
```typescript
import { storeToRefs } from 'pinia'

const botStore = useBotStore()
const { bots, loading, error } = storeToRefs(botStore)
```

### 2. **Handle Loading States**
```vue
<template>
  <div v-if="botStore.loading" class="loading-overlay">
    <v-progress-circular indeterminate />
  </div>
</template>
```

### 3. **Clear Messages**
```typescript
// Clear error/success messages when component unmounts
onUnmounted(() => {
  botStore.clearError()
  botStore.clearSuccess()
})
```

### 4. **Reset State When Needed**
```typescript
// Reset builder state when starting new bot creation
const startNewBot = () => {
  botStore.resetBuilder()
}
```

## Advantages Over Composables

1. **Single Source of Truth**: All bot state in one place
2. **Better Performance**: Optimized reactivity and fewer re-renders
3. **Easier Debugging**: Pinia devtools integration
4. **State Persistence**: State survives component unmounts
5. **Consistent API**: Unified interface for all bot operations
6. **Type Safety**: Better TypeScript support with interfaces

## Migration Checklist

- [ ] Replace `useBotBuilder` with `botStore.builderForm` and related actions
- [ ] Replace `useBotFormValidation` with `botStore.validationErrors` and validation actions
- [ ] Replace `useBotTest` with `botStore.testMessages` and test actions
- [ ] Update component templates to use store getters
- [ ] Remove composable imports
- [ ] Test all functionality works as expected
- [ ] Update any dependent components

This enhanced store provides a much more maintainable and scalable solution for bot state management in your application. 
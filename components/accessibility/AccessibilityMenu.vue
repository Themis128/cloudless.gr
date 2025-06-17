<template>
  <div>
    <button
      class="accessibility-btn"
      :style="btnStyle"
      :aria-label="menu ? 'Close accessibility menu' : 'Open accessibility menu'"
      type="button"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @keydown.enter="menu = !menu"
      @keydown.space.prevent="menu = !menu"
      @keydown="(e) => { if (e.key === 'Enter' || e.key === ' ') { menu = !menu; e.preventDefault(); } }"
    >
      <v-btn
        icon
        color="primary"
        elevation="3"
        @click.stop="menu = !menu"
      >
        <v-icon>mdi-account-settings</v-icon>
      </v-btn>
    </button>
    <v-menu
      v-model="menu"
      :close-on-content-click="false"
      offset-y
      activator="parent"
      attach="body"
      eager
    >
      <v-card class="pa-4" min-width="260">
        <v-card-title class="text-h6">Accessibility</v-card-title>
        <v-divider class="my-2" />
        <v-list density="compact">
          <v-list-item>
            <v-list-item-title>Font Size</v-list-item-title>
            <v-btn
              icon
              :aria-label="'Decrease font size'"
              size="small"
              @click="decreaseFont"
            ><v-icon>mdi-minus</v-icon></v-btn>
            <v-btn
              icon
              :aria-label="'Reset font size'"
              size="small"
              @click="resetFont"
            ><v-icon>mdi-format-font</v-icon></v-btn>
            <v-btn
              icon
              :aria-label="'Increase font size'"
              size="small"
              @click="increaseFont"
            ><v-icon>mdi-plus</v-icon></v-btn>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>High Contrast</v-list-item-title>
            <v-switch
              v-model="highContrast"
              :aria-label="'Toggle high contrast mode'"
              @change="toggleContrast"
            />
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Underline Links</v-list-item-title>
            <v-switch
              v-model="underlineLinks"
              :aria-label="'Toggle underline links'"
              @change="toggleUnderlineLinks"
            />
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Pause Animations</v-list-item-title>
            <v-switch
              v-model="pauseAnimations"
              :aria-label="'Pause background animations'"
              @change="togglePauseAnimations"
            />
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Skip to Content</v-list-item-title>
            <v-btn size="small" color="secondary" @click="skipToContent">Go</v-btn>
          </v-list-item>
          <v-list-item>
            <v-list-item-title>Theme</v-list-item-title>
            <v-btn
              icon
              elevation="2"
              :title="isLightBg ? 'Switch to Dark Background' : 'Switch to Light Background'"
              @click="toggleBg"
            >
              <v-icon>{{ isLightBg ? 'mdi-white-balance-sunny' : 'mdi-weather-night' }}</v-icon>
            </v-btn>
          </v-list-item>
        </v-list>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useTheme } from 'vuetify'

const menu = ref(false)
const highContrast = ref(false)
const underlineLinks = ref(false)
const pauseAnimations = ref(false)
const fontSize = ref(100)

// Theme toggle logic
const theme = useTheme()
const isLightBg = ref(false)
function toggleBg() {
    isLightBg.value = !isLightBg.value
    theme.global.name.value = isLightBg.value ? 'light' : 'dark'
}

// Draggable button state
const btnX = ref(32)
const btnY = ref(32) // default to top left if not set
const dragging = ref(false)
const offset = ref({ x: 0, y: 0 })

const btnStyle = computed(() => {
  if (typeof window === 'undefined') {
    // SSR fallback
    return {
      left: '32px',
      top: '32px',
      position: 'fixed' as const,
      zIndex: 9999
    }
  }
  const x = Math.max(0, Math.min(window.innerWidth - 64, btnX.value || 32))
  const y = Math.max(0, Math.min(window.innerHeight - 64, btnY.value || 32))
  return {
    left: `${x}px`,
    top: `${y}px`,
    position: 'fixed' as const,
    zIndex: 9999
  }
})

function startDrag(e: MouseEvent | TouchEvent) {
    dragging.value = true
    let clientX, clientY
    if (e.type === 'touchstart') {
        const touch = (e as TouchEvent).touches[0]
        clientX = touch.clientX
        clientY = touch.clientY
    } else {
        clientX = (e as MouseEvent).clientX
        clientY = (e as MouseEvent).clientY
    }
    offset.value = {
        x: clientX - btnX.value,
        y: clientY - btnY.value
    }
    document.addEventListener('mousemove', onDrag as EventListener)
    document.addEventListener('mouseup', stopDrag)
    document.addEventListener('touchmove', onDrag as EventListener)
    document.addEventListener('touchend', stopDrag)
}

function onDrag(e: MouseEvent | TouchEvent) {
    if (!dragging.value || typeof window === 'undefined') return
    let clientX, clientY
    if (e.type.startsWith('touch')) {
        const touch = (e as TouchEvent).touches[0]
        if (!touch) return
        clientX = touch.clientX
        clientY = touch.clientY
    } else {
        clientX = (e as MouseEvent).clientX
        clientY = (e as MouseEvent).clientY
    }
    const newX = clientX - offset.value.x
    const newY = clientY - offset.value.y
    btnX.value = Math.max(0, Math.min(window.innerWidth - 64, newX))
    btnY.value = Math.max(0, Math.min(window.innerHeight - 64, newY))
}

function stopDrag() {
    dragging.value = false
    localStorage.setItem('accessibilityBtnX', btnX.value.toString())
    localStorage.setItem('accessibilityBtnY', btnY.value.toString())
    document.removeEventListener('mousemove', onDrag as EventListener)
    document.removeEventListener('mouseup', stopDrag)
    document.removeEventListener('touchmove', onDrag as EventListener)
    document.removeEventListener('touchend', stopDrag)
}

onMounted(() => {
    // Only access window and localStorage on client
    if (typeof window === 'undefined') return
    
    // Set default position if not saved
    if (!localStorage.getItem('accessibilityBtnX') || !localStorage.getItem('accessibilityBtnY')) {
        btnX.value = 32
        btnY.value = window.innerHeight - 120
    }
    const savedX = localStorage.getItem('accessibilityBtnX')
    const savedY = localStorage.getItem('accessibilityBtnY')
    if (savedX && savedY) {
        btnX.value = parseInt(savedX)
        btnY.value = parseInt(savedY)
    }
    // Restore persisted accessibility settings
    const savedFont = localStorage.getItem('fontSize')
    if (savedFont) {
      fontSize.value = parseInt(savedFont)
      document.documentElement.style.fontSize = fontSize.value + '%'
    }
    const savedContrast = localStorage.getItem('highContrast')
    if (savedContrast) {
      highContrast.value = savedContrast === 'true'
      toggleContrast()
    }
    const savedPause = localStorage.getItem('pauseAnimations')
    if (savedPause) {
      pauseAnimations.value = savedPause === 'true'
      togglePauseAnimations()
    }
})

function increaseFont() {
    fontSize.value = Math.min(fontSize.value + 10, 200)
    document.documentElement.style.fontSize = fontSize.value + '%'
    localStorage.setItem('fontSize', fontSize.value.toString())
}
function decreaseFont() {
    fontSize.value = Math.max(fontSize.value - 10, 70)
    document.documentElement.style.fontSize = fontSize.value + '%'
    localStorage.setItem('fontSize', fontSize.value.toString())
}
function resetFont() {
    fontSize.value = 100
    document.documentElement.style.fontSize = '100%'
    localStorage.setItem('fontSize', '100')
}
function toggleContrast() {
    document.body.classList.toggle('high-contrast', highContrast.value)
    localStorage.setItem('highContrast', highContrast.value.toString())
}
function toggleUnderlineLinks() {
    document.body.classList.toggle('underline-links', underlineLinks.value)
}
function togglePauseAnimations() {
    document.body.classList.toggle('pause-animations', pauseAnimations.value)
    localStorage.setItem('pauseAnimations', pauseAnimations.value.toString())
}
function skipToContent() {
    const main = document.querySelector('main, [role=main]')
    if (main) {
        main.setAttribute('tabindex', '-1')
        ;(main as HTMLElement).focus()
    }
}
watch(highContrast, toggleContrast)
watch(underlineLinks, toggleUnderlineLinks)
watch(pauseAnimations, togglePauseAnimations)
</script>

<style scoped>
.accessibility-btn {
    position: fixed;
    z-index: 2147483647;
    cursor: grab;
    pointer-events: auto;
    /* Default position is handled by JS */
}
</style>

<template>
    <div>
        <div class="accessibility-btn" :style="btnStyle" @mousedown="startDrag" @touchstart="startDrag"
            :aria-label="menu ? 'Close accessibility menu' : 'Open accessibility menu'" tabindex="0"
            @keydown.enter="menu = !menu" @keydown.space.prevent="menu = !menu">
            <v-btn icon color="primary" elevation="3" @click.stop="menu = !menu">
                <UserIcon class="w-8 h-8" aria-label="Accessibility menu" />
            </v-btn>
        </div>
        <v-menu v-model="menu" :close-on-content-click="false" offset-y>
            <v-card class="pa-4" min-width="260">
                <v-card-title class="text-h6">Accessibility</v-card-title>
                <v-divider class="my-2" />
                <v-list density="compact">
                    <v-list-item>
                        <v-list-item-title>Font Size</v-list-item-title>
                        <v-btn icon @click="decreaseFont" :aria-label="'Decrease font size'"
                            size="small"><v-icon>mdi-minus</v-icon></v-btn>
                        <v-btn icon @click="resetFont" :aria-label="'Reset font size'"
                            size="small"><v-icon>mdi-format-font</v-icon></v-btn>
                        <v-btn icon @click="increaseFont" :aria-label="'Increase font size'"
                            size="small"><v-icon>mdi-plus</v-icon></v-btn>
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title>High Contrast</v-list-item-title>
                        <v-switch v-model="highContrast" @change="toggleContrast"
                            :aria-label="'Toggle high contrast mode'" />
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title>Underline Links</v-list-item-title>
                        <v-switch v-model="underlineLinks" @change="toggleUnderlineLinks"
                            :aria-label="'Toggle underline links'" />
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title>Pause Animations</v-list-item-title>
                        <v-switch v-model="pauseAnimations" @change="togglePauseAnimations"
                            :aria-label="'Pause background animations'" />
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title>Skip to Content</v-list-item-title>
                        <v-btn @click="skipToContent" size="small" color="secondary">Go</v-btn>
                    </v-list-item>
                    <v-list-item>
                        <v-list-item-title>Theme</v-list-item-title>
                        <v-btn icon elevation="2"
                            :title="isLightBg ? 'Switch to Dark Background' : 'Switch to Light Background'"
                            @click="toggleBg">
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
import { UserIcon } from '@heroicons/vue/24/outline'
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

const btnStyle = computed(() => ({
  left: btnX.value + 'px',
  top: btnY.value + 'px'
}))

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
    if (!dragging.value) return
    let clientX, clientY
    if (e.type.startsWith('touch')) {
        const touch = (e as TouchEvent).touches[0]
        clientX = touch.clientX
        clientY = touch.clientY
    } else {
        clientX = (e as MouseEvent).clientX
        clientY = (e as MouseEvent).clientY
    }
    btnX.value = Math.max(0, Math.min(window.innerWidth - 64, clientX - offset.value.x))
    btnY.value = Math.max(0, Math.min(window.innerHeight - 64, clientY - offset.value.y))
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
    // Only access window on client
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
})

function increaseFont() {
    fontSize.value = Math.min(fontSize.value + 10, 200)
    document.documentElement.style.fontSize = fontSize.value + '%'
}
function decreaseFont() {
    fontSize.value = Math.max(fontSize.value - 10, 70)
    document.documentElement.style.fontSize = fontSize.value + '%'
}
function resetFont() {
    fontSize.value = 100
    document.documentElement.style.fontSize = '100%'
}
function toggleContrast() {
    document.body.classList.toggle('high-contrast', highContrast.value)
}
function toggleUnderlineLinks() {
    document.body.classList.toggle('underline-links', underlineLinks.value)
}
function togglePauseAnimations() {
    document.body.classList.toggle('pause-animations', pauseAnimations.value)
}
function skipToContent() {
    const main = document.querySelector('main, [role=main]')
    if (main) {
        (main as HTMLElement).focus()
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

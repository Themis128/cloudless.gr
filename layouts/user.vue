/* Ensure navbar and drawer are always above background and main content */
.v-application .v-app-bar {
z-index: 1002 !important;
}
.v-application .v-navigation-drawer {
z-index: 1001 !important;
}
<template>
    <v-app :theme="currentTheme">
        <v-navigation-drawer v-model="drawer" app temporary class="bg-dark">
            <v-list>
                <v-list-item title="Dashboard" prepend-icon="mdi-view-dashboard" to="/dashboard" />
                <v-list-item title="Projects" prepend-icon="mdi-folder" to="/projects" />
                <v-list-item title="Settings" prepend-icon="mdi-cog" to="/settings" />
                <v-divider />
                <v-list-item title="Logout" prepend-icon="mdi-logout" />
            </v-list>
        </v-navigation-drawer>

        <v-app-bar app flat color="transparent">
            <v-toolbar-title class="text-primary">
                Cloudless
            </v-toolbar-title>
            <v-spacer />
            <div v-if="user && user.full_name" class="mr-4 font-weight-medium">
                {{ user.full_name }}
            </div>
            <div
                class="floating-avatar-menu"
                :style="avatarStyle"
            >
                <div
                    class="avatar-drag-handle"
                    @mousedown="startAvatarDrag"
                    @touchstart="startAvatarDrag"
                >
                    <v-avatar size="48">
                        <img :src="user.avatar_url || 'https://i.pravatar.cc/150?u=default'" alt="avatar" class="avatar-img" />
                    </v-avatar>
                </div>
                <v-menu offset-y>
                    <template #activator="{ props }">
                        <v-btn icon v-bind="props" class="floating-avatar-btn" style="margin-top: -48px; margin-left: 0;">
                            <span style="width:48px;height:48px;display:inline-block;"></span>
                        </v-btn>
                    </template>
                    <v-list>
                        <v-list-item @click="goToProfile">
                            <v-list-item-title>Profile</v-list-item-title>
                        </v-list-item>
                        <v-list-item @click="logout">
                            <v-list-item-title>Logout</v-list-item-title>
                        </v-list-item>
                    </v-list>
                </v-menu>
            </div>
        </v-app-bar>

        <!-- Fixed full-screen layered background (always at the bottom) -->
        <div :class="['bg-layer', isLightBg ? 'bg-layer-light' : '']"
            style="z-index:0; position:fixed; inset:0; pointer-events:none;" />

        <!-- Main content and navigation above background -->
        <v-main class="main-content" style="z-index:2; position:relative;">
            <v-container class="d-flex flex-column fill-height user-layout">
                <div class="theme-toggle-btn">
                    <v-btn icon elevation="2"
                        :title="isLightBg ? 'Switch to Dark Background' : 'Switch to Light Background'"
                        @click="toggleBg">
                        <v-icon>{{ isLightBg ? 'mdi-white-balance-sunny' : 'mdi-weather-night' }}</v-icon>
                    </v-btn>
                </div>
                <slot />
                <v-spacer />
                <Suspense>
                    <template #default>
                        <Footer :year="new Date().getFullYear()" :isDark="!isLightBg" />
                    </template>
                    <template #fallback>
                        <div class="text-sm text-gray-400 text-center py-2">Loading footer...</div>
                    </template>
                </Suspense>
            </v-container>
        </v-main>

        <!-- AccessibilityMenu always on top -->
        <AccessibilityMenu />
    </v-app>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useTheme } from 'vuetify'
import AccessibilityMenu from '~/components/accessibility/AccessibilityMenu.vue'
import { defineAsyncComponent } from 'vue'
const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))

import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'

const theme = useTheme()
const currentTheme = theme.global.name
const isLightBg = ref(false)
const drawer = ref(false)
const user = ref({ full_name: '', avatar_url: '', email: '' })
let logout = () => {}
let goToProfile = () => {}

// Moveable floating avatar logic (like accessibility button)
import { computed } from 'vue'
const avatarX = ref(window.innerWidth - 100)
const avatarY = ref(24)
const avatarDragging = ref(false)
const avatarOffset = ref({ x: 0, y: 0 })
const avatarStyle = computed(() => `left: ${avatarX.value}px; top: ${avatarY.value}px;`)

function startAvatarDrag(e: MouseEvent | TouchEvent) {
  avatarDragging.value = true
  let clientX, clientY
  if (e.type === 'touchstart') {
    const touch = (e as TouchEvent).touches[0]
    clientX = touch.clientX
    clientY = touch.clientY
  } else {
    clientX = (e as MouseEvent).clientX
    clientY = (e as MouseEvent).clientY
  }
  avatarOffset.value = {
    x: clientX - avatarX.value,
    y: clientY - avatarY.value
  }
  document.addEventListener('mousemove', onAvatarDrag as EventListener)
  document.addEventListener('mouseup', stopAvatarDrag)
  document.addEventListener('touchmove', onAvatarDrag as EventListener)
  document.addEventListener('touchend', stopAvatarDrag)
}

function onAvatarDrag(e: MouseEvent | TouchEvent) {
  if (!avatarDragging.value) return
  let clientX, clientY
  if (e.type.startsWith('touch')) {
    const touch = (e as TouchEvent).touches[0]
    clientX = touch.clientX
    clientY = touch.clientY
  } else {
    clientX = (e as MouseEvent).clientX
    clientY = (e as MouseEvent).clientY
  }
  avatarX.value = Math.max(0, Math.min(window.innerWidth - 64, clientX - avatarOffset.value.x))
  avatarY.value = Math.max(0, Math.min(window.innerHeight - 64, clientY - avatarOffset.value.y))
}

function stopAvatarDrag() {
  avatarDragging.value = false
  document.removeEventListener('mousemove', onAvatarDrag as EventListener)
  document.removeEventListener('mouseup', stopAvatarDrag)
  document.removeEventListener('touchmove', onAvatarDrag as EventListener)
  document.removeEventListener('touchend', stopAvatarDrag)
}

onMounted(() => {
  const userStore = useUserStore()
  const router = useRouter()
  user.value = userStore.user
  logout = userStore.logout
  goToProfile = () => router.push('/profile')
  userStore.fetchUserProfile()
})

function toggleBg() {
    isLightBg.value = !isLightBg.value
}
</script>

<style scoped>
/* Accessibility global styles (should be moved to app level/global CSS for full effect) */
:global(body.high-contrast) {
    background: #000 !important;
    color: #fff !important;
}

:global(body.high-contrast) a {
    color: #ffff00 !important;
    text-decoration: underline !important;
}

:global(body.underline-links) a {
    text-decoration: underline !important;
}

:global(body.pause-animations) *,
:global(body.pause-animations) *::before,
:global(body.pause-animations) *::after {
    animation: none !important;
    transition: none !important;
}

/* Beautiful layered background */
.bg-layer {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
        radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.08), transparent 50%),
        radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.08), transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.03), transparent 70%),
        repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.03) 0px, transparent 8px, transparent 16px),
        #181824;
}

.bg-layer-light {
    background:
        radial-gradient(circle at 10% 20%, rgba(168, 85, 247, 0.13), transparent 50%),
        radial-gradient(circle at 90% 80%, rgba(59, 130, 246, 0.13), transparent 50%),
        radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.13), transparent 70%),
        repeating-linear-gradient(45deg, rgba(168, 85, 247, 0.06) 0px, transparent 8px, transparent 16px),
        #f3f6fa;
}

/* Ensure layout fills screen */
.main-content {
    z-index: 1;
    position: relative;
    background-color: transparent !important;
    min-height: 100vh;
    padding: 1rem;
}

.bg-dark {
    background-color: #1e1e2f;
}

/* Content container */
.user-layout {
    z-index: 2;
    position: relative;
    flex: 1;
    padding-top: 2rem;
    padding-bottom: 2rem;
}

/* Footer styles */
.footer {
    background: rgba(24, 24, 36, 0.85);
    font-size: 1rem;
    padding: 1.2rem 0 0.5rem 0;
    border-top: 1px solid rgba(168, 85, 247, 0.12);
    box-shadow: 0 -2px 16px 0 rgba(59, 130, 246, 0.04);
    letter-spacing: 1px;
    z-index: 3;
}

.footer-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5em;
    color: #e0e6f5;
}

.theme-toggle-btn {
    position: absolute;
    top: 2rem;
    right: 2rem;
    z-index: 10;
}
</style>
/* Make the avatar-drag-handle float above the menu button and be draggable */
.avatar-drag-handle {
  cursor: grab;
  z-index: 2100;
  position: absolute;
  top: 0;
  left: 0;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: transparent;
  user-select: none;
}
/* Ensure avatar image is perfectly circular and fits the avatar size */
.avatar-img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}
/* Floating avatar button styles */
.floating-avatar-menu {
  position: fixed;
  top: 1.5rem;
  right: 2.5rem;
  z-index: 2000;
}
.floating-avatar-btn {
  background: rgba(255,255,255,0.12) !important;
  box-shadow: 0 2px 12px rgba(30,30,60,0.18);
  border-radius: 50%;
  transition: box-shadow 0.2s;
}
.floating-avatar-btn:hover {
  box-shadow: 0 4px 24px rgba(168,85,247,0.18);
}

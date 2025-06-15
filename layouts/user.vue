<template>
  <div class="user-layout">
    <v-app :theme="currentTheme">
      <!-- Navigation Drawer -->
      <nav>
        <v-navigation-drawer v-model="drawer" app temporary class="bg-dark">
          <v-list>
            <NuxtLink v-for="item in navItems" :key="item.to" :to="item.to" custom v-slot="{ navigate, href, isActive }">
              <v-list-item
                :title="item.title"
                :prepend-icon="item.icon"
                :href="href"
                :active="isActive"
                @click="() => navigate()"
              />
            </NuxtLink>
            <v-divider />
            <v-list-item @click="logout" title="Logout" prepend-icon="mdi-logout" />
          </v-list>
        </v-navigation-drawer>
      </nav>

      <!-- App Bar (Header) -->
      <v-app-bar app flat color="transparent">
        <v-toolbar-title class="text-primary">Cloudless</v-toolbar-title>
        <v-spacer />
        <div v-if="user && user.full_name" class="mr-4 font-weight-medium">
          {{ user.full_name }}
        </div>
        <div class="floating-avatar-menu" :style="avatarStyle">
          <div class="avatar-drag-handle" @mousedown="startAvatarDrag" @touchstart="startAvatarDrag">
            <v-avatar size="48">
              <!-- Avatar image removed as requested -->
            </v-avatar>
          </div>
          <!-- Floating avatar menu button removed as requested -->
        </div>
      </v-app-bar>

      <!-- Background Layer (fixed and non-interactive) -->
      <div class="bg-layer" :class="isLightBg ? 'bg-layer-light' : ''"></div>

      <!-- Main Content (Scrolls above the background) -->
      <v-main class="main-content">
        <v-container class="d-flex flex-column fill-height">
          <div class="theme-toggle-btn">
            <v-btn icon elevation="2" :title="isLightBg ? 'Switch to Dark Background' : 'Switch to Light Background'" @click="toggleBg">
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

      <!-- Accessibility Menu -->
      <AccessibilityMenu />
    </v-app>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, defineAsyncComponent } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from 'vuetify'
import AccessibilityMenu from '../components/accessibility/AccessibilityMenu.vue'
import { useSupabase } from '@/composables/useSupabase'
import { useUserStore } from '@/stores/userStore'

const Footer = defineAsyncComponent(() => import('../components/Layout/Footer.vue'))
const theme = useTheme()
const currentTheme = theme.global.name
const isLightBg = ref(false)
const drawer = ref(false)

const userStore = useUserStore()
const user = computed(() => userStore.user)

const navItems = [
  { to: '/projects', title: 'Projects', icon: 'mdi-folder' },
  { to: '/settings', title: 'Settings', icon: 'mdi-cog' }
]

const supabase = useSupabase()
const router = useRouter()

const avatarX = ref(window.innerWidth - 100)
const avatarY = ref(24)
const avatarDragging = ref(false)
const avatarOffset = ref({ x: 0, y: 0 })
const avatarStyle = computed(() => ({
  left: avatarX.value + 'px',
  top: avatarY.value + 'px'
}))

function startAvatarDrag(e: MouseEvent | TouchEvent) {
  e.preventDefault()
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

async function logout() {
  await supabase.auth.signOut()
  router.push('/auth/login')
}

function goToProfile() {
  router.push('/profile')
}


onMounted(async () => {
  const stored = process.client ? localStorage.getItem('isLightBg') : null
  if (stored) isLightBg.value = stored === 'true'
  await userStore.fetchUserProfile()
})

function toggleBg() {
  isLightBg.value = !isLightBg.value
  if (process.client) localStorage.setItem('isLightBg', String(isLightBg.value))
}
</script>

<style scoped>
/* Add styles for layout, floating avatar, background, and other elements */
</style>

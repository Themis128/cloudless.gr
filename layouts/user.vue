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
            <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
            <v-toolbar-title class="text-primary">
                Cloudless
                <span v-if="userProfile && (userProfile.first_name || userProfile.last_name)"
                    class="ml-2 text-body-2 text-grey-darken-2">
                    — {{ userProfile.first_name }} {{ userProfile.last_name }}
                </span>
                <span v-else-if="userProfile && userProfile.email" class="ml-2 text-body-2 text-grey-darken-2">
                    — {{ userProfile.email }}
                </span>
            </v-toolbar-title>
            <v-spacer />
            <v-btn icon>
                <v-icon>mdi-account-circle</v-icon>
            </v-btn>
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

import { ref } from 'vue'
import { useTheme } from 'vuetify'
import AccessibilityMenu from '~/components/accessibility/AccessibilityMenu.vue'
import { defineAsyncComponent } from 'vue'
const Footer = defineAsyncComponent(() => import('@/components/Layout/Footer.vue'))

import { useSupabase } from '@/composables/useSupabase'
import { onMounted } from 'vue'

const theme = useTheme()
const currentTheme = theme.global.name
const isLightBg = ref(false)
const drawer = ref(false)
const userProfile = ref<any>(null)

async function fetchUserProfile() {
    const supabase = useSupabase()
    const { data: authData } = await supabase.auth.getUser()
    const authUser = authData.user
    if (authUser) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', authUser.id)
            .single()
        userProfile.value = {
            ...authUser,
            ...profile
        }
    }
}

onMounted(fetchUserProfile)

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

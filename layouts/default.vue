<template>
  <v-app>
    <client-only>
      <template #fallback>
        <div
          style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: -1;
            background: linear-gradient(135deg, #23232b 0, #3f83f8 100%);
          "
        ></div>
      </template>
      <div
        v-if="vantaEnabled"
        id="vanta-bg"
        ref="vantaRef"
        style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: -1"
      />
    </client-only>
    <div
      v-show="!vantaEnabled"
      style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        z-index: -1;
        background: linear-gradient(135deg, #23232b 0, #3f83f8 100%);
      "
    />
    <client-only>
      <template #fallback>
        <div style="display: none"></div>
      </template>
      <v-btn
        v-if="vantaEnabled"
        icon
        color="primary"
        style="position: fixed; top: 16px; right: 16px; z-index: 10"
        @click="toggleVantaControls"
        aria-label="Toggle Vanta Controls"
      >
        <v-icon>mdi-tune-variant</v-icon>
      </v-btn>
    </client-only>
    <client-only>
      <template #fallback>
        <div style="display: none"></div>
      </template>
      <VantaControls
        v-if="showVantaControls && vantaEnabled"
        :initial="{
          ...getEffectOptions(currentEffect),
          selectedEffect: currentEffect,
        }"
        @update="onVantaUpdate"
        @close="closeVantaControls"
      />
    </client-only>
    <v-container fluid class="pa-0" style="min-height: 100vh">
      <v-app-bar app color="primary" dark flat>
        <v-row align="center" class="ma-0 pa-0" style="width: 100%">
          <v-col cols="auto" class="d-flex align-center">
            <NuxtLink to="/" style="text-decoration: none; display: flex; align-items: center">
              <v-avatar size="40" color="white">
                <span class="text-primary text-h6 font-weight-bold">CL</span>
              </v-avatar>
              <span class="ml-2 text-h6 font-weight-bold">Cloudless Wizard</span>
            </NuxtLink>
          </v-col>
          <v-col>
            <client-only>
              <template #fallback>
                <div class="d-none d-md-flex" style="justify-content: end; align-items: center">
                  <v-btn text color="white" prepend-icon="mdi-tools">Build</v-btn>
                  <v-btn text color="white" prepend-icon="mdi-robot">AI</v-btn>
                  <v-btn text color="white" prepend-icon="mdi-server">Ops</v-btn>
                  <v-btn text color="white" to="/documentation" prepend-icon="mdi-book-open-variant"
                    >Docs</v-btn
                  >
                </div>
              </template>
              <v-row class="d-none d-md-flex" justify="end" align="center" no-gutters>
                <v-menu offset-y>
                  <template #activator="{ props }">
                    <v-btn v-bind="props" text color="white" prepend-icon="mdi-tools">Build</v-btn>
                  </template>
                  <v-list>
                    <v-list-item to="/projects" prepend-icon="mdi-folder-multiple"
                      >Projects</v-list-item
                    >
                    <v-list-item to="/bots" prepend-icon="mdi-robot">Bots</v-list-item>
                    <v-list-item to="/models" prepend-icon="mdi-brain">Models</v-list-item>
                    <v-list-item to="/pipelines" prepend-icon="mdi-timeline">Pipelines</v-list-item>
                    <v-list-item to="/tools" prepend-icon="mdi-wrench">Tools</v-list-item>
                  </v-list>
                </v-menu>
                <v-menu offset-y>
                  <template #activator="{ props }">
                    <v-btn v-bind="props" text color="white" prepend-icon="mdi-robot">AI</v-btn>
                  </template>
                  <v-list>
                    <v-list-item to="/llm" prepend-icon="mdi-brain">LLM Overview</v-list-item>
                    <v-list-item to="/llm/models" prepend-icon="mdi-brain">Models</v-list-item>
                    <v-list-item to="/llm/training" prepend-icon="mdi-school"
                      >Training Sessions</v-list-item
                    >
                    <v-list-item to="/llm/datasets" prepend-icon="mdi-database"
                      >Datasets</v-list-item
                    >
                    <v-list-item to="/llm/analytics" prepend-icon="mdi-chart-line"
                      >Analytics</v-list-item
                    >
                    <v-list-item to="/llm/api" prepend-icon="mdi-api">API Docs</v-list-item>
                    <v-list-item to="/llm/local" prepend-icon="mdi-desktop">Local LLM</v-list-item>
                    <v-list-item to="/llm/train" prepend-icon="mdi-school">Train Model</v-list-item>
                  </v-list>
                </v-menu>
                <v-menu offset-y>
                  <template #activator="{ props }">
                    <v-btn v-bind="props" text color="white" prepend-icon="mdi-server">Ops</v-btn>
                  </template>
                  <v-list>
                    <v-list-item to="/deploy" prepend-icon="mdi-rocket-launch">Deploy</v-list-item>
                    <v-list-item to="/dashboard" prepend-icon="mdi-view-dashboard"
                      >Dashboard</v-list-item
                    >
                    <v-list-item to="/debug" prepend-icon="mdi-bug">Debug</v-list-item>
                    <v-list-item to="/profile" prepend-icon="mdi-account">Profile</v-list-item>
                    <v-list-item to="/settings" prepend-icon="mdi-cog">Settings</v-list-item>
                  </v-list>
                </v-menu>
                <client-only>
                  <template #fallback>
                    <div style="display: none"></div>
                  </template>
                  <v-menu v-if="isAdmin" offset-y>
                    <template #activator="{ props }">
                      <v-btn v-bind="props" text color="white" prepend-icon="mdi-shield-crown"
                        >Admin</v-btn
                      >
                    </template>
                    <v-list>
                      <v-list-item
                        to="/admin"
                        prepend-icon="mdi-view-dashboard"
                        @click="handleNavigationClick"
                        >Dashboard</v-list-item
                      >
                      <v-list-item
                        to="/admin/users"
                        prepend-icon="mdi-account-group"
                        @click="handleNavigationClick"
                        >Users</v-list-item
                      >
                      <v-list-item
                        to="/admin/roles"
                        prepend-icon="mdi-shield-account"
                        @click="handleNavigationClick"
                        >Roles</v-list-item
                      >
                      <v-list-item
                        to="/admin/projects"
                        prepend-icon="mdi-folder-multiple"
                        @click="handleNavigationClick"
                        >Projects</v-list-item
                      >
                      <v-list-item
                        to="/admin/contact-submissions"
                        prepend-icon="mdi-email"
                        @click="handleNavigationClick"
                        >Contact Submissions</v-list-item
                      >
                      <v-list-item
                        to="/admin/redis-analytics"
                        prepend-icon="mdi-chart-line"
                        @click="handleNavigationClick"
                        >Analytics</v-list-item
                      >
                      <v-list-item
                        to="/admin/health"
                        prepend-icon="mdi-heart-pulse"
                        @click="handleNavigationClick"
                        >Health</v-list-item
                      >
                    </v-list>
                  </v-menu>
                </client-only>

                <v-btn text color="white" to="/documentation" prepend-icon="mdi-book-open-variant"
                  >Docs</v-btn
                >
              </v-row>
            </client-only>
          </v-col>
          <v-col cols="auto" class="d-flex align-center justify-end">
            <client-only>
              <template #fallback>
                <div class="d-flex align-center justify-end">
                  <v-btn icon color="white" class="d-md-none" aria-label="Toggle mobile menu">
                    <v-icon>mdi-menu</v-icon>
                  </v-btn>
                  <v-chip color="grey" class="ml-2" label small>
                    <v-icon left size="14">mdi-cancel</v-icon>
                    Offline
                  </v-chip>
                  <v-btn
                    color="primary"
                    variant="elevated"
                    size="small"
                    class="ml-2"
                    title="Login to your account"
                    to="/auth/login"
                  >
                    <v-icon size="16" class="mr-1">mdi-login</v-icon>
                    Login
                  </v-btn>
                </div>
              </template>
              <div class="d-flex align-center justify-end">
                <v-btn
                  icon
                  color="white"
                  class="d-md-none"
                  @click="toggleMobileMenu"
                  aria-label="Toggle mobile menu"
                >
                  <v-icon>{{ showMobileMenu ? 'mdi-close' : 'mdi-menu' }}</v-icon>
                </v-btn>
                <v-chip v-if="isAuthenticated" color="success" class="ml-2" label small>
                  <v-icon left size="14">mdi-check-circle</v-icon>
                  Online
                </v-chip>
                <v-chip v-else color="grey" class="ml-2" label small>
                  <v-icon left size="14">mdi-cancel</v-icon>
                  Offline
                </v-chip>

                <v-btn
                  v-if="isAuthenticated"
                  color="error"
                  variant="outlined"
                  size="small"
                  class="ml-2"
                  :title="`Logout ${user?.email || ''}`"
                  @click="handleLogout"
                  :loading="authLoading"
                >
                  <v-icon size="16" class="mr-1">mdi-logout</v-icon>
                  Logout
                </v-btn>
                <v-btn
                  v-else
                  color="primary"
                  variant="elevated"
                  size="small"
                  class="ml-2"
                  title="Login to your account"
                  to="/auth/login"
                >
                  <v-icon size="16" class="mr-1">mdi-login</v-icon>
                  Login
                </v-btn>
              </div>
            </client-only>
          </v-col>
        </v-row>
      </v-app-bar>
      <client-only>
        <template #fallback>
          <div style="display: none"></div>
        </template>
        <v-navigation-drawer v-model="showMobileMenu" app temporary class="d-md-none">
          <v-list>
            <v-list-group value="Build">
              <template #activator>
                <v-list-item prepend-icon="mdi-tools">Build</v-list-item>
              </template>
              <v-list-item
                to="/projects"
                prepend-icon="mdi-folder-multiple"
                @click="handleNavigationClick"
                >Projects</v-list-item
              >
              <v-list-item to="/bots" prepend-icon="mdi-robot" @click="handleNavigationClick"
                >Bots</v-list-item
              >
              <v-list-item to="/models" prepend-icon="mdi-brain" @click="handleNavigationClick"
                >Models</v-list-item
              >
              <v-list-item
                to="/pipelines"
                prepend-icon="mdi-timeline"
                @click="handleNavigationClick"
                >Pipelines</v-list-item
              >
              <v-list-item to="/tools" prepend-icon="mdi-wrench" @click="handleNavigationClick"
                >Tools</v-list-item
              >
            </v-list-group>
            <v-list-group value="AI">
              <template #activator>
                <v-list-item prepend-icon="mdi-robot">AI</v-list-item>
              </template>
              <v-list-item to="/llm" prepend-icon="mdi-brain" @click="handleNavigationClick"
                >LLM Overview</v-list-item
              >
              <v-list-item to="/llm/models" prepend-icon="mdi-brain" @click="handleNavigationClick"
                >Models</v-list-item
              >
              <v-list-item
                to="/llm/training"
                prepend-icon="mdi-school"
                @click="handleNavigationClick"
                >Training Sessions</v-list-item
              >
              <v-list-item
                to="/llm/datasets"
                prepend-icon="mdi-database"
                @click="handleNavigationClick"
                >Datasets</v-list-item
              >
              <v-list-item
                to="/llm/analytics"
                prepend-icon="mdi-chart-line"
                @click="handleNavigationClick"
                >Analytics</v-list-item
              >
              <v-list-item to="/llm/api" prepend-icon="mdi-api" @click="handleNavigationClick"
                >API Docs</v-list-item
              >
              <v-list-item to="/llm/local" prepend-icon="mdi-desktop" @click="handleNavigationClick"
                >Local LLM</v-list-item
              >
              <v-list-item to="/llm/train" prepend-icon="mdi-school" @click="handleNavigationClick"
                >Train Model</v-list-item
              >
            </v-list-group>
            <v-list-group value="Ops">
              <template #activator>
                <v-list-item prepend-icon="mdi-server">Ops</v-list-item>
              </template>
              <v-list-item
                to="/deploy"
                prepend-icon="mdi-rocket-launch"
                @click="handleNavigationClick"
                >Deploy</v-list-item
              >
              <v-list-item
                to="/dashboard"
                prepend-icon="mdi-view-dashboard"
                @click="handleNavigationClick"
                >Dashboard</v-list-item
              >
              <v-list-item to="/debug" prepend-icon="mdi-bug" @click="handleNavigationClick"
                >Debug</v-list-item
              >
              <v-list-item to="/profile" prepend-icon="mdi-account" @click="handleNavigationClick"
                >Profile</v-list-item
              >
              <v-list-item to="/settings" prepend-icon="mdi-cog" @click="handleNavigationClick"
                >Settings</v-list-item
              >
            </v-list-group>
            <client-only>
              <template #fallback>
                <div style="display: none"></div>
              </template>
              <v-list-group v-if="isAdmin" value="Admin">
                <template #activator>
                  <v-list-item prepend-icon="mdi-shield-crown">Admin</v-list-item>
                </template>
                <v-list-item
                  to="/admin"
                  prepend-icon="mdi-view-dashboard"
                  @click="handleNavigationClick"
                  >Dashboard</v-list-item
                >
                <v-list-item
                  to="/admin/users"
                  prepend-icon="mdi-account-group"
                  @click="handleNavigationClick"
                  >Users</v-list-item
                >
                <v-list-item
                  to="/admin/roles"
                  prepend-icon="mdi-shield-account"
                  @click="handleNavigationClick"
                  >Roles</v-list-item
                >
                <v-list-item
                  to="/admin/projects"
                  prepend-icon="mdi-folder-multiple"
                  @click="handleNavigationClick"
                  >Projects</v-list-item
                >
                <v-list-item
                  to="/admin/contact-submissions"
                  prepend-icon="mdi-email"
                  @click="handleNavigationClick"
                  >Contact Submissions</v-list-item
                >
                <v-list-item
                  to="/admin/redis-analytics"
                  prepend-icon="mdi-chart-line"
                  @click="handleNavigationClick"
                  >Analytics</v-list-item
                >
                <v-list-item
                  to="/admin/health"
                  prepend-icon="mdi-heart-pulse"
                  @click="handleNavigationClick"
                  >Health</v-list-item
                >
              </v-list-group>
            </client-only>

            <v-list-item
              to="/documentation"
              prepend-icon="mdi-book-open-variant"
              @click="handleNavigationClick"
              >Docs</v-list-item
            >
          </v-list>
        </v-navigation-drawer>
      </client-only>
      <v-main>
        <slot />
      </v-main>

      <!-- Footer -->
      <v-footer class="app-footer">
        <v-container>
          <!-- Main Footer Content -->
          <v-row>
            <!-- Company Info -->
            <v-col cols="12" md="4">
              <v-row align="center" no-gutters class="mb-4">
                <v-avatar size="32" color="primary" class="mr-2">
                  <span class="text-white text-caption font-weight-bold">CL</span>
                </v-avatar>
                <span class="text-h6 font-weight-bold">Cloudless Wizard</span>
              </v-row>
              <p class="text-body-2 text-medium-emphasis mb-4">
                Create, configure, and deploy intelligent AI bots for your applications with our
                comprehensive platform.
              </p>
              <client-only>
                <template #fallback>
                  <div class="d-flex align-center">
                    <v-chip color="grey" class="mr-2" label small>
                      <v-icon left size="14">mdi-cancel</v-icon>
                      Offline
                    </v-chip>
                  </div>
                </template>
                <div class="d-flex align-center">
                  <v-chip v-if="isAuthenticated" color="success" class="mr-2" label small>
                    <v-icon left size="14">mdi-check-circle</v-icon>
                    Online
                  </v-chip>
                  <v-chip v-else color="grey" class="mr-2" label small>
                    <v-icon left size="14">mdi-cancel</v-icon>
                    Offline
                  </v-chip>
                </div>
              </client-only>
            </v-col>

            <!-- Quick Links -->
            <v-col cols="12" md="2">
              <h6 class="text-subtitle-2 font-weight-bold mb-3">Company</h6>
              <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item to="/about" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-information</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">About</v-list-item-title>
                </v-list-item>
                <v-list-item to="/contact" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-email</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Contact</v-list-item-title>
                </v-list-item>
                <v-list-item to="/blog" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-post</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Blog</v-list-item-title>
                </v-list-item>
                <v-list-item to="/careers" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-briefcase</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Careers</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-col>

            <!-- Support -->
            <v-col cols="12" md="2">
              <h6 class="text-subtitle-2 font-weight-bold mb-3">Support</h6>
              <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item to="/support" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-lifebuoy</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Support</v-list-item-title>
                </v-list-item>
                <v-list-item to="/faq" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-help-circle</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">FAQ</v-list-item-title>
                </v-list-item>
                <v-list-item to="/community" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-account-group</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Community</v-list-item-title>
                </v-list-item>
                <v-list-item to="/pricing" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-currency-usd</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Pricing</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-col>

            <!-- Legal -->
            <v-col cols="12" md="2">
              <h6 class="text-subtitle-2 font-weight-bold mb-3">Legal</h6>
              <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item to="/terms" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-file-document</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Terms</v-list-item-title>
                </v-list-item>
                <v-list-item to="/privacy" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-shield-lock</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Privacy</v-list-item-title>
                </v-list-item>
                <v-list-item to="/cookies" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-cookie</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Cookies</v-list-item-title>
                </v-list-item>
                <v-list-item to="/sitemap" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-sitemap</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Sitemap</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-col>

            <!-- Resources -->
            <v-col cols="12" md="2">
              <h6 class="text-subtitle-2 font-weight-bold mb-3">Resources</h6>
              <v-list density="compact" class="bg-transparent pa-0">
                <v-list-item to="/documentation" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-book-open-variant</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Documentation</v-list-item-title>
                </v-list-item>
                <v-list-item to="/tutorials" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-video</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">Tutorials</v-list-item-title>
                </v-list-item>
                <v-list-item to="/api-reference" class="pa-0" min-height="32">
                  <template #prepend>
                    <v-icon size="16" class="mr-2">mdi-api</v-icon>
                  </template>
                  <v-list-item-title class="text-body-2">API Reference</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-col>
          </v-row>

          <!-- Footer Bottom -->
          <v-divider class="my-4"></v-divider>
          <v-row justify="space-between" align="center">
            <v-col cols="12" md="auto">
              <span class="text-body-2 text-medium-emphasis">
                &copy; 2024 Cloudless Wizard. All rights reserved.
              </span>
            </v-col>
            <v-col cols="12" md="auto">
              <client-only>
                <template #fallback>
                  <div class="d-flex align-center">
                    <v-btn
                      color="primary"
                      variant="outlined"
                      size="small"
                      to="/auth/login"
                      class="mr-2"
                    >
                      <v-icon size="16" class="mr-1">mdi-login</v-icon>
                      Login
                    </v-btn>
                  </div>
                </template>
                <div class="d-flex align-center">
                  <v-btn
                    v-if="!isAuthenticated"
                    color="primary"
                    variant="outlined"
                    size="small"
                    to="/auth/login"
                    class="mr-2"
                  >
                    <v-icon size="16" class="mr-1">mdi-login</v-icon>
                    Login
                  </v-btn>
                  <v-btn
                    v-if="isAuthenticated"
                    color="error"
                    variant="outlined"
                    size="small"
                    @click="handleLogout"
                    :loading="authLoading"
                  >
                    <v-icon size="16" class="mr-1">mdi-logout</v-icon>
                    Logout
                  </v-btn>
                </div>
              </client-only>
            </v-col>
          </v-row>
        </v-container>
      </v-footer>
    </v-container>
  </v-app>
</template>

<script setup lang="ts">
  import { navigateTo, useRoute, useRouter } from 'nuxt/app'
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import VantaControls from '~/components/ui/VantaControls.vue'
  import { useAuthStore } from '~/stores/authStore'

  // Route and router setup
  const route = useRoute()
  const router = useRouter()

  // Watch for route changes using Vue Router
  watch(
    () => route.path,
    newPath => {
      // Close mobile menu on route change
      if (showMobileMenu.value) {
        showMobileMenu.value = false
      }
    }
  )

  // Accessibility: detect prefers-reduced-motion
  const prefersReducedMotion = ref(false)

  // Initialize prefersReducedMotion only on client side to prevent hydration mismatch
  if (process.client) {
    prefersReducedMotion.value =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  const showVantaControls = ref(false)
  const showMobileMenu = ref(false)
  const activeDropdown = ref<string | null>(null)

  // Ensure mobile menu is closed on both server and client to prevent hydration mismatch
  showMobileMenu.value = false
  const vantaRef = ref<HTMLElement | null>(null)
  let vantaEffect: any = null
  const vantaEnabled = ref(false) // Start as false to prevent hydration issues
  const currentEffect = ref('clouds2')
  const vantaOptions = ref({
    // Clouds2 effect (default) - Optimal settings from vanta-master
    clouds2: {
      backgroundColor: '#000000',
      skyColor: '#5ca6ca',
      cloudColor: '#334d80',
      lightColor: '#ffffff',
      speed: 1.0,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Debug pages - more dramatic effects
    debug: {
      // Net effect for debug pages - Optimal settings
      net: {
        color: '#ff6b6b',
        backgroundColor: '#1a1a2e',
        points: 15.0,
        maxDistance: 25.0,
        spacing: 20.0,
        showDots: true,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        reducedMotion: prefersReducedMotion.value,
        quality: 1.0,
      },
      // Topology effect for debug pages - Optimal settings
      topology: {
        color: '#667eea',
        backgroundColor: '#0f0f23',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        reducedMotion: prefersReducedMotion.value,
        quality: 1.0,
      },
      // Waves effect for debug pages - Optimal settings
      waves: {
        color: '#4ecdc4',
        shininess: 27.0,
        waveHeight: 20.0,
        waveSpeed: 1.05,
        zoom: 0.65,
        backgroundColor: '#0f0f23',
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        reducedMotion: prefersReducedMotion.value,
        quality: 1.0,
      },
    },
    // Original clouds effect - Optimal settings
    clouds: {
      backgroundColor: '#000000',
      skyColor: '#5ca6ca',
      cloudColor: '#334d80',
      cloudShadowColor: '#1a1a1a',
      sunColor: '#ffffff',
      sunGlareColor: '#ffffff',
      sunlightColor: '#ffffff',
      speed: 1.0,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Cells effect - Optimal settings
    cells: {
      color1: '#ff6b6b',
      color2: '#4ecdc4',
      size: 1.0,
      speed: 1.0,
      backgroundColor: '#0f0f23',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Dots effect
    dots: {
      backgroundColor: '#0f0f23',
      dotSize: 1.0,
      dotSpeed: 1.0,
      elementColor: '#4ecdc4',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Fog effect
    fog: {
      backgroundColor: '#0f0f23',
      fogSpeed: 1.0,
      fogDensity: 1.0,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Globe effect
    globe: {
      backgroundColor: '#0f0f23',
      globeSize: 1.0,
      globeSpeed: 1.0,
      color1: '#ff6b6b',
      color2: '#4ecdc4',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Halo effect
    halo: {
      backgroundColor: '#0f0f23',
      haloSize: 1.0,
      haloSpeed: 1.0,
      color1: '#ff6b6b',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Ripple effect - Optimal settings
    ripple: {
      color1: '#ff6b6b',
      color2: '#4ecdc4',
      backgroundColor: '#0f0f23',
      amplitudeFactor: 1.0,
      ringFactor: 10.0,
      rotationFactor: 1.0,
      speed: 1.0,
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Rings effect
    rings: {
      backgroundColor: '#0f0f23',
      ringSize: 1.0,
      ringSpeed: 1.0,
      color1: '#ff6b6b',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Trunk effect
    trunk: {
      backgroundColor: '#0f0f23',
      trunkSize: 1.0,
      trunkSpeed: 1.0,
      color1: '#ff6b6b',
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      reducedMotion: prefersReducedMotion.value,
      quality: 1.0,
    },
    // Training pages - dynamic effects
    training: {
      // Birds effect for training pages - Optimal settings from vanta-master
      birds: {
        backgroundColor: '#07192F',
        color1: '#ff0000',
        color2: '#00d1ff',
        colorMode: 'varianceGradient',
        birdSize: 1.0,
        wingSpan: 30.0,
        speedLimit: 5.0,
        separation: 20.0,
        alignment: 20.0,
        cohesion: 20.0,
        quantity: 5.0,
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        reducedMotion: prefersReducedMotion.value,
        quality: 1.0,
      },
    },
  })

  declare global {
    interface Window {
      THREE?: any
      VANTA?: any
    }
  }

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
      document.head.appendChild(script)
    })
  }

  const hexToColor = (hex: string | number): number => {
    if (typeof hex === 'number') return hex
    if (typeof hex === 'string' && hex.startsWith('#')) {
      return parseInt(hex.replace('#', '0x'))
    }
    return 0x6a7ba2 // fallback color
  }

  let resizeTimeout: ReturnType<typeof setTimeout> | null = null
  const debouncedResize = () => {
    if (resizeTimeout) clearTimeout(resizeTimeout)
    resizeTimeout = setTimeout(() => {
      if (vantaEffect && typeof vantaEffect.resize === 'function') {
        vantaEffect.resize()
      }
    }, 200)
  }

  const destroyVanta = () => {
    if (vantaEffect) {
      try {
        vantaEffect.destroy()
      } catch (error) {
        // console.warn('Error destroying Vanta effect:', error)
      }
      vantaEffect = null
    }
  }

  const smoothTransition = async () => {
    if (!vantaRef.value) return

    // Add transitioning class for smooth fade out
    vantaRef.value.classList.add('transitioning')

    // Wait for transition to complete
    await new Promise(resolve => setTimeout(resolve, 400))

    // Remove transitioning class
    vantaRef.value.classList.remove('transitioning')
  }

  const initVanta = async () => {
    if (!process.client) return

    // Start smooth transition
    await smoothTransition()

    destroyVanta()

    if (!vantaEnabled.value || !vantaRef.value) {
      return
    }

    try {
      // Load Three.js first
      await loadScript('/vanta/three.min.js')

      // Wait a bit for Three.js to initialize
      await new Promise(resolve => setTimeout(resolve, 100))

      // Load the appropriate Vanta effect script
      const effectScripts = {
        clouds2: '/vanta/vanta.clouds2.min.js',
        clouds: '/vanta/vanta.clouds.min.js',
        birds: '/vanta/vanta.birds.min.js',
        cells: '/vanta/vanta.cells.min.js',
        dots: '/vanta/vanta.dots.min.js',
        fog: '/vanta/vanta.fog.min.js',
        globe: '/vanta/vanta.globe.min.js',
        halo: '/vanta/vanta.halo.min.js',
        net: '/vanta/vanta.net.min.js',
        ripple: '/vanta/vanta.ripple.min.js',
        rings: '/vanta/vanta.rings.min.js',
        topology: '/vanta/vanta.topology.min.js',
        trunk: '/vanta/vanta.trunk.min.js',
        waves: '/vanta/vanta.waves.min.js',
      }

      const scriptPath = effectScripts[currentEffect.value as keyof typeof effectScripts]
      if (scriptPath) {
        await loadScript(scriptPath)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // Check if everything is loaded
      if (!window.THREE) {
        return
      }

      const effectOptions = getEffectOptions(currentEffect.value)

      // Initialize the appropriate Vanta effect
      switch (currentEffect.value) {
        case 'clouds2':
          if (!window.VANTA?.CLOUDS2) {
            return
          }
          vantaEffect = window.VANTA.CLOUDS2({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            skyColor: hexToColor(effectOptions.skyColor),
            cloudColor: hexToColor(effectOptions.cloudColor),
            lightColor: hexToColor(effectOptions.lightColor),
            speed: effectOptions.reducedMotion ? 0.2 : effectOptions.speed,
            cloudHeight: effectOptions.cloudHeight,
            cloudDensity: effectOptions.cloudDensity,
            cloudScale: effectOptions.cloudScale,
            lightDirection: effectOptions.lightDirection,
            lightIntensity: effectOptions.lightIntensity,
          })
          break

        case 'net':
          if (!window.VANTA?.NET) {
            return
          }
          vantaEffect = window.VANTA.NET({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            points: effectOptions.points,
            maxDistance: effectOptions.maxDistance,
            spacing: effectOptions.spacing,
            showLines: effectOptions.showLines,
            lineColor: hexToColor(effectOptions.lineColor),
            pointColor: hexToColor(effectOptions.pointColor),
          })
          break

        case 'topology':
          if (!window.VANTA?.TOPOLOGY) {
            return
          }
          vantaEffect = window.VANTA.TOPOLOGY({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            points: effectOptions.points,
            maxDistance: effectOptions.maxDistance,
            spacing: effectOptions.spacing,
            showLines: effectOptions.showLines,
            lineColor: hexToColor(effectOptions.lineColor),
            pointColor: hexToColor(effectOptions.pointColor),
          })
          break

        case 'waves':
          if (!window.VANTA?.WAVES) {
            return
          }
          vantaEffect = window.VANTA.WAVES({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            waveHeight: effectOptions.waveHeight,
            shininess: effectOptions.shininess,
            waveSpeed: effectOptions.waveSpeed,
            zoom: effectOptions.zoom,
            waveColor: hexToColor(effectOptions.waveColor),
          })
          break

        case 'birds':
          if (!window.VANTA?.BIRDS) {
            return
          }
          vantaEffect = window.VANTA.BIRDS({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            color1: hexToColor(effectOptions.color1),
            color2: hexToColor(effectOptions.color2),
            colorMode: effectOptions.colorMode,
            birdSize: effectOptions.birdSize,
            wingSpan: effectOptions.wingSpan,
            speedLimit: effectOptions.speedLimit,
            separation: effectOptions.separation,
            alignment: effectOptions.alignment,
            cohesion: effectOptions.cohesion,
            quantity: effectOptions.quantity,
          })
          break

        case 'clouds':
          if (!window.VANTA?.CLOUDS) {
            return
          }
          vantaEffect = window.VANTA.CLOUDS({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            skyColor: hexToColor(effectOptions.skyColor),
            cloudColor: hexToColor(effectOptions.cloudColor),
            lightColor: hexToColor(effectOptions.lightColor),
            speed: effectOptions.reducedMotion ? 0.2 : effectOptions.speed,
            cloudHeight: effectOptions.cloudHeight,
            cloudDensity: effectOptions.cloudDensity,
            cloudScale: effectOptions.cloudScale,
            lightDirection: effectOptions.lightDirection,
            lightIntensity: effectOptions.lightIntensity,
          })
          break

        case 'cells':
          if (!window.VANTA?.CELLS) {
            return
          }
          vantaEffect = window.VANTA.CELLS({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            cellSize: effectOptions.cellSize,
            speed: effectOptions.reducedMotion ? 0.2 : effectOptions.cellSpeed,
            color1: hexToColor(effectOptions.color1),
            color2: hexToColor(effectOptions.color2),
            elementColor: hexToColor(effectOptions.elementColor),
          })
          break

        case 'dots':
          if (!window.VANTA?.DOTS) {
            return
          }
          vantaEffect = window.VANTA.DOTS({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            color: hexToColor(effectOptions.color),
            colorMode: effectOptions.colorMode,
            size: effectOptions.size,
            showLines: effectOptions.showLines,
            spacing: effectOptions.spacing,
          })
          break

        case 'fog':
          if (!window.VANTA?.FOG) {
            return
          }
          vantaEffect = window.VANTA.FOG({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            highlightColor: hexToColor(effectOptions.highlightColor),
            midtoneColor: hexToColor(effectOptions.midtoneColor),
            lowlightColor: hexToColor(effectOptions.lowlightColor),
            baseColor: hexToColor(effectOptions.baseColor),
            blurFactor: effectOptions.blurFactor,
            speed: effectOptions.reducedMotion ? 0.2 : effectOptions.speed,
            zoom: effectOptions.zoom,
          })
          break

        case 'globe':
          if (!window.VANTA?.GLOBE) {
            return
          }
          vantaEffect = window.VANTA.GLOBE({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            color: hexToColor(effectOptions.color),
            color2: hexToColor(effectOptions.color2),
            size: effectOptions.size,
            points: effectOptions.points,
            maxDistance: effectOptions.maxDistance,
            spacing: effectOptions.spacing,
            showLines: effectOptions.showLines,
            lineColor: hexToColor(effectOptions.lineColor),
            pointColor: hexToColor(effectOptions.pointColor),
          })
          break

        case 'halo':
          if (!window.VANTA?.HALO) {
            return
          }
          vantaEffect = window.VANTA.HALO({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            amplitudeFactor: effectOptions.amplitudeFactor,
            baseColor: hexToColor(effectOptions.baseColor),
            baseColorOpacity: effectOptions.baseColorOpacity,
            curveDefinition: effectOptions.curveDefinition,
            mouseEase: effectOptions.mouseEase,
            xOffset: effectOptions.xOffset,
            yOffset: effectOptions.yOffset,
          })
          break

        case 'ripple':
          if (!window.VANTA?.RIPPLE) {
            return
          }
          vantaEffect = window.VANTA.RIPPLE({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            color: hexToColor(effectOptions.color),
            shininess: effectOptions.shininess,
            waveHeight: effectOptions.waveHeight,
            waveSpeed: effectOptions.waveSpeed,
            zoom: effectOptions.zoom,
          })
          break

        case 'rings':
          if (!window.VANTA?.RINGS) {
            return
          }
          vantaEffect = window.VANTA.RINGS({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            color: hexToColor(effectOptions.color),
            color2: hexToColor(effectOptions.color2),
            size: effectOptions.size,
            points: effectOptions.points,
            maxDistance: effectOptions.maxDistance,
            spacing: effectOptions.spacing,
            showLines: effectOptions.showLines,
            lineColor: hexToColor(effectOptions.lineColor),
            pointColor: hexToColor(effectOptions.pointColor),
          })
          break

        case 'trunk':
          if (!window.VANTA?.TRUNK) {
            return
          }
          vantaEffect = window.VANTA.TRUNK({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            backgroundColor: hexToColor(effectOptions.backgroundColor),
            color: hexToColor(effectOptions.color),
            color2: hexToColor(effectOptions.color2),
            size: effectOptions.size,
            points: effectOptions.points,
            maxDistance: effectOptions.maxDistance,
            spacing: effectOptions.spacing,
            showLines: effectOptions.showLines,
            lineColor: hexToColor(effectOptions.lineColor),
            pointColor: hexToColor(effectOptions.pointColor),
          })
          break

        default:
          // Default to clouds2
          if (!window.VANTA?.CLOUDS2) {
            return
          }
          vantaEffect = window.VANTA.CLOUDS2({
            el: vantaRef.value,
            THREE: window.THREE,
            mouseControls: effectOptions.mouseControls,
            touchControls: effectOptions.touchControls,
            gyroControls: effectOptions.gyroControls,
            minHeight: 200.0,
            minWidth: 200.0,
            skyColor: hexToColor(effectOptions.skyColor),
            cloudColor: hexToColor(effectOptions.cloudColor),
            lightColor: hexToColor(effectOptions.lightColor),
            speed: effectOptions.reducedMotion ? 0.2 : effectOptions.speed,
            cloudHeight: effectOptions.cloudHeight,
            cloudDensity: effectOptions.cloudDensity,
            cloudScale: effectOptions.cloudScale,
            lightDirection: effectOptions.lightDirection,
            lightIntensity: effectOptions.lightIntensity,
          })
      }

      // Set up resize handler for the effect
      if (vantaEffect && vantaEffect.resize) {
        vantaEffect.resize = debouncedResize
      }
    } catch (error) {
      // Handle initialization errors silently
    }
  }

  const onVantaUpdate = (opts: any) => {
    if (!process.client) return

    vantaEnabled.value = opts.enabled

    // Handle effect change
    if (opts.selectedEffect && opts.selectedEffect !== currentEffect.value) {
      currentEffect.value = opts.selectedEffect
      nextTick(() => {
        initVanta()
      })
      return
    }

    // Update the current effect's options
    const effectOptions = getEffectOptions(currentEffect.value)
    Object.assign(effectOptions, opts)

    if (vantaEffect && opts.enabled) {
      // Update existing effect immediately
      try {
        // Force immediate update by destroying and recreating
        if (vantaEffect.destroy) {
          vantaEffect.destroy()
        }
        nextTick(() => {
          initVanta()
        })
      } catch (error) {
        // Reinitialize if update fails
        nextTick(() => {
          initVanta()
        })
      }
    } else if (opts.enabled) {
      // Initialize if not enabled but should be
      nextTick(() => {
        initVanta()
      })
    } else {
      // Destroy if disabled
      destroyVanta()
    }
  }

  const toggleDropdown = (dropdown: string) => {
    if (process.client) {
      activeDropdown.value = activeDropdown.value === dropdown ? null : dropdown
    }
  }

  const toggleMobileMenu = () => {
    if (process.client) {
      showMobileMenu.value = !showMobileMenu.value
    }
  }

  const closeMobileMenu = () => {
    if (process.client) {
      showMobileMenu.value = false
    }
  }

  const handleNavigationClick = () => {
    // Close mobile menu when navigation item is clicked
    if (process.client && window.innerWidth < 960) {
      showMobileMenu.value = false
    }
  }

  // Watch for vanta options changes
  watch(
    vantaOptions,
    () => {
      if (vantaEffect && vantaEnabled.value) {
        try {
          const effectOptions = getEffectOptions(currentEffect.value)
          vantaEffect.setOptions(effectOptions)
        } catch (error) {
          // console.warn('Error updating Vanta options from watch:', error)
        }
      }
    },
    { deep: true }
  )

  onMounted(async () => {
    // Wait for next tick to ensure DOM is ready
    await nextTick()

    // Initialize auth state on client side to prevent hydration mismatch
    const authStore = useAuthStore()
    authStore.initializeAuth()

    // Wait a bit more for auth initialization to complete
    await new Promise(resolve => setTimeout(resolve, 200))

    // Enable Vanta after component is mounted to prevent hydration issues
    vantaEnabled.value = true

    // Set appropriate effect for current route
    currentEffect.value = getEffectForRoute(window.location.pathname)

    const effectOptions = getEffectOptions(currentEffect.value)
    if (effectOptions.reducedMotion) {
      vantaEnabled.value = false
    }

    // Initialize with a small delay to ensure DOM is ready
    setTimeout(() => {
      initVanta()
    }, 500)

    window.addEventListener('resize', debouncedResize)

    // Watch for route changes to update effect and close mobile menu
    watch(
      () => window.location.pathname,
      newPath => {
        const newEffect = getEffectForRoute(newPath)
        if (newEffect !== currentEffect.value) {
          currentEffect.value = newEffect
          initVanta()
        }

        // Close mobile menu on route change
        if (showMobileMenu.value) {
          showMobileMenu.value = false
        }
      }
    )

    // Force a re-render after auth initialization with a longer delay
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'))
    }, 300)
  })

  onBeforeUnmount(() => {
    destroyVanta()
    window.removeEventListener('resize', debouncedResize)
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
    }
  })

  const toggleVantaControls = () => {
    if (process.client && vantaEnabled.value) {
      showVantaControls.value = !showVantaControls.value
    }
  }

  const closeVantaControls = () => {
    if (process.client) {
      showVantaControls.value = false
    }
  }

  const toggleBuildDropdown = () => {
    if (process.client) toggleDropdown('build')
  }
  const toggleAiDropdown = () => {
    if (process.client) toggleDropdown('ai')
  }
  const toggleOpsDropdown = () => {
    if (process.client) toggleDropdown('ops')
  }
  const toggleAdminDropdown = () => {
    if (process.client) toggleDropdown('admin')
  }

  // Use hydration-safe authentication state
  const { isClient, isAuthenticated, user, authLoading, isAdmin } = useHydrationSafeAuth()

  // Auth button handlers
  const handleLogout = async () => {
    if (!process.client) return

    try {
      const authStore = useAuthStore()
      await authStore.logout()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  const handleLogin = () => {
    if (process.client) {
      navigateTo('/auth/login')
    }
  }

  // Ensure consistent initial state for all reactive variables
  const ensureConsistentState = () => {
    // Ensure mobile menu is always closed initially
    showMobileMenu.value = false

    // Ensure Vanta is disabled initially
    vantaEnabled.value = false

    // Ensure Vanta controls are hidden initially
    showVantaControls.value = false
  }

  // Call this on both server and client to ensure consistent state
  ensureConsistentState()

  const getEffectForRoute = (route: string) => {
    // Layout-only page - use clouds2 for best visibility
    if (route.includes('/layout-only')) {
      return 'clouds2'
    }

    // Debug pages - use dramatic effects
    if (route.startsWith('/debug')) {
      const debugEffects = ['net', 'topology', 'waves']
      return debugEffects[Math.floor(Math.random() * debugEffects.length)]
    }

    // Training pages - use dynamic effects
    if (route.includes('/train') || route.includes('/training')) {
      return 'birds'
    }

    // LLM pages - use tech-focused effects
    if (route.startsWith('/llm')) {
      return 'net'
    }

    // Default to clouds2 for other pages
    return 'clouds2'
  }

  const getEffectOptions = (effect: string): any => {
    switch (effect) {
      case 'clouds':
        return vantaOptions.value.clouds
      case 'net':
        return vantaOptions.value.debug.net
      case 'topology':
        return vantaOptions.value.debug.topology
      case 'waves':
        return vantaOptions.value.debug.waves
      case 'birds':
        return vantaOptions.value.training.birds
      case 'cells':
        return vantaOptions.value.cells
      case 'dots':
        return vantaOptions.value.dots
      case 'fog':
        return vantaOptions.value.fog
      case 'globe':
        return vantaOptions.value.globe
      case 'halo':
        return vantaOptions.value.halo
      case 'ripple':
        return vantaOptions.value.ripple
      case 'rings':
        return vantaOptions.value.rings
      case 'trunk':
        return vantaOptions.value.trunk
      default:
        return vantaOptions.value.clouds2
    }
  }
</script>

<style scoped>
  .app-footer {
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border-top: 1px solid rgba(255, 255, 255, 0.2);
    position: relative;
    z-index: 1;
  }

  @media (max-width: 768px) {
    .app-footer .v-row {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
  }
</style>

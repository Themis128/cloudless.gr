<template>
  <v-app>
    <div
      v-show="vantaEnabled"
      ref="vantaRef"
      id="vanta-bg"
      class="vanta-bg"
    ></div>
    <button
      class="vanta-toggle-btn"
      @click="showVantaControls = !showVantaControls"
      aria-label="Toggle Vanta Controls"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
      </svg>
    </button>
    <client-only>
      <VantaControls
        v-if="showVantaControls"
        :initial="vantaOptions"
        @update="onVantaUpdate"
        @close="showVantaControls = false"
      />
    </client-only>
    <div class="app-layout">
      <header class="app-header">
        <div class="header-content">
          <div class="logo-row">
            <NuxtLink to="/" class="logo-link">
              <div class="logo-container">
                <svg
                  width="40"
                  height="40"
                  viewBox="0 0 48 48"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  class="logo"
                >
                  <rect width="48" height="48" rx="12" fill="#23232b"></rect>
                  <circle cx="24" cy="24" r="14" fill="#fff"></circle>
                  <text
                    x="24"
                    y="28"
                    text-anchor="middle"
                    font-size="14"
                    font-weight="700"
                    fill="#23232b"
                    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  >
                    CL
                  </text>
                </svg>
              </div>
              <span class="wizard-hat-emoji">🧙‍♂️</span>
              <h1 class="logo-text">Cloudless Wizard</h1>
            </NuxtLink>
          </div>

          <nav class="nav-menu">
            <div class="nav-dropdown">
              <button class="nav-dropdown-btn" @click="toggleDropdown('build')">
                <v-icon size="16">mdi-tools</v-icon>
                <span>Build</span>
                <v-icon size="14" class="dropdown-arrow"
                  >mdi-chevron-down</v-icon
                >
              </button>
              <div
                class="nav-dropdown-menu"
                v-show="activeDropdown === 'build'"
              >
                <NuxtLink to="/projects" class="dropdown-item">
                  <v-icon size="16">mdi-folder-multiple</v-icon>
                  <span>Projects</span>
                </NuxtLink>
                <NuxtLink to="/bots" class="dropdown-item">
                  <v-icon size="16">mdi-robot</v-icon>
                  <span>Bots</span>
                </NuxtLink>
                <NuxtLink to="/models" class="dropdown-item">
                  <v-icon size="16">mdi-brain</v-icon>
                  <span>Models</span>
                </NuxtLink>
                <NuxtLink to="/pipelines" class="dropdown-item">
                  <v-icon size="16">mdi-timeline</v-icon>
                  <span>Pipelines</span>
                </NuxtLink>
              </div>
            </div>

            <div class="nav-dropdown">
              <button class="nav-dropdown-btn" @click="toggleDropdown('ai')">
                <v-icon size="16">mdi-robot</v-icon>
                <span>AI</span>
                <v-icon size="14" class="dropdown-arrow"
                  >mdi-chevron-down</v-icon
                >
              </button>
              <div class="nav-dropdown-menu" v-show="activeDropdown === 'ai'">
                <NuxtLink to="/llm" class="dropdown-item">
                  <v-icon size="16">mdi-brain</v-icon>
                  <span>LLM</span>
                </NuxtLink>
                <NuxtLink to="/llm/train" class="dropdown-item">
                  <v-icon size="16">mdi-school</v-icon>
                  <span>Training</span>
                </NuxtLink>
              </div>
            </div>

            <div class="nav-dropdown">
              <button class="nav-dropdown-btn" @click="toggleDropdown('ops')">
                <v-icon size="16">mdi-server</v-icon>
                <span>Ops</span>
                <v-icon size="14" class="dropdown-arrow"
                  >mdi-chevron-down</v-icon
                >
              </button>
              <div class="nav-dropdown-menu" v-show="activeDropdown === 'ops'">
                <NuxtLink to="/deploy" class="dropdown-item">
                  <v-icon size="16">mdi-rocket-launch</v-icon>
                  <span>Deploy</span>
                </NuxtLink>
                <NuxtLink to="/dashboard" class="dropdown-item">
                  <v-icon size="16">mdi-view-dashboard</v-icon>
                  <span>Dashboard</span>
                </NuxtLink>
                <NuxtLink to="/debug" class="dropdown-item">
                  <v-icon size="16">mdi-bug</v-icon>
                  <span>Debug</span>
                </NuxtLink>
              </div>
            </div>

            <NuxtLink
              to="/documentation"
              class="nav-link"
              title="Documentation"
            >
              <v-icon size="16">mdi-book-open-variant</v-icon>
              <span>Docs</span>
            </NuxtLink>
          </nav>

          <!-- Mobile menu button -->
          <div class="mobile-menu-container">
            <v-btn
              icon
              variant="text"
              class="mobile-menu-btn"
              @click="showMobileMenu = !showMobileMenu"
              :aria-label="showMobileMenu ? 'Close menu' : 'Open menu'"
            >
              <v-icon>{{ showMobileMenu ? 'mdi-close' : 'mdi-menu' }}</v-icon>
            </v-btn>
          </div>
        </div>

        <!-- Mobile menu overlay -->
        <div v-if="showMobileMenu" class="mobile-menu">
          <div class="mobile-nav-group">
            <span class="mobile-nav-group-title">Build</span>
            <NuxtLink
              to="/projects"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-folder-multiple</v-icon>
              Projects
            </NuxtLink>
            <NuxtLink
              to="/bots"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-robot</v-icon>
              Bots
            </NuxtLink>
            <NuxtLink
              to="/models"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-brain</v-icon>
              Models
            </NuxtLink>
            <NuxtLink
              to="/pipelines"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-timeline</v-icon>
              Pipelines
            </NuxtLink>
          </div>

          <div class="mobile-nav-group">
            <span class="mobile-nav-group-title">AI</span>
            <NuxtLink
              to="/llm"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-brain</v-icon>
              LLM
            </NuxtLink>
            <NuxtLink
              to="/llm/train"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-school</v-icon>
              Training
            </NuxtLink>
          </div>

          <div class="mobile-nav-group">
            <span class="mobile-nav-group-title">Operations</span>
            <NuxtLink
              to="/deploy"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-rocket-launch</v-icon>
              Deploy
            </NuxtLink>
            <NuxtLink
              to="/dashboard"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-view-dashboard</v-icon>
              Dashboard
            </NuxtLink>
            <NuxtLink
              to="/debug"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-bug</v-icon>
              Debug
            </NuxtLink>
          </div>

          <div class="mobile-nav-group">
            <span class="mobile-nav-group-title">Resources</span>
            <NuxtLink
              to="/documentation"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-book-open-variant</v-icon>
              Documentation
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-help-circle</v-icon>
              Support
            </NuxtLink>
            <NuxtLink
              to="/api-reference"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-api</v-icon>
              API Reference
            </NuxtLink>
            <NuxtLink
              to="/tutorials"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-school</v-icon>
              Tutorials
            </NuxtLink>
            <NuxtLink
              to="/community"
              class="mobile-nav-link"
              @click="showMobileMenu = false"
            >
              <v-icon size="20">mdi-account-group</v-icon>
              Community
            </NuxtLink>
          </div>
        </div>
      </header>
      <div class="wizard-body">
        <main class="app-main">
          <slot />
        </main>
      </div>
      <footer class="app-footer">
        <div class="footer-gradient"></div>
        <div class="footer-content">
          <div class="footer-main">
            <div class="footer-brand-section">
              <div class="footer-logo">
                <div class="logo-container">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      width="48"
                      height="48"
                      rx="12"
                      fill="url(#gradient)"
                    ></rect>
                    <circle cx="24" cy="24" r="14" fill="#fff"></circle>
                    <text
                      x="50%"
                      y="54%"
                      text-anchor="middle"
                      font-size="16"
                      fill="#23232b"
                      font-family="Arial, Helvetica, sans-serif"
                      font-weight="600"
                    >
                      CL
                    </text>
                    <defs>
                      <linearGradient
                        id="gradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop
                          offset="0%"
                          style="stop-color: #667eea; stop-opacity: 1"
                        />
                        <stop
                          offset="100%"
                          style="stop-color: #764ba2; stop-opacity: 1"
                        />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div class="brand-info">
                  <h3 class="footer-brand">Cloudless Wizard</h3>
                  <p class="footer-tagline">AI-Powered Cloud Solutions</p>
                </div>
              </div>
              <p class="footer-description">
                Empowering developers with intelligent, scalable cloud
                infrastructure and AI-driven automation tools.
              </p>
              <div class="footer-stats">
                <div class="stat-item">
                  <span class="stat-number">99.9%</span>
                  <span class="stat-label">Uptime</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number">10K+</span>
                  <span class="stat-label">Deployments</span>
                </div>
                <div class="stat-item">
                  <span class="stat-number">24/7</span>
                  <span class="stat-label">Support</span>
                </div>
              </div>
            </div>

            <div class="footer-links-grid">
              <div class="footer-section">
                <h4 class="footer-section-title">
                  <v-icon size="16" class="section-icon"
                    >mdi-rocket-launch</v-icon
                  >
                  Build
                </h4>
                <ul class="footer-links">
                  <li>
                    <NuxtLink to="/bots" class="footer-link"
                      >Bot Builder</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/models" class="footer-link"
                      >Model Training</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/pipelines" class="footer-link"
                      >Pipeline Creator</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/llm" class="footer-link"
                      >LLM Management</NuxtLink
                    >
                  </li>
                </ul>
              </div>

              <div class="footer-section">
                <h4 class="footer-section-title">
                  <v-icon size="16" class="section-icon">mdi-tools</v-icon>
                  Tools
                </h4>
                <ul class="footer-links">
                  <li>
                    <NuxtLink to="/debug" class="footer-link"
                      >Debug Tools</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/deploy" class="footer-link"
                      >Deployment</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/projects" class="footer-link"
                      >Projects</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/dashboard" class="footer-link"
                      >Dashboard</NuxtLink
                    >
                  </li>
                </ul>
              </div>

              <div class="footer-section">
                <h4 class="footer-section-title">
                  <v-icon size="16" class="section-icon"
                    >mdi-book-open-variant</v-icon
                  >
                  Resources
                </h4>
                <ul class="footer-links">
                  <li>
                    <NuxtLink to="/documentation" class="footer-link"
                      >Documentation</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/support" class="footer-link"
                      >Support</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/api-reference" class="footer-link"
                      >API Reference</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/tutorials" class="footer-link"
                      >Tutorials</NuxtLink
                    >
                  </li>
                  <li>
                    <NuxtLink to="/community" class="footer-link"
                      >Community</NuxtLink
                    >
                  </li>
                </ul>
              </div>

              <div class="footer-section">
                <h4 class="footer-section-title">
                  <v-icon size="16" class="section-icon"
                    >mdi-account-group</v-icon
                  >
                  Company
                </h4>
                <ul class="footer-links">
                  <li><a href="#" class="footer-link">About Us</a></li>
                  <li><a href="#" class="footer-link">Careers</a></li>
                  <li><a href="#" class="footer-link">Blog</a></li>
                  <li><a href="#" class="footer-link">Contact</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div class="footer-connect">
            <div class="newsletter-section">
              <h4>Stay Updated</h4>
              <p>Get the latest updates on new features and improvements</p>
              <div class="newsletter-form">
                <v-text-field
                  placeholder="Enter your email"
                  variant="outlined"
                  density="compact"
                  hide-details
                  class="newsletter-input"
                />
                <v-btn
                  color="primary"
                  variant="elevated"
                  class="newsletter-btn"
                >
                  Subscribe
                </v-btn>
              </div>
            </div>

            <div class="social-section">
              <h4>Connect With Us</h4>
              <div class="social-links">
                <a href="#" class="social-link" aria-label="GitHub">
                  <div class="social-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                      />
                    </svg>
                  </div>
                </a>
                <a href="#" class="social-link" aria-label="Discord">
                  <div class="social-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                      />
                    </svg>
                  </div>
                </a>
                <a href="#" class="social-link" aria-label="Twitter">
                  <div class="social-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
                      />
                    </svg>
                  </div>
                </a>
                <a href="#" class="social-link" aria-label="LinkedIn">
                  <div class="social-icon">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path
                        d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                      />
                    </svg>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div class="footer-bottom">
          <div class="footer-bottom-content">
            <div class="footer-bottom-left">
              <span class="copyright"
                >&copy; 2025 Cloudless Wizard. All rights reserved.</span
              >
              <div class="footer-badges">
                <span class="badge">Made with ❤️</span>
                <span class="badge">Powered by AI</span>
              </div>
            </div>
            <div class="footer-bottom-links">
              <NuxtLink to="/privacy" class="footer-bottom-link"
                >Privacy Policy</NuxtLink
              >
              <NuxtLink to="/terms" class="footer-bottom-link"
                >Terms of Service</NuxtLink
              >
              <NuxtLink to="/cookies" class="footer-bottom-link"
                >Cookie Policy</NuxtLink
              >
              <NuxtLink to="/support" class="footer-bottom-link"
                >Support</NuxtLink
              >
            </div>
          </div>
        </div>
      </footer>
    </div>
  </v-app>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VantaControls from '~/components/ui/VantaControls.vue'

// Accessibility: detect prefers-reduced-motion
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const showVantaControls = ref(false)
const showMobileMenu = ref(false)
const activeDropdown = ref<string | null>(null)
const vantaRef = ref<HTMLElement | null>(null)
let vantaEffect: any = null
const vantaEnabled = ref(true)
const vantaOptions = ref({
  speed: 1.2,
  cloudHeight: 0.8,
  cloudDensity: 1.0,
  cloudScale: 1.0,
  lightDirection: 1.2,
  lightIntensity: 1.0,
  skyColor: '#6a7ba2',
  cloudColor: '#e0e6ef',
  lightColor: '#ffffff',
  mouseControls: true,
  touchControls: true,
  gyroControls: false,
  reducedMotion: prefersReducedMotion,
  quality: 1.0,
})

declare global {
  interface Window {
    THREE?: any
    VANTA?: any
  }
}

function loadScript(src: string): Promise<void> {
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

function hexToColor(hex: string | number): number {
  if (typeof hex === 'number') return hex
  if (typeof hex === 'string' && hex.startsWith('#')) {
    return parseInt(hex.replace('#', '0x'))
  }
  return 0x6a7ba2 // fallback color
}

let resizeTimeout: ReturnType<typeof setTimeout> | null = null
function debouncedResize() {
  if (resizeTimeout) clearTimeout(resizeTimeout)
  resizeTimeout = setTimeout(() => {
    if (vantaEffect && typeof vantaEffect.resize === 'function') {
      vantaEffect.resize()
    }
  }, 200)
}

function destroyVanta() {
  if (vantaEffect) {
    try {
      vantaEffect.destroy()
    } catch (error) {
      console.warn('Error destroying Vanta effect:', error)
    }
    vantaEffect = null
  }
}

async function initVanta() {
  if (!process.client) return

  destroyVanta()

  if (!vantaEnabled.value || !vantaRef.value) return

  try {
    // Load Three.js first
    await loadScript('/vanta/three.min.js')

    // Wait a bit for Three.js to initialize
    await new Promise(resolve => setTimeout(resolve, 100))

    // Load Vanta Clouds2
    await loadScript('/vanta/vanta.clouds2.min.js')

    // Wait a bit for Vanta to initialize
    await new Promise(resolve => setTimeout(resolve, 100))

    // Check if everything is loaded
    if (!window.THREE) {
      console.error('THREE.js not loaded')
      return
    }

    if (!window.VANTA || !window.VANTA.CLOUDS2) {
      console.error('VANTA.CLOUDS2 not loaded')
      return
    }

    // Initialize Vanta effect
    vantaEffect = window.VANTA.CLOUDS2({
      el: vantaRef.value,
      THREE: window.THREE,
      mouseControls: vantaOptions.value.mouseControls,
      touchControls: vantaOptions.value.touchControls,
      gyroControls: vantaOptions.value.gyroControls,
      minHeight: 200.0,
      minWidth: 200.0,
      skyColor: hexToColor(vantaOptions.value.skyColor),
      cloudColor: hexToColor(vantaOptions.value.cloudColor),
      lightColor: hexToColor(vantaOptions.value.lightColor),
      speed: vantaOptions.value.reducedMotion ? 0.2 : vantaOptions.value.speed,
      cloudHeight: vantaOptions.value.cloudHeight,
      cloudDensity: vantaOptions.value.cloudDensity,
      cloudScale: vantaOptions.value.cloudScale,
      lightDirection: vantaOptions.value.lightDirection,
      lightIntensity: vantaOptions.value.lightIntensity,
      // texturePath: '/vanta/gallery/noise.png'
    })

    console.log('Vanta CLOUDS2 initialized successfully')
  } catch (error) {
    console.error('Error initializing Vanta:', error)
  }
}

function onVantaUpdate(opts: any) {
  vantaEnabled.value = opts.enabled
  vantaOptions.value = { ...vantaOptions.value, ...opts }

  if (vantaEffect && opts.enabled) {
    // Update existing effect
    try {
      vantaEffect.setOptions({
        speed: opts.reducedMotion ? 0.2 : opts.speed,
        skyColor: hexToColor(opts.skyColor),
        cloudColor: hexToColor(opts.cloudColor),
        lightColor: hexToColor(opts.lightColor),
        cloudHeight: opts.cloudHeight,
        cloudDensity: opts.cloudDensity,
        cloudScale: opts.cloudScale,
        lightDirection: opts.lightDirection,
        lightIntensity: opts.lightIntensity,
        mouseControls: opts.mouseControls,
        touchControls: opts.touchControls,
        gyroControls: opts.gyroControls,
      })
    } catch (error) {
      console.warn('Error updating Vanta options:', error)
      // Reinitialize if update fails
      initVanta()
    }
  } else {
    // Reinitialize
    initVanta()
  }
}

function toggleDropdown(dropdown: string) {
  if (activeDropdown.value === dropdown) {
    activeDropdown.value = null
  } else {
    activeDropdown.value = dropdown
  }
}

// Watch for vanta options changes
watch(
  vantaOptions,
  newOptions => {
    if (vantaEffect && vantaEnabled.value) {
      try {
        vantaEffect.setOptions({
          speed: newOptions.reducedMotion ? 0.2 : newOptions.speed,
          skyColor: hexToColor(newOptions.skyColor),
          cloudColor: hexToColor(newOptions.cloudColor),
          lightColor: hexToColor(newOptions.lightColor),
          cloudHeight: newOptions.cloudHeight,
          cloudDensity: newOptions.cloudDensity,
          cloudScale: newOptions.cloudScale,
          lightDirection: newOptions.lightDirection,
          lightIntensity: newOptions.lightIntensity,
          mouseControls: newOptions.mouseControls,
          touchControls: newOptions.touchControls,
          gyroControls: newOptions.gyroControls,
        })
      } catch (error) {
        console.warn('Error updating Vanta options from watch:', error)
      }
    }
  },
  { deep: true }
)

onMounted(() => {
  if (vantaOptions.value.reducedMotion) {
    vantaEnabled.value = false
  }

  // Initialize with a small delay to ensure DOM is ready
  setTimeout(() => {
    initVanta()
  }, 500)

  window.addEventListener('resize', debouncedResize)
})

onBeforeUnmount(() => {
  destroyVanta()
  window.removeEventListener('resize', debouncedResize)
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }
})
</script>

<style scoped>
.vanta-bg {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.vanta-noise {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  opacity: 0.12;
  object-fit: cover;
  pointer-events: none;
  z-index: 1;
}

.vanta-toggle-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 99999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  pointer-events: auto;
  isolation: isolate;
}

.vanta-toggle-btn:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  transform: translateY(-2px);
}

.vanta-toggle-btn svg {
  color: #333;
}

.app-layout {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
}

.app-header {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.98) 0%,
    rgba(248, 250, 252, 0.98) 100%
  );
  backdrop-filter: blur(25px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow:
    0 4px 32px rgba(0, 0, 0, 0.08),
    0 1px 0 rgba(255, 255, 255, 0.3) inset;
  position: sticky;
  top: 0;
  z-index: 9998;
  transition: all 0.3s ease;
}

.app-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(102, 126, 234, 0.3) 50%,
    transparent 100%
  );
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2rem;
  padding: 1.25rem 2rem;
  max-width: 1400px;
  margin: 0 auto;
  position: relative;
}

.logo-row {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.logo-link {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  padding: 0.5rem;
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  min-height: 48px;
}

.logo-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  );
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.logo-link:hover::before {
  opacity: 1;
}

.logo-link:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 8px 25px rgba(102, 126, 234, 0.15);
}

.logo-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.3s ease;
}

.logo-container::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1),
    rgba(118, 75, 162, 0.1)
  );
  border-radius: 14px;
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: -1;
}

.logo-link:hover .logo-container::after {
  opacity: 1;
}

.logo {
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
  border-radius: 12px;
  overflow: hidden;
}

.logo-link:hover .logo {
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3));
  transform: scale(1.05);
}

.wizard-hat-emoji {
  font-size: 2.25rem;
  animation: float 4s ease-in-out infinite;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
  transition: all 0.3s ease;
}

.logo-link:hover .wizard-hat-emoji {
  animation: float 2s ease-in-out infinite;
  filter: drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3));
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }
  25% {
    transform: translateY(-8px) rotate(2deg);
  }
  50% {
    transform: translateY(-12px) rotate(0deg);
  }
  75% {
    transform: translateY(-8px) rotate(-2deg);
  }
}

.logo-text {
  font-size: 1.75rem;
  font-weight: 800;
  background: linear-gradient(135deg, #1a1a1a 0%, #4a5568 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  letter-spacing: -0.5px;
  transition: all 0.3s ease;
  font-family:
    'Inter',
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    sans-serif;
  line-height: 1.2;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.logo-link:hover .logo-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(102, 126, 234, 0.2);
  transform: translateX(2px);
}

.nav-menu {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.5rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  flex-wrap: wrap;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.nav-group::after {
  content: '';
  position: absolute;
  right: -0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 20px;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(0, 0, 0, 0.1) 50%,
    transparent 100%
  );
}

.nav-group:last-child::after {
  display: none;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.75);
  font-size: 0.8rem;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid transparent;
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.nav-text {
  display: inline;
}

.nav-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  transition: left 0.5s ease;
}

.nav-link:hover::before {
  left: 100%;
}

.nav-link:hover {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  );
  color: rgba(0, 0, 0, 0.95);
  transform: translateY(-2px);
  box-shadow:
    0 4px 16px rgba(102, 126, 234, 0.15),
    0 1px 0 rgba(255, 255, 255, 0.3) inset;
  border-color: rgba(102, 126, 234, 0.2);
}

.nav-link.router-link-active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    0 6px 20px rgba(102, 126, 234, 0.3),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
  font-weight: 700;
  transform: translateY(-1px);
}

.nav-link.router-link-active::before {
  display: none;
}

.mobile-menu-container {
  margin-left: auto;
}

.nav-dropdown {
  position: relative;
}

.nav-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  color: rgba(0, 0, 0, 0.75);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  white-space: nowrap;
}

.nav-dropdown-btn:hover {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  );
  color: rgba(0, 0, 0, 0.95);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
  border-color: rgba(102, 126, 234, 0.2);
}

.dropdown-arrow {
  transition: transform 0.3s ease;
}

.nav-dropdown-btn:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.nav-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  padding: 0.5rem;
  z-index: 9999;
  margin-top: 0.5rem;
  animation: dropdownFadeIn 0.2s ease-out;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.dropdown-item:hover {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  );
  color: rgba(0, 0, 0, 0.95);
  border-color: rgba(102, 126, 234, 0.2);
  transform: translateX(4px);
}

/* Ensure dropdowns appear above Vuetify components */
.nav-dropdown {
  position: relative;
  z-index: 9999;
}

/* Override Vuetify z-index for app bar */
.v-app-bar,
.v-toolbar,
.v-toolbar__content {
  z-index: 1000 !important;
}

.mobile-menu-btn {
  display: none !important;
}

.mobile-menu-btn.v-btn {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.1) 0%,
    rgba(118, 75, 162, 0.1) 100%
  ) !important;
  border: 1px solid rgba(102, 126, 234, 0.2) !important;
  border-radius: 12px !important;
  color: rgba(0, 0, 0, 0.8) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  min-width: 48px !important;
  min-height: 48px !important;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1) !important;
}

.mobile-menu-btn.v-btn:hover {
  background: linear-gradient(
    135deg,
    rgba(102, 126, 234, 0.15) 0%,
    rgba(118, 75, 162, 0.15) 100%
  ) !important;
  color: rgba(0, 0, 0, 0.95) !important;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2) !important;
  transform: translateY(-1px) !important;
}

/* Responsive Design */
@media (max-width: 1400px) {
  .header-content {
    padding: 1rem 1.5rem;
    max-width: 100%;
  }

  .nav-menu {
    gap: 1rem;
  }

  .nav-link {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
  }
}

@media (max-width: 1200px) {
  .header-content {
    padding: 1rem;
  }

  .nav-menu {
    gap: 0.75rem;
  }

  .nav-group {
    gap: 0.375rem;
  }

  .nav-link {
    padding: 0.5rem 0.625rem;
    font-size: 0.7rem;
  }

  .nav-text {
    display: none;
  }

  .nav-link {
    min-width: 44px;
    justify-content: center;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 1rem;
    justify-content: space-between;
  }

  .logo-text {
    font-size: 1.5rem;
    letter-spacing: -0.3px;
  }

  .wizard-hat-emoji {
    font-size: 2rem;
  }

  .nav-menu {
    display: none !important;
  }

  .mobile-menu-btn {
    display: flex !important;
  }

  .logo-row {
    gap: 1rem;
  }

  .logo-link {
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .header-content {
    padding: 0.875rem;
  }

  .logo-text {
    font-size: 1.25rem;
    letter-spacing: -0.2px;
  }

  .wizard-hat-emoji {
    font-size: 1.75rem;
  }

  .logo {
    width: 32px;
    height: 32px;
  }
}

.mobile-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  padding: 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  z-index: 99;
  max-height: 80vh;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.mobile-nav-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.mobile-nav-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  text-decoration: none;
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.mobile-nav-link:hover {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.95);
}

.mobile-nav-link.router-link-active {
  background: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 1);
  border-color: rgba(0, 0, 0, 0.1);
}

.wizard-body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  padding: 2rem;
}

.app-footer {
  position: relative;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(248, 250, 252, 0.95) 100%
  );
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(0, 0, 0, 0.8);
  font-size: 0.875rem;
  margin-top: auto;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.footer-gradient {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(102, 126, 234, 0.3) 50%,
    transparent 100%
  );
}

.footer-content {
  padding: 2rem 2rem 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.footer-main {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 3rem;
  margin-bottom: 2rem;
}

.footer-brand-section {
  max-width: 400px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
}

.logo-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.footer-brand {
  font-size: 1.5rem;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.9);
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.footer-tagline {
  font-size: 0.875rem;
  color: rgba(0, 0, 0, 0.6);
  margin: 0;
  font-weight: 500;
}

.footer-description {
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.6;
  margin: 0 0 1.5rem 0;
  font-size: 0.9rem;
}

.footer-stats {
  display: flex;
  gap: 1.5rem;
  margin-top: 1rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.stat-number {
  font-size: 1.25rem;
  font-weight: 700;
  color: #667eea;
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(0, 0, 0, 0.6);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.footer-links-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

.footer-section {
  display: flex;
  flex-direction: column;
}

.footer-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: rgba(0, 0, 0, 0.9);
  font-size: 0.9rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  margin-top: 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-icon {
  color: #667eea;
}

.footer-links {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.footer-link {
  color: rgba(0, 0, 0, 0.7);
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  font-weight: 500;
  position: relative;
  padding-left: 0;
}

.footer-link:hover {
  color: #667eea;
  transform: translateX(4px);
}

.footer-link::before {
  content: '';
  position: absolute;
  left: -8px;
  top: 50%;
  width: 0;
  height: 2px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  transition: width 0.2s ease;
  transform: translateY(-50%);
}

.footer-link:hover::before {
  width: 4px;
}

.footer-connect {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  padding: 1.5rem 0;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.newsletter-section h4,
.social-section h4 {
  color: rgba(0, 0, 0, 0.9);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 0;
}

.newsletter-section p {
  color: rgba(0, 0, 0, 0.6);
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  margin-top: 0;
}

.newsletter-form {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
}

.newsletter-input {
  flex: 1;
}

.newsletter-btn {
  white-space: nowrap;
  height: 40px;
}

.social-links {
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
}

.social-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 12px;
  color: rgba(0, 0, 0, 0.7);
  text-decoration: none;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.social-icon {
  position: relative;
  z-index: 2;
  transition: transform 0.3s ease;
}

.social-link::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.social-link:hover {
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  border-color: rgba(102, 126, 234, 0.3);
}

.social-link:hover::before {
  opacity: 1;
}

.social-link:hover .social-icon {
  transform: scale(1.1);
}

.footer-bottom {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding: 1rem 2rem;
  background: rgba(255, 255, 255, 0.5);
}

.footer-bottom-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto;
  font-size: 0.8rem;
}

.footer-bottom-left {
  display: flex;
  align-items: center;
  gap: 2rem;
}

.copyright {
  color: rgba(0, 0, 0, 0.7);
  font-weight: 500;
}

.footer-badges {
  display: flex;
  gap: 1rem;
}

.badge {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
}

.footer-bottom-links {
  display: flex;
  gap: 2rem;
}

.footer-bottom-link {
  color: rgba(0, 0, 0, 0.6);
  text-decoration: none;
  transition: color 0.2s ease;
  font-weight: 500;
}

.footer-bottom-link:hover {
  color: #667eea;
}

/* Responsive design */
@media (max-width: 1200px) {
  .nav-menu {
    gap: 1.5rem;
  }

  .nav-group {
    gap: 0.25rem;
  }

  .nav-link {
    padding: 0.4rem 0.8rem;
    font-size: 0.8rem;
  }
}

@media (max-width: 1024px) {
  .nav-menu {
    display: none;
  }

  .mobile-menu-btn {
    display: flex !important;
  }

  .header-content {
    padding: 0.75rem 1.5rem;
  }
}

@media (max-width: 768px) {
  .header-content {
    padding: 0.75rem 1rem;
  }

  .logo-row {
    gap: 0.5rem;
  }

  .logo {
    width: 32px;
    height: 32px;
  }

  .logo-text {
    font-size: 1.1rem;
    letter-spacing: -0.1px;
  }

  .wizard-hat-emoji {
    font-size: 1.5rem;
  }

  .app-main {
    padding: 1rem;
  }

  .vanta-toggle-btn {
    bottom: 80px;
    right: 15px;
    width: 48px;
    height: 48px;
  }

  .mobile-menu {
    padding: 1rem;
  }

  .mobile-nav-link {
    padding: 1rem;
  }

  /* Footer responsive styles */
  .footer-content {
    padding: 1.5rem 1rem 1rem;
  }

  .footer-main {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .footer-brand-section {
    max-width: none;
    text-align: center;
  }

  .footer-logo {
    justify-content: center;
  }

  .footer-stats {
    justify-content: center;
    gap: 1.5rem;
  }

  .footer-links-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.5rem;
  }

  .footer-connect {
    grid-template-columns: 1fr;
    gap: 1.5rem;
    text-align: center;
  }

  .newsletter-form {
    flex-direction: column;
    align-items: stretch;
  }

  .social-links {
    justify-content: center;
  }

  .footer-bottom-content {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .footer-bottom-left {
    flex-direction: column;
    gap: 1rem;
  }

  .footer-badges {
    justify-content: center;
  }

  .footer-bottom-links {
    justify-content: center;
    flex-wrap: wrap;
    gap: 1rem;
  }
}

@media (max-width: 480px) {
  .header-content {
    padding: 0.5rem 0.75rem;
  }

  .logo {
    width: 28px;
    height: 28px;
  }

  .logo-text {
    font-size: 1rem;
    letter-spacing: 0px;
  }

  .wizard-hat-emoji {
    font-size: 1.25rem;
  }

  .app-main {
    padding: 0.75rem;
  }

  .mobile-menu {
    padding: 0.75rem;
  }

  .mobile-nav-link {
    padding: 0.875rem;
    font-size: 0.95rem;
  }

  .vanta-toggle-btn {
    bottom: 70px;
    right: 10px;
    width: 44px;
    height: 44px;
  }
}

@media (max-width: 360px) {
  .header-content {
    padding: 0.5rem;
  }

  .logo-text {
    font-size: 0.9rem;
    letter-spacing: 0.1px;
  }

  .wizard-hat-emoji {
    font-size: 1.1rem;
  }

  .app-main {
    padding: 0.5rem;
  }

  .mobile-nav-link {
    padding: 0.75rem;
    font-size: 0.9rem;
  }
}

/* Mobile-first responsive components */
.app-layout :deep(.v-card) {
  background: rgba(255, 255, 255, 0.98) !important;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  border-radius: 12px !important;
}

.app-layout :deep(.v-sheet) {
  background: rgba(255, 255, 255, 0.95) !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05) !important;
}

.app-layout :deep(.v-btn) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  transition: all 0.2s ease !important;
  min-height: 44px !important;
  border-radius: 8px !important;
}

.app-layout :deep(.v-btn:hover) {
  transform: translateY(-1px) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

.app-layout :deep(.v-chip) {
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1) !important;
  border-radius: 6px !important;
}

.app-layout :deep(.v-data-table) {
  background: rgba(255, 255, 255, 0.98) !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1) !important;
  border-radius: 12px !important;
}

.app-layout :deep(.v-alert) {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
  border: 1px solid rgba(0, 0, 0, 0.05) !important;
  border-radius: 8px !important;
}

/* Touch-friendly improvements */
.app-layout :deep(.v-list-item) {
  min-height: 48px !important;
  padding: 12px 16px !important;
}

.app-layout :deep(.v-text-field) {
  margin-bottom: 16px !important;
}

.app-layout :deep(.v-select) {
  margin-bottom: 16px !important;
}

/* Mobile scrollbar improvements */
.app-layout :deep(*::-webkit-scrollbar) {
  width: 4px !important;
  height: 4px !important;
}

.app-layout :deep(*::-webkit-scrollbar-track) {
  background: rgba(0, 0, 0, 0.05) !important;
}

.app-layout :deep(*::-webkit-scrollbar-thumb) {
  background: rgba(0, 0, 0, 0.2) !important;
  border-radius: 2px !important;
}

/* Responsive table improvements */
@media (max-width: 768px) {
  .app-layout :deep(.v-data-table) {
    font-size: 0.875rem !important;
  }

  .app-layout :deep(.v-data-table-header) {
    font-size: 0.8rem !important;
  }

  .app-layout :deep(.v-btn) {
    min-height: 40px !important;
    font-size: 0.875rem !important;
  }

  .app-layout :deep(.v-card-title) {
    font-size: 1.1rem !important;
    padding: 16px 16px 8px !important;
  }

  .app-layout :deep(.v-card-text) {
    padding: 8px 16px 16px !important;
  }
}

@media (max-width: 480px) {
  .app-layout :deep(.v-container) {
    padding: 8px !important;
  }

  .app-layout :deep(.v-row) {
    margin: 0 -4px !important;
  }

  .app-layout :deep(.v-col) {
    padding: 4px !important;
  }

  .app-layout :deep(.v-btn) {
    min-height: 36px !important;
    font-size: 0.8rem !important;
    padding: 0 12px !important;
  }

  .app-layout :deep(.v-card-title) {
    font-size: 1rem !important;
    padding: 12px 12px 6px !important;
  }

  .app-layout :deep(.v-card-text) {
    padding: 6px 12px 12px !important;
    font-size: 0.875rem !important;
  }
}
</style>

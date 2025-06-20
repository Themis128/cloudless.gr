<template>
  <div>
    <!-- Skip to main content link (for screen readers) -->
    <a href="#main-content" class="skip-link" @click="skipToContent"> Skip to main content </a>

    <!-- Accessibility Button -->
    <button
      ref="accessibilityButton"
      class="accessibility-btn"
      :style="btnStyle"
      :aria-label="menu ? 'Close accessibility menu' : 'Open accessibility menu'"
      :aria-expanded="menu"
      aria-describedby="accessibility-menu-description"
      type="button"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @keydown.enter="toggleMenu"
      @keydown.space.prevent="toggleMenu"
      @keydown.escape="closeMenu"
      @dblclick="onButtonDblClick"
    >
      <v-icon
        class="accessibility-icon"
        :size="32"
        :color="menu ? 'primary' : 'blue'"
        aria-hidden="true"
      >
        {{ menu ? 'mdi-close' : 'mdi-human-handsup' }}
      </v-icon>
      <span class="sr-only">{{ menu ? 'Close accessibility menu' : 'Open accessibility menu' }}</span>
    </button>

    <!-- Hidden description for screen readers -->
    <div id="accessibility-menu-description" class="sr-only">
      Accessibility menu with font size, contrast, animation, and reading options
    </div>

    <!-- Accessibility Menu -->
    <v-menu
      v-model="menu"
      :close-on-content-click="false"
      offset-y
      activator="parent"
      attach="body"
      eager
      transition="slide-y-transition"
    >
      <v-card class="accessibility-card" min-width="320" max-width="400">
        <v-card-title class="text-h5 pa-4 d-flex align-center">
          <v-icon color="primary" class="me-3">mdi-human-handsup</v-icon>
          Accessibility Options
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-0">
          <v-list density="comfortable">
            <!-- Font Size Controls -->
            <v-list-group value="font">
              <template #activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-format-font-size-increase">
                  <v-list-item-title>Font Size ({{ fontSize }}%)</v-list-item-title>
                </v-list-item>
              </template>

              <v-list-item class="px-6">
                <div class="d-flex align-center justify-space-between w-100">
                  <v-btn
                    icon
                    size="small"
                    variant="outlined"
                    :disabled="fontSize <= 70"
                    :aria-label="`Decrease font size. Current: ${fontSize}%`"
                    @click="decreaseFont"
                  >
                    <v-icon>mdi-minus</v-icon>
                  </v-btn>

                  <v-chip
                    :color="fontSize === 100 ? 'primary' : 'default'"
                    variant="outlined"
                    class="mx-2"
                  >
                    {{ fontSize }}%
                  </v-chip>

                  <v-btn
                    icon
                    size="small"
                    variant="outlined"
                    :disabled="fontSize >= 200"
                    :aria-label="`Increase font size. Current: ${fontSize}%`"
                    @click="increaseFont"
                  >
                    <v-icon>mdi-plus</v-icon>
                  </v-btn>
                </div>

                <v-btn
                  v-if="fontSize !== 100"
                  size="small"
                  variant="text"
                  color="secondary"
                  class="mt-2"
                  block
                  :aria-label="'Reset font size to default 100%'"
                  @click="resetFont"
                >
                  <v-icon start>mdi-refresh</v-icon>
                  Reset to Default
                </v-btn>
              </v-list-item>
            </v-list-group>

            <v-divider class="my-1" />

            <!-- Visual Accessibility -->
            <v-list-group value="visual">
              <template #activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-eye-settings">
                  <v-list-item-title>Visual Adjustments</v-list-item-title>
                </v-list-item>
              </template>

              <!-- High Contrast -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-contrast-box</v-icon>
                </template>
                <v-list-item-title>High Contrast Mode</v-list-item-title>
                <v-list-item-subtitle>Improves text readability</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="highContrast"
                    color="primary"
                    :aria-label="`Toggle high contrast mode. Currently ${highContrast ? 'enabled' : 'disabled'}`"
                    @change="toggleContrast"
                  />
                </template>
              </v-list-item>

              <!-- Dark Mode -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon :color="isDarkMode ? 'yellow' : 'primary'">
                    {{ isDarkMode ? 'mdi-weather-night' : 'mdi-white-balance-sunny' }}
                  </v-icon>
                </template>
                <v-list-item-title>{{ isDarkMode ? 'Light' : 'Dark' }} Mode</v-list-item-title>
                <v-list-item-subtitle>Reduces eye strain</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="isDarkMode"
                    color="primary"
                    :aria-label="`Switch to ${isDarkMode ? 'light' : 'dark'} mode`"
                    @change="toggleTheme"
                  />
                </template>
              </v-list-item>

              <!-- Underline Links -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-format-underline</v-icon>
                </template>
                <v-list-item-title>Underline All Links</v-list-item-title>
                <v-list-item-subtitle>Makes links more visible</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="underlineLinks"
                    color="primary"
                    :aria-label="`Toggle link underlines. Currently ${underlineLinks ? 'enabled' : 'disabled'}`"
                    @change="toggleUnderlineLinks"
                  />
                </template>
              </v-list-item>

              <!-- Large Cursor -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-cursor-default-click</v-icon>
                </template>
                <v-list-item-title>Large Cursor</v-list-item-title>
                <v-list-item-subtitle>Easier to see and track</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="largeCursor"
                    color="primary"
                    :aria-label="`Toggle large cursor. Currently ${largeCursor ? 'enabled' : 'disabled'}`"
                    @change="toggleLargeCursor"
                  />
                </template>
              </v-list-item>
            </v-list-group>

            <v-divider class="my-1" />

            <!-- Motion & Animation -->
            <v-list-group value="motion">
              <template #activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-motion-play-outline">
                  <v-list-item-title>Motion Settings</v-list-item-title>
                </v-list-item>
              </template>

              <!-- Pause Animations -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-pause-circle</v-icon>
                </template>
                <v-list-item-title>Reduce Motion</v-list-item-title>
                <v-list-item-subtitle>Disables animations and transitions</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="pauseAnimations"
                    color="primary"
                    :aria-label="`Toggle animation reduction. Currently ${pauseAnimations ? 'enabled' : 'disabled'}`"
                    @change="togglePauseAnimations"
                  />
                </template>
              </v-list-item>

              <!-- Pause Auto-play -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-play-pause</v-icon>
                </template>
                <v-list-item-title>Pause Auto-play</v-list-item-title>
                <v-list-item-subtitle>Stops automatic media playback</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="pauseAutoplay"
                    color="primary"
                    :aria-label="`Toggle auto-play pause. Currently ${pauseAutoplay ? 'enabled' : 'disabled'}`"
                    @change="togglePauseAutoplay"
                  />
                </template>
              </v-list-item>
            </v-list-group>

            <v-divider class="my-1" />

            <!-- Reading & Language -->
            <v-list-group value="reading">
              <template #activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-book-open-page-variant">
                  <v-list-item-title>Reading Assistance</v-list-item-title>
                </v-list-item>
              </template>

              <!-- Reading Guide -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-format-align-center</v-icon>
                </template>
                <v-list-item-title>Reading Guide</v-list-item-title>
                <v-list-item-subtitle>Highlights current line</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="readingGuide"
                    color="primary"
                    :aria-label="`Toggle reading guide. Currently ${readingGuide ? 'enabled' : 'disabled'}`"
                    @change="toggleReadingGuide"
                  />
                </template>
              </v-list-item>

              <!-- Reading Mask -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-select-inverse</v-icon>
                </template>
                <v-list-item-title>Reading Mask</v-list-item-title>
                <v-list-item-subtitle>Dims surrounding content</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="readingMask"
                    color="primary"
                    :aria-label="`Toggle reading mask. Currently ${readingMask ? 'enabled' : 'disabled'}`"
                    @change="toggleReadingMask"
                  />
                </template>
              </v-list-item>

              <!-- Text Spacing -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-format-line-spacing</v-icon>
                </template>
                <v-list-item-title>Increase Text Spacing</v-list-item-title>
                <v-list-item-subtitle>Improves readability</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="textSpacing"
                    color="primary"
                    :aria-label="`Toggle text spacing. Currently ${textSpacing ? 'enabled' : 'disabled'}`"
                    @change="toggleTextSpacing"
                  />
                </template>
              </v-list-item>
            </v-list-group>

            <v-divider class="my-1" />

            <!-- Quick Actions -->
            <v-list-group value="actions">
              <template #activator="{ props }">
                <v-list-item v-bind="props" prepend-icon="mdi-lightning-bolt">
                  <v-list-item-title>Quick Actions</v-list-item-title>
                </v-list-item>
              </template>

              <!-- Skip to Content -->
              <v-list-item class="px-6" @click="skipToContent">
                <template #prepend>
                  <v-icon color="primary">mdi-skip-next</v-icon>
                </template>
                <v-list-item-title>Skip to Main Content</v-list-item-title>
                <v-list-item-subtitle>Jump to main page content</v-list-item-subtitle>
              </v-list-item>

              <!-- Focus Outline -->
              <v-list-item class="px-6">
                <template #prepend>
                  <v-icon color="primary">mdi-focus-field</v-icon>
                </template>
                <v-list-item-title>Enhanced Focus</v-list-item-title>
                <v-list-item-subtitle>Stronger focus indicators</v-list-item-subtitle>
                <template #append>
                  <v-switch
                    v-model="enhancedFocus"
                    color="primary"
                    :aria-label="`Toggle enhanced focus indicators. Currently ${enhancedFocus ? 'enabled' : 'disabled'}`"
                    @change="toggleEnhancedFocus"
                  />
                </template>
              </v-list-item>

              <!-- Reset All -->
              <v-list-item class="px-6" @click="resetAllSettings">
                <template #prepend>
                  <v-icon color="warning">mdi-restore</v-icon>
                </template>
                <v-list-item-title>Reset All Settings</v-list-item-title>
                <v-list-item-subtitle>Return to default values</v-list-item-subtitle>
              </v-list-item>
            </v-list-group>
          </v-list>
        </v-card-text>

        <!-- Close Button -->
        <v-card-actions class="pa-4">
          <v-btn
            variant="text"
            size="small"
            prepend-icon="mdi-close"
            @click="closeMenu"
          >
            Close Menu
          </v-btn>
          <v-spacer />
          <v-btn
            variant="text"
            size="small"
            color="primary"
            prepend-icon="mdi-information"
            @click="showAccessibilityInfo"
          >
            Learn More
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>

    <!-- Accessibility Info Dialog -->
    <v-dialog v-model="infoDialog" max-width="600">
      <v-card>
        <v-card-title class="text-h5">
          <v-icon color="primary" class="me-2">mdi-information</v-icon>
          Accessibility Features
        </v-card-title>
        <v-card-text class="pa-6">
          <p class="text-body-1 mb-4">
            This website is designed to be accessible to everyone, including people with
            disabilities. We follow WCAG 2.1 AA guidelines and European Accessibility Act
            requirements.
          </p>

          <v-list density="compact">
            <v-list-item prepend-icon="mdi-keyboard">
              <v-list-item-title>Keyboard Navigation</v-list-item-title>
              <v-list-item-subtitle>Use Tab, Enter, Space, and Arrow keys to navigate</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-account-voice">
              <v-list-item-title>Screen Reader Support</v-list-item-title>
              <v-list-item-subtitle>Compatible with NVDA, JAWS, VoiceOver, and other assistive
                technologies</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-format-font">
              <v-list-item-title>Text Customization</v-list-item-title>
              <v-list-item-subtitle>Adjust font size, contrast, and spacing for better
                readability</v-list-item-subtitle>
            </v-list-item>
            <v-list-item prepend-icon="mdi-motion-pause">
              <v-list-item-title>Motion Control</v-list-item-title>
              <v-list-item-subtitle>Reduce or disable animations that may cause vestibular
                disorders</v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <p class="text-body-2 mt-4">
            <strong>Need help?</strong> Contact our accessibility team at
            <a href="mailto:accessibility@cloudless.gr">accessibility@cloudless.gr</a>
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="infoDialog = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useTheme } from 'vuetify';

// Menu state
const menu = ref(false);
const infoDialog = ref(false);
const accessibilityButton = ref<HTMLElement>();

// Accessibility settings
const fontSize = ref(100);
const highContrast = ref(false);
const underlineLinks = ref(false);
const pauseAnimations = ref(false);
const pauseAutoplay = ref(false);
const largeCursor = ref(false);
const readingGuide = ref(false);
const readingMask = ref(false);
const textSpacing = ref(false);
const enhancedFocus = ref(false);

// Theme management
const theme = useTheme();
const isDarkMode = computed({
  get: () => theme.global.name.value === 'dark',
  set: (value: boolean) => {
    theme.global.name.value = value ? 'dark' : 'light';
  },
});

// Draggable button state
const btnX = ref(32);
const btnY = ref(32);
const dragging = ref(false);
const offset = ref({ x: 0, y: 0 });

// Button positioning
const btnStyle = computed(() => {
  if (typeof window === 'undefined') {
    return {
      left: '32px',
      top: '32px',
      position: 'fixed' as const,
      zIndex: 2147483647,
    };
  }
  const x = Math.max(0, Math.min(window.innerWidth - 64, btnX.value || 32));
  const y = Math.max(0, Math.min(window.innerHeight - 64, btnY.value || 32));
  return {
    left: `${x}px`,
    top: `${y}px`,
    position: 'fixed' as const,
    zIndex: 2147483647,
  };
});

// Menu controls
const toggleMenu = () => {
  if (!dragging.value) {
    menu.value = !menu.value;
    if (menu.value) {
      nextTick(() => {
        // Announce menu opening to screen readers
        announceToScreenReader('Accessibility menu opened');
      });
    }
  }
};

const closeMenu = () => {
  menu.value = false;
  announceToScreenReader('Accessibility menu closed');
};

const showAccessibilityInfo = () => {
  infoDialog.value = true;
  closeMenu();
};

// Screen reader announcements
const announceToScreenReader = (message: string) => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Font size controls
const increaseFont = () => {
  const newSize = Math.min(fontSize.value + 10, 200);
  fontSize.value = newSize;
  document.documentElement.style.fontSize = newSize + '%';
  localStorage.setItem('fontSize', newSize.toString());
  announceToScreenReader(`Font size increased to ${newSize} percent`);
};

const decreaseFont = () => {
  const newSize = Math.max(fontSize.value - 10, 70);
  fontSize.value = newSize;
  document.documentElement.style.fontSize = newSize + '%';
  localStorage.setItem('fontSize', newSize.toString());
  announceToScreenReader(`Font size decreased to ${newSize} percent`);
};

const resetFont = () => {
  fontSize.value = 100;
  document.documentElement.style.fontSize = '100%';
  localStorage.setItem('fontSize', '100');
  announceToScreenReader('Font size reset to default');
};

// High contrast mode
const toggleContrast = () => {
  document.documentElement.classList.toggle('high-contrast', highContrast.value);
  localStorage.setItem('highContrast', highContrast.value.toString());
  announceToScreenReader(`High contrast ${highContrast.value ? 'enabled' : 'disabled'}`);
};

// Theme toggle
const toggleTheme = () => {
  localStorage.setItem('darkMode', isDarkMode.value.toString());
  announceToScreenReader(`${isDarkMode.value ? 'Dark' : 'Light'} mode enabled`);
};

// Link underlines
const toggleUnderlineLinks = () => {
  document.documentElement.classList.toggle('underline-links', underlineLinks.value);
  localStorage.setItem('underlineLinks', underlineLinks.value.toString());
  announceToScreenReader(`Link underlines ${underlineLinks.value ? 'enabled' : 'disabled'}`);
};

// Large cursor
const toggleLargeCursor = () => {
  document.documentElement.classList.toggle('large-cursor', largeCursor.value);
  localStorage.setItem('largeCursor', largeCursor.value.toString());
  announceToScreenReader(`Large cursor ${largeCursor.value ? 'enabled' : 'disabled'}`);
};

// Animation controls
const togglePauseAnimations = () => {
  document.documentElement.classList.toggle('reduce-motion', pauseAnimations.value);
  localStorage.setItem('pauseAnimations', pauseAnimations.value.toString());
  announceToScreenReader(`Animations ${pauseAnimations.value ? 'reduced' : 'enabled'}`);
};

const togglePauseAutoplay = () => {
  document.documentElement.classList.toggle('pause-autoplay', pauseAutoplay.value);
  localStorage.setItem('pauseAutoplay', pauseAutoplay.value.toString());
  announceToScreenReader(`Auto-play ${pauseAutoplay.value ? 'paused' : 'enabled'}`);
};

// Reading assistance
const toggleReadingGuide = () => {
  document.documentElement.classList.toggle('reading-guide', readingGuide.value);
  localStorage.setItem('readingGuide', readingGuide.value.toString());
  announceToScreenReader(`Reading guide ${readingGuide.value ? 'enabled' : 'disabled'}`);
};

const toggleReadingMask = () => {
  document.documentElement.classList.toggle('reading-mask', readingMask.value);
  localStorage.setItem('readingMask', readingMask.value.toString());
  announceToScreenReader(`Reading mask ${readingMask.value ? 'enabled' : 'disabled'}`);
};

const toggleTextSpacing = () => {
  document.documentElement.classList.toggle('text-spacing', textSpacing.value);
  localStorage.setItem('textSpacing', textSpacing.value.toString());
  announceToScreenReader(`Text spacing ${textSpacing.value ? 'increased' : 'normal'}`);
};

// Enhanced focus
const toggleEnhancedFocus = () => {
  document.documentElement.classList.toggle('enhanced-focus', enhancedFocus.value);
  localStorage.setItem('enhancedFocus', enhancedFocus.value.toString());
  announceToScreenReader(`Enhanced focus ${enhancedFocus.value ? 'enabled' : 'disabled'}`);
};

// Navigation
const skipToContent = () => {
  const main = document.querySelector(
    'main, [role="main"], #main-content, .main-content',
  ) as HTMLElement;
  if (main) {
    main.setAttribute('tabindex', '-1');
    main.focus();
    main.scrollIntoView({ behavior: 'smooth' });
    announceToScreenReader('Skipped to main content');
  }
  closeMenu();
};

// Reset all settings
const resetAllSettings = () => {
  // Reset all values
  fontSize.value = 100;
  highContrast.value = false;
  underlineLinks.value = false;
  pauseAnimations.value = false;
  pauseAutoplay.value = false;
  largeCursor.value = false;
  readingGuide.value = false;
  readingMask.value = false;
  textSpacing.value = false;
  enhancedFocus.value = false;
  isDarkMode.value = false;

  // Apply resets
  document.documentElement.style.fontSize = '100%';
  document.documentElement.className = document.documentElement.className
    .replace(
      /\b(high-contrast|underline-links|large-cursor|reduce-motion|pause-autoplay|reading-guide|reading-mask|text-spacing|enhanced-focus)\b/g,
      '',
    )
    .trim();

  // Clear localStorage
  const settingsKeys = [
    'fontSize',
    'highContrast',
    'underlineLinks',
    'pauseAnimations',
    'pauseAutoplay',
    'largeCursor',
    'readingGuide',
    'readingMask',
    'textSpacing',
    'enhancedFocus',
    'darkMode',
  ];
  settingsKeys.forEach((key) => localStorage.removeItem(key));

  announceToScreenReader('All accessibility settings reset to default');
};

// Double-click handler for accessibility button (left mouse only)
function onButtonDblClick(event: MouseEvent) {
  if (event.button === 0) {
    toggleMenu();
  }
}

// Drag functionality
const startDrag = (e: MouseEvent | TouchEvent) => {
  if (menu.value) return; // Don't drag when menu is open

  const startTime = Date.now();
  const startX = e instanceof MouseEvent ? e.clientX : e.touches[0].clientX;
  const startY = e instanceof MouseEvent ? e.clientY : e.touches[0].clientY;

  const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
    const currentX =
      moveEvent instanceof MouseEvent ? moveEvent.clientX : moveEvent.touches[0].clientX;
    const currentY =
      moveEvent instanceof MouseEvent ? moveEvent.clientY : moveEvent.touches[0].clientY;
    const distance = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));

    if (distance > 5) {
      dragging.value = true;
      offset.value = {
        x: startX - btnX.value,
        y: startY - btnY.value,
      };

      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('touchend', stopDrag);

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('touchend', onMouseUp);
    }
  };

  const onMouseUp = () => {
    const duration = Date.now() - startTime;
    if (duration < 200 && !dragging.value) {
      toggleMenu();
    }

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onMouseMove);
    document.removeEventListener('touchend', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onMouseMove);
  document.addEventListener('touchend', onMouseUp);
};

const drag = (e: MouseEvent | TouchEvent) => {
  if (!dragging.value || typeof window === 'undefined') return;

  const clientX = e instanceof MouseEvent ? e.clientX : e.touches[0]?.clientX;
  const clientY = e instanceof MouseEvent ? e.clientY : e.touches[0]?.clientY;

  if (clientX !== undefined && clientY !== undefined) {
    const newX = clientX - offset.value.x;
    const newY = clientY - offset.value.y;
    btnX.value = Math.max(0, Math.min(window.innerWidth - 64, newX));
    btnY.value = Math.max(0, Math.min(window.innerHeight - 64, newY));
  }
};

const stopDrag = () => {
  if (dragging.value) {
    localStorage.setItem('accessibilityBtnX', btnX.value.toString());
    localStorage.setItem('accessibilityBtnY', btnY.value.toString());
    setTimeout(() => {
      dragging.value = false;
    }, 100);
  }

  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
};

// Load saved settings
onMounted(() => {
  if (typeof window === 'undefined') return;

  // Position
  const savedX = localStorage.getItem('accessibilityBtnX');
  const savedY = localStorage.getItem('accessibilityBtnY');
  if (savedX && savedY) {
    btnX.value = parseInt(savedX);
    btnY.value = parseInt(savedY);
  } else {
    btnX.value = 32;
    btnY.value = window.innerHeight - 120;
  }

  // Font size
  const savedFont = localStorage.getItem('fontSize');
  if (savedFont) {
    fontSize.value = parseInt(savedFont);
    document.documentElement.style.fontSize = fontSize.value + '%';
  }

  // All boolean settings
  const booleanSettings = [
    'highContrast',
    'underlineLinks',
    'pauseAnimations',
    'pauseAutoplay',
    'largeCursor',
    'readingGuide',
    'readingMask',
    'textSpacing',
    'enhancedFocus',
  ];

  booleanSettings.forEach((setting) => {
    const saved = localStorage.getItem(setting);
    if (saved === 'true') {
      switch (setting) {
        case 'highContrast':
          highContrast.value = true;
          break;
        case 'underlineLinks':
          underlineLinks.value = true;
          break;
        case 'pauseAnimations':
          pauseAnimations.value = true;
          break;
        case 'pauseAutoplay':
          pauseAutoplay.value = true;
          break;
        case 'largeCursor':
          largeCursor.value = true;
          break;
        case 'readingGuide':
          readingGuide.value = true;
          break;
        case 'readingMask':
          readingMask.value = true;
          break;
        case 'textSpacing':
          textSpacing.value = true;
          break;
        case 'enhancedFocus':
          enhancedFocus.value = true;
          break;
      }
    }
  });

  // Dark mode
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode === 'true') {
    isDarkMode.value = true;
  }

  // Apply all settings
  nextTick(() => {
    if (highContrast.value) toggleContrast();
    if (underlineLinks.value) toggleUnderlineLinks();
    if (pauseAnimations.value) togglePauseAnimations();
    if (pauseAutoplay.value) togglePauseAutoplay();
    if (largeCursor.value) toggleLargeCursor();
    if (readingGuide.value) toggleReadingGuide();
    if (readingMask.value) toggleReadingMask();
    if (textSpacing.value) toggleTextSpacing();
    if (enhancedFocus.value) toggleEnhancedFocus();
  });
});

// Watchers for real-time updates
watch(highContrast, toggleContrast);
watch(underlineLinks, toggleUnderlineLinks);
watch(pauseAnimations, togglePauseAnimations);
watch(pauseAutoplay, togglePauseAutoplay);
watch(largeCursor, toggleLargeCursor);
watch(readingGuide, toggleReadingGuide);
watch(readingMask, toggleReadingMask);
watch(textSpacing, toggleTextSpacing);
watch(enhancedFocus, toggleEnhancedFocus);
watch(isDarkMode, toggleTheme);
</script>

<style scoped>
.accessibility-btn {
  position: fixed;
  z-index: 2147483647;
  cursor: grab;
  pointer-events: auto;
  border: none;
  background: transparent;
  padding: 0;
  border-radius: 50%;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.accessibility-btn:hover {
  transform: scale(1.05);
}

.accessibility-btn:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.accessibility-main-btn {
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.15),
    0 2px 6px rgba(0, 0, 0, 0.1) !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.accessibility-main-btn:hover {
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.2),
    0 3px 8px rgba(0, 0, 0, 0.15) !important;
}

.accessibility-card {
  border-radius: 16px !important;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 4px 16px rgba(0, 0, 0, 0.08) !important;
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

/* Modern floating accessibility button styles */
.accessibility-btn {
  position: fixed;
  left: 32px;
  top: 32px;
  z-index: 2147483647;
  border: none;
  outline: none;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.18);
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: box-shadow 0.2s, background 0.2s;
  padding: 0;
}
.accessibility-btn:focus {
  box-shadow: 0 0 0 3px #1976d2, 0 2px 12px 0 rgba(0,0,0,0.18);
}
.accessibility-btn:active {
  box-shadow: 0 4px 20px 0 rgba(25, 118, 210, 0.25);
}
.accessibility-icon {
  color: #1976d2 !important;
  font-size: 32px !important;
  transition: color 0.2s;
}
.accessibility-btn[aria-expanded="true"] .accessibility-icon {
  color: #1565c0 !important;
}
/* Removed duplicate .accessibility-card:focus-within::before selector */

.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: #000;
  color: #fff;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
  font-weight: 600;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 6px;
}

/* Screen reader only content */
.sr-only {
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}

/* Custom focus styles for better visibility */
:deep(.v-list-item:focus-visible),
:deep(.v-btn:focus-visible),
:deep(.v-switch:focus-visible) {
  outline: 2px solid #2196f3;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Smooth animations for list groups */
:deep(.v-list-group__items) {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Enhanced switch styling */
:deep(.v-switch .v-selection-control__input) {
  border-radius: 12px;
}

/* Better spacing for nested items */
:deep(.v-list-item.px-6) {
  padding-left: 2rem !important;
  padding-right: 1.5rem !important;
}

/* Icon alignment */
:deep(.v-list-item__prepend > .v-icon) {
  margin-inline-end: 12px;
}

/* Card title styling */
:deep(.v-card-title) {
  line-height: 1.2;
  font-weight: 600;
  /* (Merged into the earlier .accessibility-card block to avoid duplicate selector) */
}

.accessibility-card::before {
  content: '';
  position: absolute;
  inset: -2px;
  background: linear-gradient(45deg, transparent, rgba(33, 150, 243, 0.1), transparent);
  border-radius: 18px;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.accessibility-card:focus-within::before {
  opacity: 1;
}

/* Glassmorphism effect for v-card */
.glassmorph {
  background: rgba(255, 255, 255, 0.13) !important;
  border-radius: 18px !important;
  box-shadow: 0 16px 64px 0 rgba(31, 38, 135, 0.28) !important;
  backdrop-filter: blur(48px) saturate(300%) !important;
  -webkit-backdrop-filter: blur(48px) saturate(300%) !important;
  border: 2px solid rgba(255, 255, 255, 0.28) !important;
}
</style>

<!-- Global Accessibility Styles -->
<style>
/* High Contrast Mode */
html.high-contrast {
  filter: contrast(150%) brightness(120%);
}

html.high-contrast * {
  border-color: #000 !important;
  outline-color: #000 !important;
}

html.high-contrast .v-btn {
  border: 2px solid currentColor !important;
}

html.high-contrast .v-card {
  border: 2px solid currentColor !important;
}

/* Underline Links */
html.underline-links a,
html.underline-links .v-btn--variant-text,
html.underline-links .router-link-active {
  text-decoration: underline !important;
}

/* Large Cursor */
html.large-cursor,
html.large-cursor * {
  cursor:
    url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTIgMkwyIDMwTDEwIDIyTDE2IDI4TDIwIDI0TDE0IDE4TDIyIDEwTDIgMloiIGZpbGw9ImJsYWNrIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+'),
    auto !important;
}

html.large-cursor button,
html.large-cursor .v-btn,
html.large-cursor a,
html.large-cursor [role='button'] {
  cursor:
    url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1zbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDJMMTYgMTRMMjQgMTBMMTYgMTZMMjQgMjJMMTYgMThMMTYgMzBMMTAgMjJMMiAxNkwxMCAxMEwxNiAyWiIgZmlsbD0iYmx1ZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIi8+Cjwvc3ZnPg=='),
    pointer !important;
}

/* Reduced Motion */
html.reduce-motion *,
html.reduce-motion *::before,
html.reduce-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
  scroll-behavior: auto !important;
}

html.reduce-motion .v-progress-linear .v-progress-linear__indeterminate .long,
html.reduce-motion .v-progress-linear .v-progress-linear__indeterminate .short {
  animation: none !important;
}

/* Pause Autoplay */
/* No CSS property for autoplay; control via JS if needed */

/* No CSS property for autoplay; control via JS if needed */

/* Reading Guide */
html.reading-guide p:hover,
html.reading-guide .v-list-item:hover,
html.reading-guide .text-body-1:hover,
html.reading-guide .text-body-2:hover {
  background: rgba(33, 150, 243, 0.1) !important;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

/* Reading Mask */
html.reading-mask {
  position: relative;
}

html.reading-mask::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(transparent 45%, rgba(0, 0, 0, 0.8) 50%, transparent 55%);
  pointer-events: none;
  z-index: 1000;
  transition: all 0.3s ease;
}

/* Enhanced Text Spacing */
html.text-spacing {
  line-height: 1.8 !important;
  letter-spacing: 0.08em !important;
  word-spacing: 0.1em !important;
}

html.text-spacing p,
html.text-spacing .v-list-item-title,
html.text-spacing .v-list-item-subtitle,
html.text-spacing .text-body-1,
html.text-spacing .text-body-2 {
  line-height: 1.8 !important;
  letter-spacing: 0.08em !important;
  margin-bottom: 1em !important;
}

/* Enhanced Focus Indicators */
html.enhanced-focus *:focus-visible,
html.enhanced-focus .v-btn:focus,
html.enhanced-focus .v-list-item:focus,
html.enhanced-focus a:focus,
html.enhanced-focus button:focus,
html.enhanced-focus input:focus,
html.enhanced-focus select:focus,
html.enhanced-focus textarea:focus {
  outline: 3px solid #ffd700 !important;
  outline-offset: 3px !important;
  border-radius: 6px !important;
  box-shadow: 0 0 0 6px rgba(255, 215, 0, 0.3) !important;
  position: relative !important;
  z-index: 1001 !important;
}

/* Improved button focus for enhanced mode */
html.enhanced-focus .v-btn:focus::after {
  content: '';
  position: absolute;
  inset: -4px;
  border: 2px dashed #ffd700;
  border-radius: 8px;
  animation: focus-pulse 1.5s infinite;
}

@keyframes focus-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Dark mode adjustments for accessibility features */
.v-theme--dark.high-contrast {
  filter: contrast(200%) brightness(150%);
}

.v-theme--dark html.reading-guide p:hover,
.v-theme--dark html.reading-guide .v-list-item:hover {
  background: rgba(144, 202, 249, 0.2) !important;
}

/* Ensure accessibility button is always visible */
.accessibility-btn {
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
}

.accessibility-main-btn {
  background: rgba(255, 255, 255, 0.95) !important;
  backdrop-filter: blur(20px) !important;
}

.v-theme--dark .accessibility-main-btn {
  background: rgba(0, 0, 0, 0.95) !important;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .accessibility-card {
    margin: 8px;
    max-width: calc(100vw - 16px) !important;
    min-width: calc(100vw - 16px) !important;
  }

  .skip-link {
    left: 8px;
    right: 8px;
    text-align: center;
  }
}

/* Print styles */
@media print {
  .accessibility-btn,
  .accessibility-card,
  .skip-link {
    display: none !important;
  }
}
</style>

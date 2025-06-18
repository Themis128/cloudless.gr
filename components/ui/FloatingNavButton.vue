<template>
  <div
    ref="floatingButton"
    class="floating-nav-button"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
  >
    <!-- Main Floating Button -->
    <v-btn
      fab
      size="large"
      color="primary"
      elevation="8"
      class="main-button"
      @click="handleButtonClick"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <v-icon size="28">{{ isMenuOpen ? 'mdi-close' : 'mdi-menu' }}</v-icon>
    </v-btn>

    <!-- Debug info (remove in production) -->
    <div v-if="false" class="debug-info">Menu: {{ isMenuOpen }}, Dragging: {{ isDragging }}</div>

    <!-- Navigation Menu -->
    <v-scale-transition>
      <v-card v-if="isMenuOpen" class="nav-menu" elevation="12" rounded="lg">
        <v-card-title class="pb-2">
          <v-icon class="mr-2">mdi-navigation</v-icon>
          Quick Navigation
        </v-card-title>

        <v-divider />

        <v-list class="py-0" density="compact">
          <!-- Main Pages -->
          <v-list-subheader>Main</v-list-subheader>
          <v-list-item
            v-for="page in mainPages"
            :key="page.path"
            :to="page.path"
            :class="{ 'v-list-item--active': isActivePage(page.path) }"
            @click="closeMenu"
          >
            <template #prepend>
              <v-icon :color="isActivePage(page.path) ? 'primary' : undefined">{{
                page.icon
              }}</v-icon>
            </template>
            <v-list-item-title>{{ page.title }}</v-list-item-title>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- Project Pages -->
          <v-list-subheader>Projects</v-list-subheader>
          <v-list-item
            v-for="page in projectPages"
            :key="page.path"
            :to="page.path"
            :class="{ 'v-list-item--active': isActivePage(page.path) }"
            @click="closeMenu"
          >
            <template #prepend>
              <v-icon :color="isActivePage(page.path) ? 'primary' : undefined">{{
                page.icon
              }}</v-icon>
            </template>
            <v-list-item-title>{{ page.title }}</v-list-item-title>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- Auth Pages -->
          <v-list-subheader>Account</v-list-subheader>
          <v-list-item
            v-for="page in authPages"
            :key="page.path"
            :to="page.path"
            :class="{ 'v-list-item--active': isActivePage(page.path) }"
            @click="closeMenu"
          >
            <template #prepend>
              <v-icon :color="isActivePage(page.path) ? 'primary' : undefined">{{
                page.icon
              }}</v-icon>
            </template>
            <v-list-item-title>{{ page.title }}</v-list-item-title>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- User Pages (Protected) -->
          <v-list-subheader>User Dashboard</v-list-subheader>
          <v-list-item
            v-for="page in userPages"
            :key="page.path"
            :to="page.path"
            :class="{ 'v-list-item--active': isActivePage(page.path) }"
            @click="closeMenu"
          >
            <template #prepend>
              <v-icon :color="isActivePage(page.path) ? 'primary' : undefined">{{
                page.icon
              }}</v-icon>
            </template>
            <v-list-item-title>{{ page.title }}</v-list-item-title>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- Admin Pages (Protected) -->
          <v-list-subheader>Administration</v-list-subheader>
          <v-list-item
            v-for="page in adminPages"
            :key="page.path"
            :to="page.path"
            :class="{ 'v-list-item--active': isActivePage(page.path) }"
            @click="closeMenu"
          >
            <template #prepend>
              <v-icon :color="isActivePage(page.path) ? 'primary' : undefined">{{
                page.icon
              }}</v-icon>
            </template>
            <v-list-item-title>{{ page.title }}</v-list-item-title>
          </v-list-item>

          <v-divider class="my-2" />

          <!-- Info Pages -->
          <v-list-subheader>Information</v-list-subheader>
          <v-list-item
            v-for="page in infoPages"
            :key="page.path"
            :to="page.path"
            :class="{ 'v-list-item--active': isActivePage(page.path) }"
            @click="closeMenu"
          >
            <template #prepend>
              <v-icon :color="isActivePage(page.path) ? 'primary' : undefined">{{
                page.icon
              }}</v-icon>
            </template>
            <v-list-item-title>{{ page.title }}</v-list-item-title>
          </v-list-item>
        </v-list>

        <!-- Close Button -->
        <v-card-actions class="pt-0">
          <v-spacer />
          <v-btn variant="text" size="small" @click="closeMenu"> Close </v-btn>
        </v-card-actions>
      </v-card>
    </v-scale-transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';

interface NavPage {
  title: string;
  path: string;
  icon: string;
}

const floatingButton = ref<HTMLElement>();
const isMenuOpen = ref(false);
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

// Use the position composable
const { position, updatePosition } = useFloatingNavPosition();

// Get current route for highlighting active page
const route = useRoute();
const currentPath = computed(() => route.path);

// Navigation pages organized by category
const mainPages: NavPage[] = [
  { title: 'Dashboard', path: '/', icon: 'mdi-view-dashboard' },
  { title: 'Projects', path: '/projects', icon: 'mdi-brain' },
  { title: 'Storage', path: '/storage', icon: 'mdi-folder' },
  { title: 'Settings', path: '/settings', icon: 'mdi-cog' },
];

const projectPages: NavPage[] = [
  { title: 'All Projects', path: '/projects', icon: 'mdi-format-list-bulleted' },
  { title: 'Create Project', path: '/projects/create', icon: 'mdi-plus-circle' },
  { title: 'Project Templates', path: '/projects/templates', icon: 'mdi-file-document-multiple' },
  { title: 'Shared Projects', path: '/projects/shared', icon: 'mdi-share-variant' },
];

const adminPages: NavPage[] = [
  { title: 'Admin Dashboard', path: '/admin/dashboard', icon: 'mdi-shield-crown' },
  { title: 'Admin Panel', path: '/admin', icon: 'mdi-security' },
  { title: 'Admin Login', path: '/auth/admin-login', icon: 'mdi-shield-account' },
];

const userPages: NavPage[] = [
  { title: 'User Profile', path: '/users', icon: 'mdi-account-circle' },
  { title: 'Account Settings', path: '/users/account', icon: 'mdi-account-cog' },
  { title: 'Profile Settings', path: '/users/profile', icon: 'mdi-account-edit' },
  { title: 'User Activity', path: '/users/activity', icon: 'mdi-history' },
  { title: 'Notifications', path: '/users/notifications', icon: 'mdi-bell' },
  { title: 'User Directory', path: '/users/directory', icon: 'mdi-account-group' },
  { title: 'User Management', path: '/users/management', icon: 'mdi-account-cog-outline' },
  { title: 'User Roles', path: '/users/roles', icon: 'mdi-account-key' },
  { title: 'User Permissions', path: '/users/permissions', icon: 'mdi-shield-account' },
];

const authPages: NavPage[] = [
  { title: 'Login', path: '/auth', icon: 'mdi-login' },
  { title: 'Register', path: '/auth/register', icon: 'mdi-account-plus' },
  { title: 'Reset Password', path: '/auth/reset', icon: 'mdi-lock-reset' },
  { title: 'Auth Callback', path: '/auth/callback', icon: 'mdi-check-circle' },
];

const infoPages: NavPage[] = [
  { title: 'About', path: '/info/about', icon: 'mdi-information' },
  { title: 'Contact', path: '/info/contact', icon: 'mdi-email' },
  { title: 'FAQ', path: '/info/faq', icon: 'mdi-help-circle' },
  { title: 'Sitemap', path: '/info/sitemap', icon: 'mdi-sitemap' },
  { title: 'Matrix', path: '/info/matrix', icon: 'mdi-matrix' },
];

const handleButtonClick = (event: Event) => {
  console.log('🎯 BUTTON CLICKED!', event);
  event.stopPropagation();
  toggleMenu();
};

const toggleMenu = () => {
  console.log('🔥 Toggle menu function called!');
  console.log('🔍 isDragging.value:', isDragging.value);

  if (!isDragging.value) {
    console.log('✅ Toggling menu, current state:', isMenuOpen.value);
    isMenuOpen.value = !isMenuOpen.value;
    console.log('🎯 New menu state:', isMenuOpen.value);
  } else {
    console.log('❌ Cannot toggle menu - currently dragging');
  }
};

const closeMenu = () => {
  isMenuOpen.value = false;
};

const startDrag = (event: MouseEvent | TouchEvent) => {
  console.log('🖱️  Mouse/touch down event detected');

  if (isMenuOpen.value) {
    console.log('⏹️  Not starting drag - menu is open');
    return; // Don't drag when menu is open
  }

  // Wait a moment to see if this is a click or a drag
  const startTime = Date.now();
  const startX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
  const startY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

  const onMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
    const currentX =
      moveEvent instanceof MouseEvent ? moveEvent.clientX : moveEvent.touches[0].clientX;
    const currentY =
      moveEvent instanceof MouseEvent ? moveEvent.clientY : moveEvent.touches[0].clientY;

    const distance = Math.sqrt(Math.pow(currentX - startX, 2) + Math.pow(currentY - startY, 2));

    // If moved more than 5 pixels, start dragging
    if (distance > 5) {
      console.log('🏃 Starting drag - moved', distance, 'pixels');

      isDragging.value = true;

      // Add dragging class to disable pointer events during drag
      if (floatingButton.value) {
        floatingButton.value.classList.add('dragging');
      }

      dragOffset.value = {
        x: startX - position.value.x,
        y: startY - position.value.y,
      };

      document.addEventListener('mousemove', drag);
      document.addEventListener('mouseup', stopDrag);
      document.addEventListener('touchmove', drag);
      document.addEventListener('touchend', stopDrag);

      // Remove these temporary listeners
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('touchend', onMouseUp);
    }
  };

  const onMouseUp = () => {
    console.log('⏰ Mouse up - time elapsed:', Date.now() - startTime, 'ms');

    // Remove temporary listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('touchmove', onMouseMove);
    document.removeEventListener('touchend', onMouseUp);

    // If we didn't start dragging, this was a click
    if (!isDragging.value) {
      console.log('👆 This was a click, not a drag');
    }
  };

  // Add temporary listeners to detect drag vs click
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('touchmove', onMouseMove);
  document.addEventListener('touchend', onMouseUp);
};

const drag = (event: MouseEvent | TouchEvent) => {
  if (!isDragging.value) return;

  const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
  const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

  const newX = clientX - dragOffset.value.x;
  const newY = clientY - dragOffset.value.y;

  // Keep button within viewport bounds
  const maxX = window.innerWidth - 80;
  const maxY = window.innerHeight - 80;

  const newPosition = {
    x: Math.max(0, Math.min(newX, maxX)),
    y: Math.max(0, Math.min(newY, maxY)),
  };

  updatePosition(newPosition);
};

const stopDrag = () => {
  if (isDragging.value) {
    // Remove dragging class to re-enable pointer events
    if (floatingButton.value) {
      floatingButton.value.classList.remove('dragging');
    }

    // Small delay to prevent click event after drag
    setTimeout(() => {
      isDragging.value = false;
    }, 100);
  }

  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
};

// Close menu when clicking outside
const handleClickOutside = (event: Event) => {
  if (
    isMenuOpen.value &&
    floatingButton.value &&
    !floatingButton.value.contains(event.target as Node)
  ) {
    closeMenu();
  }
};

// Initialize position based on screen size
const initializePosition = () => {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  // Only update if current position is out of bounds
  if (position.value.x > screenWidth - 80 || position.value.y > screenHeight - 80) {
    updatePosition({
      x: Math.min(position.value.x, screenWidth - 100),
      y: Math.min(position.value.y, screenHeight - 150),
    });
  }
};

// Check if a page is currently active
const isActivePage = (path: string) => {
  return currentPath.value === path || currentPath.value.startsWith(path + '/');
};

onMounted(() => {
  initializePosition();
  document.addEventListener('click', handleClickOutside);
  window.addEventListener('resize', initializePosition);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
  window.removeEventListener('resize', initializePosition);
  document.removeEventListener('mousemove', drag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('touchmove', drag);
  document.removeEventListener('touchend', stopDrag);
});
</script>

<style scoped>
.floating-nav-button {
  position: fixed;
  z-index: 1000;
  user-select: none;
  cursor: move;
}

.main-button {
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  animation: pulse-on-load 2s ease-in-out 3;
}

.main-button:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
  animation: none;
}

@keyframes pulse-on-load {
  0%,
  100% {
    transform: scale(1);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 6px 25px rgba(0, 0, 0, 0.25);
  }
}

.nav-menu {
  position: absolute;
  top: 70px;
  right: 0;
  min-width: 280px;
  max-width: 320px;
  max-height: 500px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.nav-menu::-webkit-scrollbar {
  width: 6px;
}

.nav-menu::-webkit-scrollbar-track {
  background: transparent;
}

.nav-menu::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.nav-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

/* Dark theme support */
.theme--dark .nav-menu {
  background: rgba(33, 37, 41, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .nav-menu {
    min-width: 250px;
    max-width: 280px;
    top: 60px;
    right: -10px;
  }

  .main-button {
    width: 56px !important;
    height: 56px !important;
  }
}

/* Animation for smooth transitions */
.floating-nav-button:active .main-button {
  transform: scale(0.95);
}

/* Prevent text selection during drag, but allow button clicks */
.floating-nav-button.dragging * {
  pointer-events: none;
}

.floating-nav-button:not(.dragging) .main-button,
.floating-nav-button .nav-menu,
.floating-nav-button .nav-menu * {
  pointer-events: auto;
}
</style>

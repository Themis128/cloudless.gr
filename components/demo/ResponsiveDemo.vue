<template>
  <v-container fluid class="responsive-demo pa-6 pa-md-8">
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4" elevation="2">
          <v-card-title class="text-h4 font-weight-bold mb-6">Responsive Design Demo</v-card-title>

          <v-row>
            <!-- Device Type Cards -->
            <v-col cols="12">
              <v-row>
                <v-col v-for="(device, index) in devices" :key="index" cols="6" sm="3">
                  <v-card
                    :color="device.active ? 'primary' : 'grey-lighten-4'"
                    :class="{ 'on-active': device.active }"
                    class="pa-4 text-center transition-swing"
                    elevation="2"
                  >
                    <div class="text-h4 mb-2">{{ device.icon }}</div>
                    <v-card-title class="justify-center pa-0 text-body-1">{{
                      device.name
                    }}</v-card-title>
                    <v-card-subtitle class="pa-0 text-caption">
                      {{ device.active ? 'Active' : 'Inactive' }}
                    </v-card-subtitle>
                  </v-card>
                </v-col>
              </v-row>
            </v-col>

            <!-- Screen Information -->
            <v-col cols="12" md="6">
              <v-card class="pa-4 mt-4" variant="outlined">
                <v-card-title class="text-h6 font-weight-medium">Screen Information</v-card-title>

                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>Screen Width:</v-list-item-title>
                    <v-list-item-subtitle class="text-end">{{ width }}px</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <v-list-item-title>Screen Height:</v-list-item-title>
                    <v-list-item-subtitle class="text-end">{{ height }}px</v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <v-list-item-title>Orientation:</v-list-item-title>
                    <v-list-item-subtitle class="text-end">{{
                      isPortrait ? 'Portrait' : 'Landscape'
                    }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>

            <!-- Breakpoints Information -->
            <v-col cols="12" md="6">
              <v-card class="pa-4 mt-4" variant="outlined">
                <v-card-title class="text-h6 font-weight-medium">Breakpoints</v-card-title>

                <v-list density="compact">
                  <v-list-item>
                    <v-list-item-title>Mobile:</v-list-item-title>
                    <v-list-item-subtitle class="text-end"
                      >&lt; {{ breakpoints.mobile }}px</v-list-item-subtitle
                    >
                  </v-list-item>

                  <v-list-item>
                    <v-list-item-title>Tablet:</v-list-item-title>
                    <v-list-item-subtitle class="text-end"
                      >{{ breakpoints.mobile }}px -
                      {{ breakpoints.tablet - 1 }}px</v-list-item-subtitle
                    >
                  </v-list-item>

                  <v-list-item>
                    <v-list-item-title>Desktop:</v-list-item-title>
                    <v-list-item-subtitle class="text-end"
                      >{{ breakpoints.tablet }}px -
                      {{ breakpoints.desktop - 1 }}px</v-list-item-subtitle
                    >
                  </v-list-item>

                  <v-list-item>
                    <v-list-item-title>Large Desktop:</v-list-item-title>
                    <v-list-item-subtitle class="text-end"
                      >≥ {{ breakpoints.desktop }}px</v-list-item-subtitle
                    >
                  </v-list-item>
                </v-list>
              </v-card>
            </v-col>
          </v-row>

          <!-- Responsive Showcase -->
          <v-card-title class="text-h5 pt-8 pb-4">Content Showcase</v-card-title>
          <v-row>
            <v-col cols="12" md="4">
              <v-card
                :color="isMobile ? 'pink-lighten-4' : ''"
                :class="{ 'showcase-active': isMobile, 'showcase-inactive': !isMobile }"
                class="pa-4"
                elevation="2"
                height="100%"
              >
                <v-card-title class="pb-2" :class="isMobile ? 'text-white' : ''">
                  Mobile Content
                </v-card-title>
                <v-card-text>
                  <p>This content is optimized for mobile devices.</p>
                  <div class="d-flex mt-4">
                    <v-btn color="primary" class="mr-2">Click Me</v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="4">
              <v-card
                :color="isTablet ? 'blue-lighten-4' : ''"
                :class="{ 'showcase-active': isTablet, 'showcase-inactive': !isTablet }"
                class="pa-4"
                elevation="2"
                height="100%"
              >
                <v-card-title class="pb-2" :class="isTablet ? 'text-white' : ''">
                  Tablet Content
                </v-card-title>
                <v-card-text>
                  <p>This content appears differently on tablet screens.</p>
                  <div class="d-flex mt-4">
                    <v-btn color="primary" class="mr-2">Primary</v-btn>
                    <v-btn color="secondary">Secondary</v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <v-col cols="12" md="4">
              <v-card
                :color="isDesktop || isLargeDesktop ? 'teal-lighten-4' : ''"
                :class="{
                  'showcase-active': isDesktop || isLargeDesktop,
                  'showcase-inactive': !(isDesktop || isLargeDesktop),
                }"
                class="pa-4"
                elevation="2"
                height="100%"
              >
                <v-card-title class="pb-2" :class="isDesktop || isLargeDesktop ? 'text-white' : ''">
                  Desktop Content
                </v-card-title>
                <v-card-text>
                  <p>This content has additional features on desktop screens.</p>
                  <div class="d-flex flex-wrap mt-4">
                    <v-btn color="primary" class="mr-2 mb-2">Primary</v-btn>
                    <v-btn color="secondary" class="mr-2 mb-2">Secondary</v-btn>
                    <v-btn color="warning">Tertiary</v-btn>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { computed } from 'vue';
  import { useResponsive } from '~/composables/useResponsive';

  // Get responsive utilities
  const { width, height, isMobile, isTablet, isDesktop, isLargeDesktop, isPortrait, breakpoints } =
    useResponsive();

  // Create device status array for rendering cards
  const devices = computed(() => [
    {
      name: 'Mobile',
      icon: '📱',
      active: isMobile.value,
    },
    {
      name: 'Tablet',
      icon: '📔',
      active: isTablet.value,
    },
    {
      name: 'Desktop',
      icon: '💻',
      active: isDesktop.value,
    },
    {
      name: 'Large Desktop',
      icon: '🖥️',
      active: isLargeDesktop.value,
    },
  ]);
</script>

<style scoped>
  .showcase-active {
    transform: translateY(-4px);
    transition: all 0.3s ease;
  }

  .showcase-inactive {
    opacity: 0.6;
    transform: scale(0.98);
    transition: all 0.3s ease;
  }

  .on-active {
    transform: translateY(-4px);
    transition: all 0.3s ease;
  }

  @media (max-width: 767px) {
    .showcase-inactive {
      display: none;
    }
  }
</style>

<template>
  <div class="vuetify-demo">
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card class="mb-4">
            <v-card-title class="primary-text text-h4 font-weight-bold">
              Vuetify Components Demo
            </v-card-title>
            <v-card-text>
              <p class="text-body-1">
                This demo showcases various Vuetify components that you can use in your Nuxt 3
                application.
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Cards Section -->
      <v-row>
        <v-col cols="12">
          <h2 class="text-h5 mb-4">Cards with Actions</h2>
        </v-col>

        <v-col cols="12" md="4" v-for="(card, index) in cards" :key="index">
          <v-card height="100%">
            <v-img height="200" :src="card.image" cover></v-img>
            <v-card-title>{{ card.title }}</v-card-title>
            <v-card-text>{{ card.text }}</v-card-text>
            <v-card-actions>
              <v-btn color="primary" variant="tonal"> Details </v-btn>
              <v-spacer></v-spacer>
              <v-btn
                icon="mdi-heart"
                variant="text"
                @click="card.liked = !card.liked"
                :color="card.liked ? 'red' : undefined"
              ></v-btn>
              <v-btn icon="mdi-share-variant" variant="text"></v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>

      <!-- Buttons Section -->
      <v-row class="mt-8">
        <v-col cols="12">
          <h2 class="text-h5 mb-4">Buttons</h2>
          <v-card class="pa-4">
            <div class="d-flex flex-wrap gap-2">
              <v-btn color="primary">Primary</v-btn>
              <v-btn color="secondary">Secondary</v-btn>
              <v-btn color="accent">Accent</v-btn>
              <v-btn color="error">Error</v-btn>
              <v-btn color="warning">Warning</v-btn>
              <v-btn color="info">Info</v-btn>
              <v-btn color="success">Success</v-btn>
            </div>

            <div class="d-flex flex-wrap gap-2 mt-4">
              <v-btn color="primary" variant="outlined">Outlined</v-btn>
              <v-btn color="secondary" variant="text">Text</v-btn>
              <v-btn color="accent" variant="elevated">Elevated</v-btn>
              <v-btn color="primary" variant="tonal">Tonal</v-btn>
              <v-btn color="primary" icon="mdi-check"></v-btn>
              <v-btn color="primary" size="small">Small</v-btn>
              <v-btn color="primary" size="large">Large</v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Forms Section -->
      <v-row class="mt-8">
        <v-col cols="12">
          <h2 class="text-h5 mb-4">Forms</h2>
          <v-card class="pa-4">
            <v-form>
              <v-row>
                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.name"
                    label="Name"
                    placeholder="Enter your name"
                    prepend-inner-icon="mdi-account"
                  ></v-text-field>
                </v-col>

                <v-col cols="12" md="6">
                  <v-text-field
                    v-model="form.email"
                    label="Email"
                    type="email"
                    placeholder="Enter your email"
                    prepend-inner-icon="mdi-email"
                  ></v-text-field>
                </v-col>

                <v-col cols="12" md="6">
                  <v-select
                    v-model="form.category"
                    :items="categories"
                    label="Category"
                    prepend-inner-icon="mdi-format-list-bulleted"
                  ></v-select>
                </v-col>

                <v-col cols="12" md="6">
                  <v-switch
                    v-model="form.newsletter"
                    color="primary"
                    label="Subscribe to newsletter"
                  ></v-switch>
                </v-col>

                <v-col cols="12">
                  <v-textarea
                    v-model="form.message"
                    label="Message"
                    placeholder="Enter your message"
                    prepend-inner-icon="mdi-comment-text"
                    rows="3"
                  ></v-textarea>
                </v-col>

                <v-col cols="12">
                  <v-btn color="primary" type="submit" class="mr-2">Submit</v-btn>
                  <v-btn color="error" variant="outlined">Reset</v-btn>
                </v-col>
              </v-row>
            </v-form>
          </v-card>
        </v-col>
      </v-row>

      <!-- Dark Mode Toggle -->
      <v-row class="mt-8">
        <v-col cols="12">
          <h2 class="text-h5 mb-4">Theme Settings</h2>
          <v-card class="pa-4">
            <v-switch
              v-model="isDarkMode"
              color="primary"
              label="Dark Mode"
              @change="toggleTheme"
            ></v-switch>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { useTheme } from 'vuetify';

// Theme settings
const theme = useTheme();
const isDarkMode = ref(false);

onMounted(() => {
  isDarkMode.value = theme.global.name.value === 'dark';
});

const toggleTheme = () => {
  theme.global.name.value = isDarkMode.value ? 'dark' : 'light';
};

// Card data
const cards = ref([
  {
    title: 'Material Design',
    text: 'Vuetify follows Material Design principles for a clean, modern interface that your users will recognize.',
    image: 'https://picsum.photos/id/28/500/300',
    liked: false,
  },
  {
    title: 'Responsive Components',
    text: 'All Vuetify components are designed to be responsive and adapt to different screen sizes.',
    image: 'https://picsum.photos/id/42/500/300',
    liked: false,
  },
  {
    title: 'Design System',
    text: 'Vuetify provides a complete design system with consistent components and styles.',
    image: 'https://picsum.photos/id/48/500/300',
    liked: false,
  },
]);

// Form data
const form = ref({
  name: '',
  email: '',
  category: null,
  newsletter: false,
  message: '',
});

// Categories for select
const categories = ['Web Development', 'Mobile App', 'UI/UX Design', 'Cloud Services'];
</script>

<style scoped>
.gap-2 {
  gap: 8px;
}
</style>

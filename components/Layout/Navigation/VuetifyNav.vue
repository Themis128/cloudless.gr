<template>
  <v-app-bar app color="primary" dark>
    <v-app-bar-title>Cloudless</v-app-bar-title>

    <v-spacer></v-spacer>

    <div class="d-none d-sm-flex">
      <v-btn
        v-for="item in menuItems"
        :key="item.title"
        :to="item.path"
        variant="text"
        :active="route.path === item.path"
      >
        {{ item.title }}
      </v-btn>
    </div>

    <v-app-bar-nav-icon class="d-flex d-sm-none" @click="drawer = !drawer"></v-app-bar-nav-icon>
  </v-app-bar>

  <v-navigation-drawer v-model="drawer" temporary>
    <v-list>
      <v-list-item v-for="item in menuItems" :key="item.title" :to="item.path">
        <v-list-item-title>{{ item.title }}</v-list-item-title>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup>
import { ref } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const drawer = ref(false);

// Menu items for navigation
const menuItems = [
  { title: 'Home', path: '/' },
  { title: 'About', path: '/about' },
  { title: 'Projects', path: '/projects' },
  { title: 'Contact', path: '/contact' },
  { title: 'Vuetify Demo', path: '/vuetify-demo' },
];
</script>

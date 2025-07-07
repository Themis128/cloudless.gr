<template>
  <v-navigation-drawer
    v-model="drawer"
    app
    temporary
    :width="280"
  >
    <v-list nav dense>
      <template v-for="item in filteredLinks" :key="item.to">
        <NuxtLink v-slot="{ navigate, isActive }" :to="item.to" custom>
          <v-list-item
            :title="item.title"
            :prepend-icon="item.icon"
            :active="isActive"
            :class="{ 'active-link': isActive }"
            @click="() => navigate()"
          />
        </NuxtLink>
      </template>

      <v-divider class="my-2" />

      <v-list-item title="Logout" prepend-icon="mdi-logout" @click="logout" />
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { navigateTo } from '#app';
import { getSupabaseClient } from '@/composables/useSupabase';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits(['update:modelValue']);

const drawer = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const supabase = getSupabaseClient();
const isAdmin = ref(false);

const navLinks = [
  { to: '/dashboard', title: 'Dashboard', icon: 'mdi-view-dashboard', adminOnly: false },
  { to: '/projects', title: 'Projects', icon: 'mdi-folder', adminOnly: false },
  { to: '/settings', title: 'Settings', icon: 'mdi-cog', adminOnly: false },
  { to: '/admin', title: 'Admin Panel', icon: 'mdi-shield-account', adminOnly: true },
];

const filteredLinks = computed(() => navLinks.filter((link) => !link.adminOnly || isAdmin.value));

async function fetchUserRole() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  const typedProfile = profile as { is_admin?: boolean } | null;
  isAdmin.value = !!typedProfile?.is_admin;
}

onMounted(() => {
  fetchUserRole();
});

async function logout() {
  await supabase.auth.signOut();
  navigateTo('/auth/login');
}
</script>

<style scoped>
.active-link {
  background-color: rgba(59, 130, 246, 0.12); /* Tailwind's blue-500 */
}
</style>

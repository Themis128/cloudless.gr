<template>
  <v-card 
    class="team-member-card" 
    hover 
    :elevation="4"
    @click="$emit('click')"
    role="button"
    tabindex="0"
    @keydown.enter="$emit('click')"
    @keydown.space.prevent="$emit('click')"
  >
    <v-card-text class="pa-6">
      <div class="text-center">
        <div class="member-avatar mb-4">
          <v-avatar 
            size="80" 
            color="primary"
            class="member-avatar-img"
          >
            <v-img 
              v-if="member.avatar && member.avatar !== '/avatars/default.jpg'"
              :src="member.avatar" 
              :alt="`${member.name} avatar`"
            />
            <v-icon 
              v-else
              size="40" 
              color="white"
              aria-hidden="true"
            >
              mdi-account
            </v-icon>
          </v-avatar>
        </div>
        
        <h3 class="text-h6 font-weight-bold mb-2">
          {{ member.name }}
        </h3>
        
        <p class="text-body-2 text-primary font-weight-medium mb-3">
          {{ member.role }}
        </p>
        
        <p class="text-body-2 text-medium-emphasis">
          {{ member.bio }}
        </p>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface TeamMember {
  id: string
  name: string
  role: string
  avatar: string
  bio: string
}

interface Props {
  member: TeamMember
}

interface Emits {
  (e: 'click'): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.team-member-card {
  height: 100%;
  cursor: pointer;
  transition: all 0.3s ease-in-out;
  border-radius: 16px;
}

.team-member-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.15);
}

.team-member-card:focus-visible {
  outline: 2px solid var(--v-theme-primary);
  outline-offset: 2px;
}

.member-avatar {
  display: flex;
  justify-content: center;
}

.member-avatar-img {
  transition: all 0.3s ease;
  border: 3px solid rgba(var(--v-theme-primary), 0.1);
}

.team-member-card:hover .member-avatar-img {
  border-color: rgba(var(--v-theme-primary), 0.3);
  transform: scale(1.05);
}

/* Ensure consistent card heights */
.v-card-text {
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: center;
}

/* Responsive adjustments */
@media (max-width: 600px) {
  .member-avatar-img {
    width: 60px !important;
    height: 60px !important;
  }
}
</style> 
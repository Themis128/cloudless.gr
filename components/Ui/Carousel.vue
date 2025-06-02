<template>
  <div class="carousel">
    <v-alert v-if="!items.length" type="info" variant="tonal" class="mb-4">
      No certifications found.
    </v-alert>

    <v-row v-else class="justify-center">
      <v-col v-for="(item, idx) in items" :key="idx" cols="12" sm="6" md="4" lg="3" class="d-flex">
        <v-card
          :href="item.link"
          target="_blank"
          rel="noopener"
          elevation="2"
          hover
          class="carousel-card d-flex flex-column"
          rounded="lg"
        >
          <v-img :src="item.image" :alt="item.title" height="160" cover class="carousel-img" />

          <v-card-title class="text-body-1 font-weight-bold">
            {{ item.title }}
          </v-card-title>

          <v-card-text class="flex-grow-1 text-body-2 text-medium-emphasis">
            {{ item.description }}
          </v-card-text>

          <v-card-actions>
            <v-spacer />
            <v-btn
              variant="text"
              color="primary"
              size="small"
              :href="item.link"
              target="_blank"
              rel="noopener"
            >
              View Certificate
              <v-icon end>mdi-open-in-new</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
interface CarouselItem {
  link: string;
  image: string;
  title: string;
  description: string;
}

interface Props {
  items: CarouselItem[];
}

withDefaults(defineProps<Props>(), {
  items: () => [],
});
</script>

<style scoped>
.carousel-card {
  transition: transform 0.2s ease-in-out;
  height: 100%;
}

.carousel-card:hover {
  transform: translateY(-4px);
}

.carousel-img {
  border-radius: 8px 8px 0 0;
}
</style>

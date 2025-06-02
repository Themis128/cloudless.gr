// Nuxt Content configuration for custom collections and settings
import { defineCollection } from '@nuxt/content';

export default defineCollection({
  // Example: define a blog collection
  blog: {
    path: '/blog',
    schema: {
      title: String,
      description: String,
      date: Date,
      author: String,
      tags: Array,
      draft: Boolean,
    },
    // Add more options as needed
  },
  // Add more collections or settings here
});

import { onMounted, ref } from 'vue';

export function useCredlyBadges(username: string) {
  const badges = ref<any[]>([]);
  const loading = ref(true);

  onMounted(async () => {
    try {
      const res = await fetch(`https://www.credly.com/users/${username}/badges.json`);
      const data = await res.json();
      badges.value = data.data || [];
    } catch (e) {
      badges.value = [];
    } finally {
      loading.value = false;
    }
  });

  return { badges, loading };
}

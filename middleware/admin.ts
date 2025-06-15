import { useSupabase } from "@/composables/useSupabase";

export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/auth/admin-login") return;

  const supabase = useSupabase();

  // Check session
  const { data: sessionData, error: sessionError } = await supabase.auth
    .getSession();
  const userId = sessionData.session?.user?.id;

  if (sessionError || !userId) {
    console.warn("No valid session or user ID found", sessionError);
    return navigateTo("/auth/admin-login");
  }

  // Check if user has admin role in profiles
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    console.warn("User is not admin or DB error", profileError);
    return navigateTo("/auth/admin-login");
  }
});

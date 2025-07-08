<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
    <div class="container mx-auto px-4 py-8">
      <!-- Header -->
      <div class="mb-8">
        <NuxtLink 
          to="/admin/docs" 
          class="text-purple-400 hover:text-purple-300 mb-4 inline-flex items-center"
        >
          <v-icon class="mr-2">mdi-arrow-left</v-icon>
          Back to Admin Documentation
        </NuxtLink>
        <h1 class="text-4xl font-bold text-white mb-2">
          Page Structure & Access Control
        </h1>
        <p class="text-slate-300">
          Complete guide to the application's page hierarchy and access control system
        </p>
      </div>

      <!-- Content -->
      <div class="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
        <div class="prose prose-invert max-w-none">
          <!-- Import the actual documentation content -->
          <div class="markdown-content">
            <h2 class="text-2xl font-bold text-white mb-4">Page Hierarchy Overview</h2>
            
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              <!-- Public Pages -->
              <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <h3 class="text-green-400 font-bold mb-3 flex items-center">
                  <v-icon class="mr-2">mdi-earth</v-icon>
                  Public Pages
                </h3>
                <ul class="text-slate-300 space-y-1 text-sm">
                  <li>• <code>/</code> - Landing page</li>
                  <li>• <code>/info/*</code> - Information pages</li>
                  <li>• <code>/documentation/*</code> - User docs</li>
                  <li>• <code>/auth/*</code> - Authentication</li>
                </ul>
                <p class="text-green-300 text-xs mt-2">No authentication required</p>
              </div>

              <!-- User Pages -->
              <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h3 class="text-blue-400 font-bold mb-3 flex items-center">
                  <v-icon class="mr-2">mdi-account</v-icon>
                  User Pages
                </h3>
                <ul class="text-slate-300 space-y-1 text-sm">
                  <li>• <code>/users/*</code> - User dashboard</li>
                  <li>• <code>/projects/*</code> - Project management</li>
                  <li>• <code>/storage/*</code> - File storage</li>
                  <li>• <code>/settings/*</code> - User settings</li>
                </ul>
                <p class="text-blue-300 text-xs mt-2">Authentication required</p>
              </div>

              <!-- Admin Pages -->
              <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <h3 class="text-purple-400 font-bold mb-3 flex items-center">
                  <v-icon class="mr-2">mdi-shield-crown</v-icon>
                  Admin Pages
                </h3>
                <ul class="text-slate-300 space-y-1 text-sm">
                  <li>• <code>/admin/*</code> - Admin interface</li>
                  <li>• <code>/sys/*</code> - System admin</li>
                  <li>• <code>/admin/docs/*</code> - Admin docs</li>
                </ul>
                <p class="text-purple-300 text-xs mt-2">Admin role required</p>
              </div>
            </div>

            <h2 class="text-2xl font-bold text-white mb-4">Access Control Matrix</h2>
            
            <div class="overflow-x-auto mb-8">
              <table class="w-full border border-white/20 rounded-lg overflow-hidden">
                <thead class="bg-white/10">
                  <tr>
                    <th class="text-left p-4 text-white font-bold">Page Type</th>
                    <th class="text-center p-4 text-white font-bold">Anonymous</th>
                    <th class="text-center p-4 text-white font-bold">User</th>
                    <th class="text-center p-4 text-white font-bold">Admin</th>
                  </tr>
                </thead>
                <tbody class="text-slate-300">
                  <tr class="border-t border-white/10">
                    <td class="p-4 font-medium">Public (<code>/</code>, <code>/info/*</code>)</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                  </tr>
                  <tr class="border-t border-white/10 bg-white/5">
                    <td class="p-4 font-medium">User Docs (<code>/documentation/*</code>)</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                  </tr>
                  <tr class="border-t border-white/10">
                    <td class="p-4 font-medium">Auth (<code>/auth/*</code>)</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                  </tr>
                  <tr class="border-t border-white/10 bg-white/5">
                    <td class="p-4 font-medium">User Pages (<code>/users/*</code>, <code>/projects/*</code>)</td>
                    <td class="text-center p-4">❌</td>
                    <td class="text-center p-4">✅</td>
                    <td class="text-center p-4">✅</td>
                  </tr>
                  <tr class="border-t border-white/10">
                    <td class="p-4 font-medium">Admin Pages (<code>/admin/*</code>, <code>/sys/*</code>)</td>
                    <td class="text-center p-4">❌</td>
                    <td class="text-center p-4">❌</td>
                    <td class="text-center p-4">✅</td>
                  </tr>
                  <tr class="border-t border-white/10 bg-red-500/10">
                    <td class="p-4 font-medium">Admin Docs (<code>/admin/docs/*</code>)</td>
                    <td class="text-center p-4">❌</td>
                    <td class="text-center p-4">❌</td>
                    <td class="text-center p-4">✅</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-6 mb-8">
              <h3 class="text-red-400 font-bold mb-3 flex items-center">
                <v-icon class="mr-2">mdi-shield-alert</v-icon>
                Admin Documentation Security
              </h3>
              <p class="text-slate-300 mb-3">
                Admin documentation is <strong>strictly protected</strong> and only accessible to users with admin role:
              </p>
              <ul class="text-slate-300 space-y-2">
                <li>• <strong>Route Protection</strong>: <code>/admin/docs/*</code> requires admin middleware</li>
                <li>• <strong>Component Guards</strong>: Pages check <code>authStore.isAdmin</code></li>
                <li>• <strong>Error Handling</strong>: Non-admin users get 403 Forbidden errors</li>
                <li>• <strong>Navigation</strong>: Admin docs links only show for admin users</li>
              </ul>
            </div>

            <h2 class="text-2xl font-bold text-white mb-4">Admin Interface Structure</h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <!-- Primary Admin Interface -->
              <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
                <h3 class="text-blue-400 font-bold mb-4 flex items-center">
                  <v-icon class="mr-2">mdi-view-dashboard</v-icon>
                  Primary Admin Interface (<code>/admin/*</code>)
                </h3>
                <ul class="text-slate-300 space-y-2 text-sm">
                  <li>• <code>index.vue</code> - Main admin dashboard</li>
                  <li>• <code>users.vue</code> - User management</li>
                  <li>• <code>monitor.vue</code> - System monitoring</li>
                  <li>• <code>settings.vue</code> - Admin settings</li>
                  <li>• <code>docs/</code> - Admin documentation</li>
                </ul>
                <p class="text-blue-300 text-xs mt-3">Modern Vue/Vuetify design for standard admin operations</p>
              </div>

              <!-- System Administration -->
              <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-6">
                <h3 class="text-purple-400 font-bold mb-4 flex items-center">
                  <v-icon class="mr-2">mdi-cog</v-icon>
                  System Administration (<code>/sys/*</code>)
                </h3>
                <ul class="text-slate-300 space-y-2 text-sm">
                  <li>• <code>index.vue</code> - Advanced system admin</li>
                  <li>• <code>maintenance.vue</code> - System maintenance</li>
                </ul>
                <p class="text-purple-300 text-xs mt-3">Advanced Tailwind interface for system-level administration</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: 'admin'
})

const authStore = useAuthStore()

// Redirect non-admin users
if (!authStore.isAdmin) {
  throw createError({
    statusCode: 403,
    statusMessage: 'Admin access required for documentation'
  })
}
</script>

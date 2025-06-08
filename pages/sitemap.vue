<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <h1 class="text-h3 mb-4">Sitemap</h1>
          <p class="text-h6 mb-6">Navigate through all pages</p>
          
          <v-row>
            <v-col cols="12" md="6">
              <v-card>
                <v-card-title>Main Pages</v-card-title>
                <v-card-text>
                  <v-list>
                    <v-list-item to="/" prepend-icon="mdi-home">
                      <v-list-item-title>Home / Dashboard</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/about" prepend-icon="mdi-information">
                      <v-list-item-title>About</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/contact" prepend-icon="mdi-email">
                      <v-list-item-title>Contact</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/faq" prepend-icon="mdi-help-circle">
                      <v-list-item-title>FAQ</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
            
            <v-col cols="12" md="6">
              <v-card>
                <v-card-title>Application Pages</v-card-title>
                <v-card-text>
                  <v-list>
                    <v-list-item to="/builder" prepend-icon="mdi-cube-outline">
                      <v-list-item-title>Builder</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/workflows" prepend-icon="mdi-graph-outline">
                      <v-list-item-title>Workflows</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/projects" prepend-icon="mdi-folder">
                      <v-list-item-title>Projects</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/logs" prepend-icon="mdi-file-document-outline">
                      <v-list-item-title>Logs</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/docs" prepend-icon="mdi-book-open-page-variant-outline">
                      <v-list-item-title>Documentation</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
          
          <v-row class="mt-4">
            <v-col cols="12">
              <v-card>
                <v-card-title>Authentication & Legal</v-card-title>
                <v-card-text>
                  <v-list>
                    <v-list-item to="/auth/login" prepend-icon="mdi-login">
                      <v-list-item-title>Login</v-list-item-title>
                    </v-list-item>
                    <v-list-item to="/terms" prepend-icon="mdi-file-document">
                      <v-list-item-title>Terms of Service</v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  title: 'Sitemap',
  description: 'Navigate through all available pages'
})
</script>

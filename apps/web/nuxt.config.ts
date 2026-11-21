import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxtjs/supabase'],

  // Personal app behind a login: render in the browser only.
  ssr: false,

  devtools: { enabled: true },

  app: {
    head: {
      title: 'Gardener',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#fbf7ee' },
        { name: 'description', content: 'Keep track of the plants in the flat.' },
        // Home Screen app on iPhone (needed for reminders there)
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-title', content: 'Gardener' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    public: {
      // The Adonis API (apps/api) that sends reminders. NUXT_PUBLIC_API_URL overrides it.
      apiUrl: 'https://gardener-api.hozza.dev'
    }
  },

  compatibilityDate: '2025-07-15',

  vite: {
    plugins: [tailwindcss()]
  },

  supabase: {
    // Everything requires login except the login page and OAuth callback.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: [],
      // So an invite link opened while signed out comes back after sign-in.
      saveRedirectToCookie: true
    },
    types: false
  }
})

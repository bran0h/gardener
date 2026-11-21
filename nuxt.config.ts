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
        { name: 'description', content: 'Keep track of the plants in the flat.' }
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
    }
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-15',

  vite: {
    plugins: [tailwindcss()]
  },

  supabase: {
    // Everything requires login except the login page and OAuth callback.
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: []
    },
    types: false
  }
})

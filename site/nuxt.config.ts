export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  // The design system (fonts, base colours, skeletons, prose overrides, briefing highlights) lives in main.css
  tailwindcss: { cssPath: '~/assets/css/main.css' },
  app: {
    head: {
      title: 'World Country Groups',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Browse 90+ international country groups — EU, G20, BRICS, OECD, NATO, OPEC and more. Explore memberships, GDP, population, and CO2 data.' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  runtimeConfig: {},
  vite: {
    server: {
      allowedHosts: ['worldcountrygroups.whereistomas.org'],
    },
  },
  nitro: {
    preset: 'node-server',
  },
})

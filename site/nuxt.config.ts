export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  app: {
    head: {
      title: 'World Country Groups',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Browse 47 international country groups — EU, G20, BRICS, OECD, NATO and more. Explore memberships, GDP, population, and CO2 data.' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
      ],
    },
  },
  nitro: {
    preset: 'node-server',
  },
})

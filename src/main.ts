import { createApp } from 'vue'

import App from '@/app/App.vue'
import { pinia } from '@/app/providers/pinia'
import { router } from '@/app/router'
import '@/app/styles/global.css'

createApp(App).use(pinia).use(router).mount('#app')

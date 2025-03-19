import { createRouter, createWebHashHistory } from 'vue-router'
import MemoryVisualizer from '@/views/MemoryVisualizer.vue'
import BytecodeViewer from '@/views/BytecodeViewer.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'memory-visualizer',
      component: MemoryVisualizer,
    },
    {
      path: '/bytecode-viewer',
      name: 'bytecode-viewer',
      component: BytecodeViewer,
    }
  ],
})

export default router

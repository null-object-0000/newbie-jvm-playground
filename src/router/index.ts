import { createRouter, createWebHashHistory } from 'vue-router'
import MemoryVisualizer from '@/views/MemoryVisualizer.vue'
import BytecodeViewer from '@/views/BytecodeViewer.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/memory-visualizer',
    },
    {
      path: '/memory-visualizer',
      name: 'memory-visualizer',
      component: MemoryVisualizer,
      meta: {
        title: '内存可视化'
      }
    },
    {
      path: '/bytecode-viewer',
      name: 'bytecode-viewer',
      component: BytecodeViewer,
      meta: {
        title: '字节码查看器'
      }
    }
  ],
})

// 添加全局前置守卫
router.beforeEach((to) => {
  // 获取最接近的带有 title 的路由记录
  const nearestWithTitle = to.matched.slice().reverse().find(r => r.meta?.title)

  // 设置页面标题
  if (nearestWithTitle?.meta.title) {
    document.title = nearestWithTitle.meta.title + ' - Newbie JVM Playground'
  } else {
    document.title = 'Newbie JVM Playground' // 设置默认标题
  }
})

export default router

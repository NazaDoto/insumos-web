<script>
import ToastContainer from '@/components/ui/ToastContainer.vue'

export default {
  name: 'App',
  components: { ToastContainer },
}
</script>

<template>
  <RouterView />
  <ToastContainer />
</template>

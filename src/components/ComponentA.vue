<script lang="ts">
interface Props {
  msg: string;
}
</script>
<script setup lang="ts">
const props = defineProps<Props>();
</script>

<template>
  <div>
    Hello {{ msg }}! <span class="icon-heart" style="color: tomato"></span>
  </div>
</template>

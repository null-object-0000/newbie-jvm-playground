<template>
    <div v-if="obj" class="memory-object" :style="style" :title="`${obj.name} (${obj.size} bytes)`">
        <span>{{ obj.name }}</span>
        <span class="object-age">年龄: {{ obj.age }}</span>
        <span class="object-is-garbage-collectable">
            {{ obj.isGarbageCollectable ? '可回收' : '不可回收' }}
        </span>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { HeapObject } from "@/types";

defineProps({
    obj: Object as PropType<HeapObject>,
    style: Object,
})
</script>

<style scoped>
.memory-object {
    height: calc(100% - 4px);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: all 0.3s ease;
    border: 2px solid;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    cursor: pointer;
}

.memory-object[style*="background-color: #4CAF50"] {
    border-color: #2E7D32;
}

.memory-object[style*="background-color: #2196F3"] {
    border-color: #1565C0;
}

.memory-object[style*="background-color: #FFC107"] {
    border-color: #FFA000;
}

.object-age,
.object-is-garbage-collectable {
    font-size: 10px;
    opacity: 0.8;
}
</style>
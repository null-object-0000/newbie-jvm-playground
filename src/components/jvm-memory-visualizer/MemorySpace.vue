<template>
    <div class="memory-space">
        <h4>
            {{ spaceName }} ({{ formatBytes(totalSize) }})
            <span class="usage-percentage">
                (已使用：{{ formatBytes(usedSize) }})
                <span v-if="spaceDesc">({{ spaceDesc }})</span>
            </span>
        </h4>
        <div class="memory-block">
            <template v-for="obj in heapObjects" :key="obj.id">
                <MemoryObject :obj="obj" :style="getObjectStyle && getObjectStyle(obj)"
                    @click="toggleGarbageCollectable(obj)">
                </MemoryObject>
            </template>
        </div>
    </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { HeapObject } from '@/types';
import MemoryObject from './MemoryObject.vue';

defineProps({
    spaceName: String,
    spaceDesc: String,
    totalSize: Number,
    usedSize: Number,
    heapObjects: Array as PropType<HeapObject[]>,

    getObjectStyle: Function,
})

const formatBytes = (bytes?: number) => {
    if (!bytes) return '0B';

    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const emit = defineEmits(['toggleGarbageCollectable']);

const toggleGarbageCollectable = (obj: HeapObject) => {
    emit('toggleGarbageCollectable', obj);
};
</script>

<style scoped>
.memory-block {
    height: 80px;
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 4px;
    margin: 10px 0;
    position: relative;
    overflow: hidden;
    width: 100%;
    display: flex;
}

.usage-percentage {
    font-size: 0.8em;
    color: #666;
    margin-left: 8px;
}
</style>
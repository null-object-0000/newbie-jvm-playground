<template>
    <div class="logic-table">
        <a-table :data="logicList" :pagination="false">
            <template #columns>
                <a-table-column title="逻辑名称" data-index="name" :width="200" />
                <a-table-column title="描述" data-index="desc" />
                <a-table-column title="状态" :width="100">
                    <template #cell="{ record }">
                        <template v-if="record.implemented">
                            <a-switch v-if="record.configurable" v-model="record.enabled"
                                @change="handleLogicChange(record)">
                                <template #checked>已启用</template>
                                <template #unchecked>已禁用</template>
                            </a-switch>
                            <span v-else>{{ record.enabled ? '已启用' : '已禁用' }}</span>
                        </template>
                        <template v-else>
                            <span>未实现</span>
                        </template>
                    </template>
                </a-table-column>
            </template>
        </a-table>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface LogicItem {
    id: string;
    name: string;
    desc: string;
    enabled: boolean;
    configurable: boolean;
    implemented: boolean;
}

const logicList = ref<LogicItem[]>([
    {
        id: 'eden_sweep',
        name: '优先 Eden 分配',
        desc: '优先将对象分配到 Eden 区',
        enabled: true,
        configurable: false,
        implemented: true
    },
    {
        id: 'pretenure_size_threshold',
        name: '大对象直入老年代',
        desc: '当对象大小超过 Eden 区时，直接在老年代分配（可以通过 -XX:PretenureSizeThreshold 参数配置，超过此值的对象直接在老年代分配）',
        enabled: true,
        configurable: false,
        implemented: true
    },
    {
        id: 'space_guarantee',
        name: '空间分配担保',
        desc: '当 Survivor 区空间不足时，会将对象直接分配到老年代',
        enabled: true,
        configurable: false,
        implemented: true
    },
    {
        id: 'max_tenuring_threshold',
        name: '对象年龄阈值',
        desc: '对象在 Survivor 区中每经过一次 Minor GC 年龄增加 1，当年龄超过阈值时进入老年代（可以通过 -XX:MaxTenuringThreshold 参数配置）',
        enabled: true,
        configurable: false,
        implemented: true
    },
    {
        id: 'dynamic_age_threshold',
        name: '动态年龄判定',
        desc: '当 Survivor 区中相同年龄对象大小总和超过 Survivor 区目标使用率时，年龄大于等于该年龄的对象直接进入老年代（可以通过 -XX:TargetSurvivorRatio 参数配置）',
        enabled: true,
        configurable: false,
        implemented: true
    }
]);

const emit = defineEmits(['logicChange']);

const handleLogicChange = (logic: LogicItem) => {
    emit('logicChange', logic);
};
</script>

<style scoped>
.logic-table {
    background: white;
}
</style>
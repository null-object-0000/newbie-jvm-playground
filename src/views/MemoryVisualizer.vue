<template>
    <div class="jvm-memory-visualizer">
        <!-- 内存配置区域 -->
        <a-form :model="jvmArgs" layout="inline" class="memory-config-panel">
            <a-form-item field="value" label="JVM 参数：" style="flex: 1;" :help="jvmArgs.error">
                <a-input v-model="jvmArgs.value" placeholder="例如: -Xms512m -Xmx1024m" />
            </a-form-item>
            <a-form-item>
                <a-button @click="showArgsHelp" style="margin: 0 10px">参数说明</a-button>
            </a-form-item>
            <a-form-item>
                <a-button @click="restartJvm" class="restart-button" :loading="isRestarting">重启 JVM</a-button>
            </a-form-item>
        </a-form>

        <!-- 对象创建表单 -->
        <a-form ref="newObjectFormRef" layout="inline" :model="newObject" class="control-panel">
            <a-form-item field="name" label="对象名称：" style="flex: 1;">
                <a-input v-model="newObject.name" placeholder="输入对象名称" />
            </a-form-item>
            <a-form-item field="size" label="对象大小：" style="flex: 1;">
                <a-input-number v-model="newObject.size" :min="1" placeholder="输入对象大小" />
                <a-select v-model="newObject.unit" style="margin-left: 10px; width: 100px;">
                    <a-option value="B">B</a-option>
                    <a-option value="KB">KB</a-option>
                    <a-option value="MB">MB</a-option>
                </a-select>
            </a-form-item>
            <a-form-item field="isGarbageCollectable">
                <a-switch v-model="newObject.isGarbageCollectable">
                    <template #checked>可回收</template>
                    <template #unchecked>不可回收</template>
                </a-switch>
            </a-form-item>
            <a-form-item>
                <a-dropdown trigger="hover" @click="createObject" :disabled="!isValidObject || isRestarting">
                    <a-button>创建对象</a-button>
                    <template #content>
                        <a-doption @click="createObjects(5)">5 个对象</a-doption>
                        <a-doption @click="createObjects(10)">10 个对象</a-doption>
                    </template>
                </a-dropdown>
            </a-form-item>
        </a-form>

        <!-- 内存区域可视化 -->
        <div class="memory-container">
            <div class="memory-visualization">
                <h2>堆内存</h2>
                <div class="memory-regions">
                    <!-- 新生代 -->
                    <div class="young-gen">
                        <h3>新生代 ({{ formatBytes(youngGenSize) }})</h3>

                        <!-- Eden区 -->
                        <MemorySpace class="eden-space" space-name="Eden Space" :total-size="edenSize"
                            :used-size="getSpaceUsed(MEMORY_SPACE.EDEN)"
                            :heapObjects="heapObjects.filter(o => o.space === MEMORY_SPACE.EDEN)"
                            :getObjectStyle="getObjectStyle" @toggleGarbageCollectable="toggleGarbageCollectable">
                        </MemorySpace>

                        <!-- Survivor区 -->
                        <div class="survivor-spaces">
                            <MemorySpace class="survivor-space" space-name="Survivor 0"
                                :space-desc="currentFromSpace === MEMORY_SPACE.SURVIVOR_0 ? 'From区' : 'To区'"
                                :total-size="survivorSize" :used-size="getSpaceUsed(MEMORY_SPACE.SURVIVOR_0)"
                                :heapObjects="heapObjects.filter(o => o.space === MEMORY_SPACE.SURVIVOR_0)"
                                :getObjectStyle="getObjectStyle" @toggleGarbageCollectable="toggleGarbageCollectable">
                            </MemorySpace>

                            <MemorySpace class="survivor-space" space-name="Survivor 1"
                                :space-desc="currentFromSpace === MEMORY_SPACE.SURVIVOR_1 ? 'From区' : 'To区'"
                                :total-size="survivorSize" :used-size="getSpaceUsed(MEMORY_SPACE.SURVIVOR_1)"
                                :heapObjects="heapObjects.filter(o => o.space === MEMORY_SPACE.SURVIVOR_1)"
                                :getObjectStyle="getObjectStyle" @toggleGarbageCollectable="toggleGarbageCollectable">
                            </MemorySpace>
                        </div>
                    </div>
                    <!-- 老年代 -->
                    <div class="old-gen">
                        <h3>老年代 ({{ formatBytes(oldGenSize) }})</h3>
                        <MemorySpace class="old-gen" space-name="Old Gen" :total-size="oldGenSize"
                            :used-size="getSpaceUsed(MEMORY_SPACE.OLD_GEN)"
                            :heapObjects="heapObjects.filter(o => o.space === MEMORY_SPACE.OLD_GEN)"
                            :getObjectStyle="getObjectStyle" @toggleGarbageCollectable="toggleGarbageCollectable">
                        </MemorySpace>
                    </div>
                </div>
                <div class="memory-info">
                    <p>总容量: {{ formatBytes(heapSize) }}</p>
                    <p>已使用: {{ formatBytes(usedHeapSize) }}</p>
                    <p>剩余空间: {{ formatBytes(heapSize - usedHeapSize) }}</p>
                </div>
            </div>

            <!-- 运行日志 -->
            <div class="operation-history">
                <h2>运行日志</h2>
                <ul>
                    <li v-for="(log, index) in operationLogs" :key="index">
                        {{ log }}
                    </li>
                </ul>
            </div>
        </div>
    </div>

    <!-- https://docs.oracle.com/javase/8/docs/technotes/tools/unix/java.html -->
    <a-modal v-model:visible="showHelpModal" title="JVM 参数说明" :footer="false" width="1000px">
        <a-table :data="jvmArgsHelp" :pagination="false">
            <template #columns>
                <a-table-column title="参数名称" data-index="name" :width="250" />
                <a-table-column title="参数说明" data-index="desc" :width="250" />
                <a-table-column title="默认值" data-index="defaultValue" :width="100" />
                <a-table-column title="使用示例" data-index="example" />
            </template>
        </a-table>
    </a-modal>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeMount, reactive } from 'vue';
import { Message } from '@arco-design/web-vue';
import MemorySpace from '@/components/jvm-memory-visualizer/MemorySpace.vue';
import type { HeapObject } from '@/types';

onBeforeMount(() => {
    // 初始化内存配置
    const config = parseJvmArgs(jvmArgs.value);
    if (config) {
        memoryConfig.value = config;
    }
})

// 重启状态
const isRestarting = ref(false);
const showHelpModal = ref(false);

const jvmArgsHelp = [
    {
        "name": "-Xms",
        "desc": "初始堆内存大小",
        "defaultValue": "100k",
        "example": "-Xms100k"
    },
    {
        "name": "-Xmx",
        "desc": "最大堆内存大小",
        "defaultValue": "100k",
        "example": "-Xmx100k"
    },
    {
        "name": "-XX:NewRatio",
        "desc": "新生代与老年代的比例",
        "defaultValue": "2",
        "example": "-XX:NewRatio=2"
    },
    {
        "name": "-XX:SurvivorRatio",
        "desc": "Eden区与Survivor区的比例",
        "defaultValue": "8",
        "example": "-XX:SurvivorRatio=8"
    },
    {
        "name": "-XX:MaxTenuringThreshold",
        "desc": "对象晋升老年代的年龄阈值",
        "defaultValue": "15",
        "example": "-XX:MaxTenuringThreshold=15"
    }
];

const showArgsHelp = () => {
    showHelpModal.value = true;
};

// 内存配置
const jvmArgs = reactive({
    value: jvmArgsHelp.map(item => item.example).join(' '),
    error: ''
});
const restartJvm = async () => {
    isRestarting.value = true;

    // 应用新的JVM参数
    const config = parseJvmArgs(jvmArgs.value);
    if (config) {
        // 模拟重启过程，随机延迟200ms到1500ms
        const delay = Math.floor(Math.random() * (1500 - 200 + 1)) + 200;
        await new Promise(resolve => setTimeout(resolve, delay));

        heapObjects.value = [];
        operationLogs.value = [];
        hasApplicationError.value = false;

        memoryConfig.value = config;
        Message.success('JVM 重启成功');
    } else {
        Message.error('JVM 参数无效，重启失败');
    }

    isRestarting.value = false;
};

const memoryConfig = ref({
    initialHeap: 1, // 初始堆大小（MB）
    maxHeap: 1, // 最大堆大小（MB）
    newRatio: 2, // 新生代和老年代的比例，默认为2，表示新生代:老年代=1:2
    survivorRatio: 8, // Eden区和Survivor区的比例，默认为8，表示Eden:Survivor=8:1
    maxTenuringThreshold: 15, // 对象晋升年龄阈值，默认为15
});

// JVM参数解析函数
const parseJvmArgs = (args: string) => {
    const result = {
        initialHeap: 1,
        maxHeap: 1,
        newRatio: 2,
        survivorRatio: 8,
        maxTenuringThreshold: 15
    };

    const xmsMatch = args.match(/-Xms(\d+)([kmg])?/i);
    const xmxMatch = args.match(/-Xmx(\d+)([kmg])?/i);

    try {
        if (xmsMatch) {
            let value = parseInt(xmsMatch[1]);
            const unit = (xmsMatch[2] || '').toLowerCase();

            // 转换为MB
            switch (unit) {
                case 'g': value *= 1024; break;
                case 'k': value /= 1024; break;
            }

            result.initialHeap = value;
        }

        if (xmxMatch) {
            let value = parseInt(xmxMatch[1]);
            const unit = (xmxMatch[2] || '').toLowerCase();

            // 转换为MB
            switch (unit) {
                case 'g': value *= 1024; break;
                case 'k': value /= 1024; break;
            }

            result.maxHeap = value;
        }

        // 解析NewRatio参数
        const newRatioMatch = args.match(/-XX:NewRatio=(\d+)/i);
        if (newRatioMatch) {
            result.newRatio = parseInt(newRatioMatch[1]);
            if (result.newRatio < 1) {
                throw new Error('NewRatio必须大于等于1');
            }
        }

        // 解析SurvivorRatio参数
        const survivorRatioMatch = args.match(/-XX:SurvivorRatio=(\d+)/i);
        if (survivorRatioMatch) {
            result.survivorRatio = parseInt(survivorRatioMatch[1]);
            if (result.survivorRatio < 1) {
                throw new Error('SurvivorRatio必须大于等于1');
            }
        }

        // 解析MaxTenuringThreshold参数
        const maxTenuringThresholdMatch = args.match(/-XX:MaxTenuringThreshold=(\d+)/i);
        if (maxTenuringThresholdMatch) {
            result.maxTenuringThreshold = parseInt(maxTenuringThresholdMatch[1]);
            if (result.maxTenuringThreshold < 0 || result.maxTenuringThreshold > 15) {
                throw new Error('MaxTenuringThreshold必须在0到15之间');
            }
        }

        // 验证参数
        if (result.initialHeap > result.maxHeap) {
            throw new Error('初始堆大小不能大于最大堆大小');
        }

        jvmArgs.error = '';
        return result;
    } catch (error: unknown) {
        if (error instanceof Error) {
            jvmArgs.error = error.message;
        } else {
            jvmArgs.error = '未知错误';
        }
    }
};

// 状态定义
const heapSize = computed(() => memoryConfig.value.initialHeap * 1024 * 1024); // 当前堆内存大小
const youngGenSize = computed(() => heapSize.value / (memoryConfig.value.newRatio + 1)); // 新生代大小
const oldGenSize = computed(() => heapSize.value - youngGenSize.value); // 老年代大小
const edenSize = computed(() => youngGenSize.value * memoryConfig.value.survivorRatio / (memoryConfig.value.survivorRatio + 2)); // Eden区大小
const survivorSize = computed(() => youngGenSize.value / (memoryConfig.value.survivorRatio + 2)); // 每个Survivor区大小

const heapObjects = ref([] as HeapObject[]);
const operationLogs = ref([] as string[]);
// 常用的Java类名列表
const JAVA_CLASSES = [
    'String', 'Integer', 'ArrayList', 'HashMap', 'Object',
    'StringBuilder', 'LinkedList', 'HashSet', 'Thread', 'Random'
];

// 生成随机类名
const generateRandomClassName = () => {
    const randomClass = JAVA_CLASSES[Math.floor(Math.random() * JAVA_CLASSES.length)];
    const randomId = Math.floor(Math.random() * 1000) + 1;
    return `${randomClass}_${randomId}`;
};

const newObjectFormRef = ref(null);
const newObject = ref({
    name: generateRandomClassName(),
    size: 10,
    unit: 'KB',
    isGarbageCollectable: false
});

// 对象状态
const MEMORY_SPACE = {
    EDEN: 'eden',
    SURVIVOR_0: 'survivor0',
    SURVIVOR_1: 'survivor1',
    OLD_GEN: 'old'
};

const SURVIVOR_FROM = computed(() => currentFromSpace.value);
const SURVIVOR_TO = computed(() => currentFromSpace.value === MEMORY_SPACE.SURVIVOR_0 ? MEMORY_SPACE.SURVIVOR_1 : MEMORY_SPACE.SURVIVOR_0);

// 当前From区对应的Survivor区（0或1）
const currentFromSpace = ref(MEMORY_SPACE.SURVIVOR_0);

// GC相关配置
const MAX_TENURING_THRESHOLD = computed(() => memoryConfig.value.maxTenuringThreshold); // 对象晋升年龄阈值

// 计算属性
const usedHeapSize = computed(() => {
    return heapObjects.value.reduce((total, obj) => total + obj.size, 0);
});

const convertToBytes = (size: number, unit: string) => {
    switch (unit) {
        case 'MB':
            return size * 1024 * 1024;
        case 'KB':
            return size * 1024;
        default:
            return size;
    }
};

const hasApplicationError = ref(false);

const isValidObject = computed(() => {
    const sizeInBytes = convertToBytes(newObject.value.size, newObject.value.unit);
    return newObject.value.name &&
        newObject.value.size > 0 &&
        sizeInBytes <= (heapSize.value - usedHeapSize.value) &&
        !hasApplicationError.value;
});

/**
 * 模拟应用程序级别错误
 */
const applicationError = (message: string) => {
    hasApplicationError.value = true;
    operationLogs.value.unshift(message);
    Message.error(message);
    return new Error(message);
};

class gc {
    minorGC = () => {
        // 增加所有存活对象的年龄
        heapObjects.value.forEach(obj => {
            if (obj.space === currentFromSpace.value) {
                obj.age++;
            }
        });

        // 将Eden区和From区的存活对象转移到To区或老年代
        const survivingObjects = [] as HeapObject[];
        const oldGenObjects = [] as HeapObject[];

        const put2OldGen = (obj: HeapObject) => {
            // TODO: 这里如果 Old Gen 不足的话应该要触发 Major GC
            const used = getSpaceUsed(MEMORY_SPACE.OLD_GEN) + obj.size + oldGenObjects.reduce((total, obj) => total + obj.size, 0);
            if (used <= oldGenSize.value) {
                oldGenObjects.push({
                    ...obj,
                    space: MEMORY_SPACE.OLD_GEN
                });
                return true;
            } else {
                throw applicationError('java.lang.OutOfMemoryError: Java heap space');
            }
        }

        heapObjects.value
            .filter(obj => obj.space === currentFromSpace.value)
            .forEach(obj => {
                // 如果对象不可回收，则保留对象
                if (obj.isGarbageCollectable) {
                    operationLogs.value.unshift(`回收对象: ${obj.name} (${formatBytes(obj.size)})`);
                    return;
                }

                // 检查对象是否达到晋升年龄
                if (obj.age >= MAX_TENURING_THRESHOLD.value) {
                    return put2OldGen(obj)
                } else {
                    // 检查Survivor空间
                    if (getSpaceUsed(SURVIVOR_TO.value) + obj.size <= survivorSize.value) {
                        survivingObjects.push({
                            ...obj,
                            space: SURVIVOR_TO.value
                        });
                    } else {
                        operationLogs.value.unshift(`警告: 对象 ${obj.name} 无法移动到Survivor区 - 空间不足`);
                        return;
                    }
                }
            });

        // 检查 Eden 区所有不可回收对象是否可以放入 Old Gen 区
        const edenObjects = heapObjects.value.filter(obj => obj.space === MEMORY_SPACE.EDEN);
        const edenObjectsNotGarbageCollectable = edenObjects.filter(obj => !obj.isGarbageCollectable);
        const edenObjectsNotGarbageCollectableSize = edenObjectsNotGarbageCollectable.reduce((total, obj) => total + obj.size, 0);

        // 如果所有不可回收对象的大小大于 Survivor 区大小，则直接将所有不可回收对象放入 Old Gen 区
        if (edenObjectsNotGarbageCollectableSize > survivorSize.value) {
            edenObjectsNotGarbageCollectable.forEach(obj => {
                return put2OldGen(obj)
            });
        } else {
            // 否则，将所有不可回收对象放入 Survivor 区
            edenObjects
                .forEach(obj => {
                    // 如果对象不可回收，则保留对象
                    if (obj.isGarbageCollectable) {
                        operationLogs.value.unshift(`回收对象: ${obj.name} (${formatBytes(obj.size)})`);
                        return;
                    }

                    // 分配担保机制
                    // 对象大小超过Survivor区大小，尝试直接进入Old Gen区
                    if (obj.size > survivorSize.value) {
                        return put2OldGen(obj)
                    }

                    // 检查Survivor空间
                    if (getSpaceUsed(SURVIVOR_TO.value) + obj.size <= survivorSize.value) {
                        survivingObjects.push({
                            ...obj,
                            space: SURVIVOR_TO.value
                        });
                    } else {
                        operationLogs.value.unshift(`警告: 对象 ${obj.name} 无法移动到Survivor区 - 空间不足`);
                        return;
                    }
                });
        }

        // 更新对象位置
        oldGenObjects.forEach(obj => {
            obj.position = getNextPosition(MEMORY_SPACE.OLD_GEN);
        });

        survivingObjects.forEach(obj => {
            obj.position = getNextPosition(SURVIVOR_TO.value);
        });

        // 更新堆对象列表
        heapObjects.value = [
            ...heapObjects.value.filter(obj =>
                obj.space !== MEMORY_SPACE.EDEN &&
                obj.space !== currentFromSpace.value
            ),
            ...survivingObjects,
            ...oldGenObjects
        ];

        // 交换From区和To区
        heapObjects.value = heapObjects.value.map(obj => {
            if (obj.space === (currentFromSpace.value === MEMORY_SPACE.SURVIVOR_0 ? MEMORY_SPACE.SURVIVOR_1 : MEMORY_SPACE.SURVIVOR_0)) {
                currentFromSpace.value = obj.space;
                return obj;
            }
            return obj;
        });

        operationLogs.value.unshift('执行 Minor GC');
    };
}

const GC = new gc();

/**
 * 1.   若创建的对象大小超出了 Eden 区的总大小，则尝试直接进入 Old Gen 区。-XX:+PretenureSizeThreshold
 * 2.   若创建的对象大小小于等于 Eden 区的总大小，则检查 Eden 区的空间是否足够。
 *      - 若 Eden 区的空间足够，则将对象直接放入 Eden 区。
 *      - 若 Eden 区的空间不足，则触发 Minor GC。将 Eden 区中的存活对象复制到 Survivor 区，清空 Eden 区。
 *      - 若对象大小超出了 Survivor 区的总大小，则尝试直接进入 Old Gen 区。
 */
const createObject = () => {
    if (!isValidObject.value) return;

    const sizeInBytes = convertToBytes(newObject.value.size, newObject.value.unit);
    const newObj = {
        id: Date.now(),
        name: newObject.value.name,
        size: sizeInBytes,
        space: MEMORY_SPACE.EDEN,
        age: 0,
        position: 0,
        isGarbageCollectable: newObject.value.isGarbageCollectable
    } as HeapObject;

    if (sizeInBytes > edenSize.value) {
        // 对象大小超过Eden区大小，尝试直接进入Old Gen区
        if (getSpaceUsed(MEMORY_SPACE.OLD_GEN) + newObj.size > oldGenSize.value) {
            throw applicationError('java.lang.OutOfMemoryError: Java heap space');
        }

        newObj.space = MEMORY_SPACE.OLD_GEN;
        newObj.position = getNextPosition(MEMORY_SPACE.OLD_GEN);
        heapObjects.value.push(newObj);
        operationLogs.value.unshift(`创建对象: ${newObj.name} (${formatBytes(newObj.size)}) 在Old Gen区`);
    } else {
        // 检查Eden区空间
        if (getSpaceUsed(MEMORY_SPACE.EDEN) + newObj.size > edenSize.value) {
            // Eden区空间不足，触发Minor GC
            GC.minorGC();

            // GC后重新检查Eden区空间
            if (getSpaceUsed(MEMORY_SPACE.EDEN) + newObj.size > edenSize.value) {
                throw applicationError('java.lang.OutOfMemoryError: Java heap space');
            }
        }

        // 设置对象在Eden区的位置
        newObj.position = getNextPosition(MEMORY_SPACE.EDEN);
        heapObjects.value.push(newObj);
        operationLogs.value.unshift(`创建对象: ${newObj.name} (${formatBytes(newObj.size)}) 在Eden区`);
    }

    // 重置表单
    // newObjectFormRef.value.resetFields();
    newObject.value.name = generateRandomClassName();
};

const createObjects = (count: number) => {
    for (let i = 0; i < count; i++) {
        createObject();
    }
};

const getSpaceUsed = (space: string) => {
    return heapObjects.value
        .filter(obj => obj.space === space)
        .reduce((total, obj) => total + obj.size, 0);
};

const getNextPosition = (space: string) => {
    const spaceObjects = heapObjects.value.filter(obj => obj.space === space);
    if (spaceObjects.length === 0) {
        // 如果是第一个对象，根据不同区域设置起始位置
        switch (space) {
            case MEMORY_SPACE.EDEN:
                return 0;
            case MEMORY_SPACE.SURVIVOR_0:
                return edenSize.value;
            case MEMORY_SPACE.SURVIVOR_1:
                return edenSize.value + survivorSize.value;
            case MEMORY_SPACE.OLD_GEN:
                return youngGenSize.value;
        }
    }
    const lastObject = spaceObjects[spaceObjects.length - 1];
    return lastObject.position + lastObject.size;
};

const getObjectStyle = (obj: HeapObject) => {
    let spaceSize = 0;
    let spaceStartPosition = 0;

    // 根据对象所在空间确定相应的空间大小和起始位置
    switch (obj.space) {
        case MEMORY_SPACE.EDEN:
            spaceSize = edenSize.value;
            break;
        case SURVIVOR_FROM.value:
            spaceSize = survivorSize.value;
            spaceStartPosition = edenSize.value;
            break;
        case SURVIVOR_TO.value:
            spaceSize = survivorSize.value;
            spaceStartPosition = edenSize.value + survivorSize.value;
            break;
        case MEMORY_SPACE.OLD_GEN:
            spaceSize = oldGenSize.value;
            spaceStartPosition = youngGenSize.value;
            break;
    }

    // 计算对象在其所在空间内的相对宽度和位置
    const widthPercentage = (obj.size / spaceSize) * 100;
    const relativePosition = obj.position - spaceStartPosition;
    const leftPercentage = (relativePosition / spaceSize) * 100;

    // 根据对象所在空间设置不同的颜色
    let backgroundColor;
    switch (obj.space) {
        case MEMORY_SPACE.EDEN:
            backgroundColor = '#4CAF50';
            break;
        case SURVIVOR_FROM.value:
        case SURVIVOR_TO.value:
            backgroundColor = '#2196F3';
            break;
        case MEMORY_SPACE.OLD_GEN:
            backgroundColor = '#FFC107';
            break;
    }

    return {
        width: `${widthPercentage}%`,
        left: `${leftPercentage}%`,
        backgroundColor
    };
};

const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

const toggleGarbageCollectable = (obj: HeapObject) => {
    obj.isGarbageCollectable = !obj.isGarbageCollectable;
    operationLogs.value.unshift(`切换对象 ${obj.name} 的可回收状态为: ${obj.isGarbageCollectable ? '可回收' : '不可回收'}`);
};
</script>

<style scoped>
.jvm-memory-visualizer {
    padding: 20px;
}

.memory-config-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
}

.config-group {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
}

.config-item {
    flex: 1;
    min-width: 200px;
}

.config-item label {
    display: block;
    margin-bottom: 5px;
}

.config-item .size-input-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

.config-item input {
    flex: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.config-item .unit {
    width: 30px;
    color: #666;
}

.control-panel {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    margin-bottom: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}

.memory-container {
    display: flex;
    gap: 20px;
    width: 100%;
}

.form-group {
    flex: 1;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
}

.form-group input {
    width: 100%;
    padding: 8px;
    padding-right: 0px;
    border: 1px solid #ddd;
    border-radius: 4px;
}

.error-message {
    color: #dc3545;
    font-size: 0.875em;
    margin-top: 5px;
}

.size-input-group {
    display: flex;
    gap: 10px;
}

.size-input-group input {
    flex: 1;
}

.size-input-group select {
    width: 80px;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background-color: white;
}

.memory-visualization {
    width: 70%;
    margin: 0;
    padding: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.memory-regions {
    margin: 20px 0;
    width: 100%;
}

.young-gen,
.old-gen {
    background: #fff;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    width: 100%;
}

.eden-space,
.survivor-space {
    margin: 10px 0;
}

.survivor-spaces {
    display: flex;
    gap: 20px;
}

.survivor-space {
    flex: 1;
}

.memory-info {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
    font-size: 14px;
    color: #666;
}

.operation-history {
    width: 30%;
    margin: 0;
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    height: fit-content;
}

.operation-history ul {
    list-style: none;
    padding: 0;
    margin: 0;
    height: 500px;
    overflow-y: auto;
    font-size: 13px;
}

.operation-history li {
    padding: 8px 0;
    border-bottom: 1px solid #eee;
    color: #666;
}

h2 {
    color: #333;
    margin-bottom: 20px;
}

h2 {
    font-size: 1.2em;
    margin-bottom: 15px;
}
</style>
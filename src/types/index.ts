export interface HeapObject {
    id: number;
    name: string;
    size: number;
    space: string;
    age: number;
    position: number;
    isGarbageCollectable: boolean;
}
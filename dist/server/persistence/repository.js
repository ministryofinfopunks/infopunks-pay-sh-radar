"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryRepository = void 0;
class MemoryRepository {
    snapshot = null;
    async loadSnapshot() {
        return this.snapshot;
    }
    async saveSnapshot(snapshot) {
        this.snapshot = snapshot;
    }
}
exports.MemoryRepository = MemoryRepository;

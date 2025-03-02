import {PutObjectCommand} from "@aws-sdk/client-s3";
import path from "path";
import Container, {Service} from "typedi";
import type {DB} from "../_worker";
import type {Env} from "../db/db";
import {getDB, getEnv} from "./di";
import {createS3Client} from "./s3";

// Cache Utils for storing data in memory and persisting to S3
// DO NOT USE THIS TO STORE SENSITIVE DATA

@Service()
export class CacheImpl {
    private cache: Map<string, { value: any, timestamp: number }> = new Map();
    private db: DB;
    private env: Env;
    private cacheUrl: string;
    private type: string;
    private loaded: boolean = false;
    private loading: Promise<void> | null = null;
    private s3 = createS3Client();
    private memoryTTL: number; // Time in milliseconds for in-memory cache to expire
    private saveQueue: Set<string> = new Set(); // Queue of keys that need to be saved
    private saveTimer: ReturnType<typeof setTimeout> | null = null;
    private saveInterval: number; // Minimum time between saves in milliseconds

    constructor(type: string = "cache", memoryTTL: number = 300000, saveInterval: number = 10000) { // Default 5 min TTL, 10s save interval
        this.type = type;
        this.db = getDB();
        this.env = getEnv();
        this.memoryTTL = memoryTTL;
        this.saveInterval = saveInterval;

        const slash = this.env.S3_ACCESS_HOST?.endsWith('/') ? '' : '/';
        this.cacheUrl = this.env.S3_ACCESS_HOST
            ? this.env.S3_ACCESS_HOST + slash + path.join(this.env.S3_CACHE_FOLDER || 'cache', `${type}.json`)
            : '';
    }

    async load() {
        if (this.loading) {
            return this.loading;
        }

        this.loading = (async () => {
            console.log('Cache load', this.type);

            if (!this.cacheUrl) {
                console.warn('Cache URL not set, skipping load');
                this.loaded = true;
                return;
            }

            try {
                const response = await fetch(new Request(this.cacheUrl));
                if (!response.ok) {
                    throw new Error(`Failed to load cache: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const now = Date.now();

                for (let key in data) {
                    this.cache.set(key, {value: data[key], timestamp: now});
                }

                this.loaded = true;
                console.log(`Cache loaded: ${this.type}, ${Object.keys(data).length} entries`);
            } catch (e: any) {
                // Don't fail if cache loading fails, just log and continue
                console.error(`Cache load failed for ${this.type}:`, e.message);
                this.loaded = true; // Still mark as loaded so we don't keep trying
            }
        })();

        return this.loading;
    }

    async all() {
        if (!this.loaded && !this.loading) {
            await this.load();
        } else if (this.loading) {
            await this.loading;
        }

        // Return only non-expired values
        const now = Date.now();
        const result = new Map();

        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp <= this.memoryTTL) {
                result.set(key, entry.value);
            }
        }

        return result;
    }

    async get(key: string) {
        if (!this.loaded && !this.loading) {
            await this.load();
        } else if (this.loading) {
            await this.loading;
        }

        const entry = this.cache.get(key);
        if (!entry) return undefined;

        // Check if the entry has expired
        if (Date.now() - entry.timestamp > this.memoryTTL) {
            this.cache.delete(key);
            return undefined;
        }

        return entry.value;
    }

    async getByPattern(pattern: string, isPrefix: boolean = true): Promise<any[]> {
        if (!this.loaded && !this.loading) {
            await this.load();
        } else if (this.loading) {
            await this.loading;
        }

        const now = Date.now();
        const result = [];

        for (const [key, entry] of this.cache.entries()) {
            // Skip expired entries
            if (now - entry.timestamp > this.memoryTTL) {
                continue;
            }

            if ((isPrefix && key.startsWith(pattern)) ||
                (!isPrefix && key.endsWith(pattern))) {
                result.push(entry.value);
            }
        }

        return result;
    }

    async getByPrefix(prefix: string): Promise<any[]> {
        return this.getByPattern(prefix, true);
    }

    async getBySuffix(suffix: string): Promise<any[]> {
        return this.getByPattern(suffix, false);
    }

    async getOrSet<T>(key: string, valueProvider: () => Promise<T>, ttl?: number): Promise<T> {
        const cached = await this.get(key);
        if (cached !== undefined) {
            return cached as T;
        }

        try {
            const newValue = await valueProvider();
            await this.set(key, newValue, true, ttl);
            return newValue;
        } catch (e) {
            console.error(`Error in getOrSet for key ${key}:`, e);
            throw e; // Re-throw to let the caller handle it
        }
    }

    async getOrDefault<T>(key: string, defaultValue: T, ttl?: number): Promise<T> {
        return this.getOrSet(key, async () => defaultValue, ttl);
    }

    async set(key: string, value: any, save: boolean = true, ttl?: number): Promise<void> {
        if (!this.loaded && !this.loading) {
            await this.load();
        }

        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });

        if (save) {
            this.queueSave(key);
        }
    }

    private queueSave(key: string): void {
        this.saveQueue.add(key);

        // Schedule a save if one isn't already scheduled
        if (!this.saveTimer) {
            this.saveTimer = setTimeout(() => this.saveQueuedItems(), this.saveInterval);
        }
    }

    private async saveQueuedItems(): Promise<void> {
        this.saveTimer = null;

        if (this.saveQueue.size === 0) {
            return;
        }

        console.log(`Saving ${this.saveQueue.size} items for cache ${this.type}`);
        await this.save();
        this.saveQueue.clear();
    }

    async delete(key: string, save: boolean = true): Promise<void> {
        this.cache.delete(key);

        if (save) {
            this.queueSave(key);
        }
    }

    async deletePattern(pattern: string, isPrefix: boolean = true): Promise<void> {
        let keysToDelete: string[] = [];

        for (const key of this.cache.keys()) {
            if ((isPrefix && key.startsWith(pattern)) ||
                (!isPrefix && key.endsWith(pattern))) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            this.cache.delete(key);
            this.saveQueue.add(key); // Mark for save
        }

        if (keysToDelete.length > 0) {
            console.log(`Deleted ${keysToDelete.length} keys matching ${isPrefix ? 'prefix' : 'suffix'} ${pattern}`);
            this.queueSave('pattern-delete');
        }
    }

    async deletePrefix(prefix: string): Promise<void> {
        return this.deletePattern(prefix, true);
    }

    async deleteSuffix(suffix: string): Promise<void> {
        return this.deletePattern(suffix, false);
    }

    async clear(): Promise<void> {
        this.cache.clear();
        await this.save();
        console.log(`Cleared cache ${this.type}`);
    }

    async save(): Promise<void> {
        if (!this.env.S3_BUCKET || !this.env.S3_CACHE_FOLDER) {
            console.warn('S3 bucket or cache folder not configured, cache not saved');
            return;
        }

        const cacheKey = path.join(this.env.S3_CACHE_FOLDER, `${this.type}.json`);

        try {
            // Convert cache entries to plain object for storage
            const dataToSave: Record<string, any> = {};
            for (const [key, entry] of this.cache.entries()) {
                dataToSave[key] = entry.value;
            }

            await this.s3.send(new PutObjectCommand({
                Bucket: this.env.S3_BUCKET,
                Key: cacheKey,
                Body: JSON.stringify(dataToSave),
                ContentType: 'application/json'
            }));

            console.log(`Cache ${this.type} saved with ${Object.keys(dataToSave).length} entries`);
        } catch (e: any) {
            console.error(`Failed to save cache ${this.type}:`, e.message);
        }
    }
}

// Factory functions for different cache types
export const PublicCache = () => Container.get<CacheImpl>("cache");
export const ServerConfig = () => Container.get<CacheImpl>("server.config");
export const ClientConfig = () => Container.get<CacheImpl>("client.config");

// Initialize caches with different TTLs
export function initializeCaches() {
    if (!Container.has("cache")) {
        // Public cache: 5 minutes memory TTL, 30 second save interval
        Container.set("cache", new CacheImpl("cache", 5 * 60 * 1000, 30 * 1000));

        // Server config: 10 minutes memory TTL, 1 minute save interval
        Container.set("server.config", new CacheImpl("server.config", 10 * 60 * 1000, 60 * 1000));

        // Client config: 10 minutes memory TTL, 1 minute save interval
        Container.set("client.config", new CacheImpl("client.config", 10 * 60 * 1000, 60 * 1000));
    }
}

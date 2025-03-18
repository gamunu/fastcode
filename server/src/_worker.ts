import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { Elysia } from "elysia";
import 'reflect-metadata';
import Container from "typedi";
import type { Env } from "./db/db";
import * as schema from './db/schema';
import { app } from "./server";
import { friendCrontab } from "./services/friends";
import { rssCrontab } from "./services/rss";
import {CacheImpl} from "./utils/cache";
import { dbToken, envToken } from "./utils/di";
export type DB = DrizzleD1Database<typeof import("./db/schema")>

export default {
    async fetch(
        request: Request,
        env: Env,
    ): Promise<Response> {
        // Set up DI container
        const db = drizzle(env.DB, { schema: schema })
        Container.set(envToken, env)
        Container.set(dbToken, db)

        // Initialize caches with optimized configuration
        const exist = Container.has("cache")
        if (!exist) {
            Container.set("cache", new CacheImpl());
            Container.set("server.config", new CacheImpl("server.config"));
            Container.set("client.config", new CacheImpl("client.config"));
        }

        // Special handling for SEO routes
        const url = new URL(request.url);
        if (url.pathname.startsWith('/seo/')) {
            // Bypass normal app initialization for SEO routes
            // This makes SEO response much faster
            return await new Elysia({ aot: false })
                .use(app())
                .handle(request);
        }

        // Check for preflight requests and handle them efficiently
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400',
                }
            });
        }

        // Use a try-catch block for better error handling
        try {
            return await new Elysia({ aot: false })
                .use(app())
                .handle(request);
        } catch (error) {
            console.error('Unhandled exception in worker:', error);
            return new Response(JSON.stringify({
                error: 'Internal server error',
                message: 'An unexpected error occurred'
            }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
        }
    },

    async scheduled(
        env: Env,
        ctx: ExecutionContext
    ) {
        const db = drizzle(env.DB, { schema: schema })
        Container.set(envToken, env)
        Container.set(dbToken, db)

        const exist = Container.has("cache")
        if (!exist) {
            Container.set("cache", new CacheImpl());
            Container.set("server.config", new CacheImpl("server.config"));
            Container.set("client.config", new CacheImpl("client.config"));
        }

        try {
            // Execute the crontab tasks
            await Promise.all([
                friendCrontab(env, ctx),
                rssCrontab(env)
            ]);
        } catch (error) {
            console.error('Error in scheduled task:', error);
        }
    },
}

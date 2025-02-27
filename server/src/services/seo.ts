import Elysia from "elysia";
import path from "node:path";
import type { Env } from "../db/db";
import { getEnv } from "../utils/di";

export function SEOService() {
    const env: Env = getEnv();
    const endpoint = env.S3_ENDPOINT;
    const accessHost = env.S3_ACCESS_HOST || endpoint;
    const folder = env.S3_CACHE_FOLDER || 'cache/';
    return new Elysia({ aot: false })
        .get('/seo/*', async ({ set, params, query, headers }) => {
            if (!accessHost) {
                set.status = 500;
                return 'S3_ACCESS_HOST is not defined';
            }
            let url = params['*'];
            // query concat
            for (const key in query) {
                url += `&${key}=${query[key]}`;
            }
            if (url.endsWith('/') || url === '') {
                url += 'index.html';
            }
            const key = path.join(folder, url);
            try {
                const url = `${accessHost}/${key}`;
                console.log(`Fetching ${url}`);

                // Create fetch options to handle range requests if present
                const fetchOptions: RequestInit = {};
                if (headers.range) {
                    fetchOptions.headers = {
                        'Range': headers.range
                    };
                }

                // Fetch the content with proper options
                const response = await fetch(new Request(url, fetchOptions));

                // Create response headers
                const responseHeaders = new Headers();

                // Copy important headers from the original response
                const headersToForward = [
                    'Content-Type',
                    'Content-Length',
                    'Content-Range',
                    'Accept-Ranges',
                    'ETag'
                ];

                for (const header of headersToForward) {
                    const value = response.headers.get(header);
                    if (value) {
                        responseHeaders.set(header, value);
                    }
                }

                // Ensure Content-Type is set if not already
                if (!responseHeaders.has('Content-Type')) {
                    responseHeaders.set('Content-Type', 'text/html; charset=UTF-8');
                }

                // Set cache control headers
                responseHeaders.set('Cache-Control', 'public, max-age=3600');

                // Create and return the response with the appropriate headers
                return new Response(response.body, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: responseHeaders
                });
            } catch (e: any) {
                console.error(e);
                set.status = 500;
                return e.message;
            }
        });
}

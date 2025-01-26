# SEO Implementation Guide and Configuration

This document explains how SEO works in this project and provides detailed setup instructions.

## Overview

Since this project uses a frontend/backend separated architecture, search engines cannot directly access page content. Our SEO optimization solution pre-renders pages to make them accessible to search engines.

## How It Works

The SEO implementation uses GitHub Actions for pre-rendering and stores the rendered pages in S3 storage, which are then served through Cloudflare Workers.

The pre-rendering process works as follows:

1. Starting from the provided `SEO_BASE_URL`, a crawler requests each page
2. The rendered HTML content is uploaded to S3 cache
3. The crawler extracts all links from the page
4. Links that either:
   - Start with `SEO_BASE_URL`, or 
   - Contain the `SEO_CONTAINS_KEY` keyword
   are added to the crawling queue
5. This process continues until no new links are found

## Configuration Guide

### 1. Environment Variables 

Configure these variables in GitHub under Settings > Secrets and Variables > Actions:

**Public Variables (Variables):**
```ini
SEO_BASE_URL=<Your frontend URL, e.g., https://blog.example.com>
SEO_CONTAINS_KEY=<Optional keyword for link filtering>
S3_FOLDER=images/
S3_CACHE_FOLDER=cache/
S3_BUCKET=<Your S3 bucket name>
S3_REGION=<S3 region, use 'auto' for Cloudflare R2>
S3_ENDPOINT=<S3 endpoint URL>
S3_ACCESS_HOST=<S3 access URL, without trailing slash>
```

**Secret Variables (Secrets):**
```ini
S3_ACCESS_KEY_ID=<Your S3 access key ID>
S3_SECRET_ACCESS_KEY=<Your S3 secret access key>
```

### 2. Configure Cloudflare Workers Routes

1. Go to your domain in Cloudflare dashboard
2. Navigate to Workers Routes
3. Add a new route:
   ```
   <your-domain>/seo/*
   ```
   Example: `blog.example.com/seo/*`
4. Select your deployed Worker

### 3. Set Up URL Rewrite Rules

1. Go to Rules > Transform Rules > Rewrite URL
2. Create a new rule:
   - Name: Any descriptive name (e.g., "SEO Rewrite")
   - Expression (for Google):
     ```
     (http.host eq "your-domain.com" and http.user_agent contains "Googlebot")
     ```
   - Dynamic Path Rewrite:
     ```
     concat("/seo",http.request.uri.path)
     ```
   - Enable "Preserve Query String"

> Note: The default configuration optimizes for Google. For other search engines, add their User-Agent strings to the expression.

### 4. Testing

To verify your SEO setup:

1. Deploy your changes by triggering the GitHub Action workflow
2. Wait for deployment to complete
3. Check a few URLs with "Googlebot" User-Agent:
   ```bash
   curl -A "Googlebot" https://your-domain.com/some-page
   ```
   You should see the pre-rendered HTML content

## Troubleshooting

Common issues and solutions:

1. **S3 Access Issues**
   - Verify your S3 credentials are correct
   - Check bucket permissions
   - Ensure endpoint URLs are correct

2. **Worker Route Not Working**
   - Verify route pattern matches your domain
   - Check Worker is selected correctly
   - Ensure route is enabled

3. **Pre-rendering Issues**
   - Check GitHub Actions logs for errors
   - Verify environment variables are set correctly
   - Ensure `SEO_BASE_URL` is accessible

## Advanced Configuration

### Custom Crawling Rules

You can customize which URLs get crawled by:

1. Adjusting `SEO_CONTAINS_KEY` to include specific URL patterns
2. Modifying the URL rewrite rules for different User-Agents

### Cache Control

The pre-rendered content is cached in S3. You can control caching by:

1. Adding cache headers in your Worker
2. Setting up cache purge rules in Cloudflare
3. Configuring automatic cache clearing on content updates

### Additional Search Engines

To support other search engines:

1. Find their crawler User-Agent strings
2. Add them to your URL rewrite rule expression:
   ```
   (http.host eq "your-domain.com" and (
     http.user_agent contains "Googlebot" or
     http.user_agent contains "bingbot" or
     http.user_agent contains "YandexBot"
   ))
   ```

## Best Practices

1. **Regular Testing**
   - Periodically verify SEO content is being served correctly
   - Monitor search engine crawl stats
   - Check for crawl errors in search console

2. **Performance Optimization**
   - Keep pre-rendered content minimal
   - Use appropriate cache settings
   - Monitor Worker CPU usage

3. **Maintenance**
   - Regularly update dependencies
   - Monitor GitHub Actions usage
   - Clean up unused cache entries

## Support

If you encounter issues:

1. Check the [Issues](https://github.com/openRin/Rin/issues) page
2. Review GitHub Actions logs
3. Create a new issue with:
   - Detailed error description
   - Configuration details
   - Relevant logs
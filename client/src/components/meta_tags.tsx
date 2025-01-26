import React, { useEffect } from 'react';

export type MetaTagsProps = {
    title: string;
    description?: string;
    image?: string;
    type?: string;
    url?: string;
    siteName?: string;
    author?: string;
    keywords?: string[];
};

const MetaTags: React.FC<MetaTagsProps> = ({
    title,
    description,
    image,
    type = 'article',
    url = window.location.href,
    siteName,
    author,
    keywords
}) => {
    useEffect(() => {
        // Helper function to safely convert to string
        const safeString = (value: any): string => {
            if (value === null || value === undefined) return '';
            return String(value);
        };

        // Helper function to update meta tag
        const updateMetaTag = (name: string, content: string) => {
            let element = document.querySelector(`meta[${name}]`);
            if (!element) {
                element = document.createElement('meta');
                const [key, value] = name.split('=');
                element.setAttribute(key.replace(/['"]/g, ''), value.replace(/['"]/g, ''));
                document.head.appendChild(element);
            }
            element.setAttribute('content', content);
        };

        // Set title
        document.title = safeString(title);

        // Update meta tags
        const metaTags: { [key: string]: string | undefined } = {
            'property="og:title"': title,
            'property="og:url"': url,
            'property="og:type"': type,
            'property="og:site_name"': siteName,
            'name="twitter:card"': 'summary_large_image',
            'name="twitter:title"': title
        };

        if (description) {
            metaTags['name="description"'] = description;
            metaTags['property="og:description"'] = description;
            metaTags['name="twitter:description"'] = description;
        }

        if (image) {
            metaTags['property="og:image"'] = image;
            metaTags['name="twitter:image"'] = image;
        }

        if (author) {
            metaTags['name="author"'] = author;
        }

        if (keywords && keywords.length > 0) {
            metaTags['name="keywords"'] = keywords.filter(Boolean).join(', ');
        }

        // Apply all meta tags
        Object.entries(metaTags).forEach(([name, content]) => {
            if (content) {
                updateMetaTag(name, safeString(content));
            }
        });

        // Cleanup function
        return () => {
            // Optional: remove meta tags on unmount if needed
            // For most cases, we want to keep them until the next update
        };
    }, [title, description, image, type, url, siteName, author, keywords]);

    // This component doesn't render anything
    return null;
};

export default MetaTags;
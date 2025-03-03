import {memo, useEffect, useState} from "react";
import {client} from "../main.tsx";
import {timeago} from "../utils/timeago.ts";
import {Link} from "wouter";
import {useTranslation} from "react-i18next";

export type AdjacentFeed = {
    id: number;
    title: string | null;
    summary: string;
    hashtags: {
        id: number;
        name: string;
    }[];
    createdAt: Date;
    updatedAt: Date;
};
export type AdjacentFeeds = {
    nextFeed: AdjacentFeed | null;
    previousFeed: AdjacentFeed | null;
};

// Use memo to prevent unnecessary rerenders
export const AdjacentSection = memo(({ id, setError }: { id: string, setError: (error: string) => void }) => {
    const [adjacentFeeds, setAdjacentFeeds] = useState<AdjacentFeeds>();
    const [isLoading, setIsLoading] = useState(true);

    // Load adjacent feeds data with a delay to prioritize main content
    useEffect(() => {
        let isMounted = true;

        // Use a small delay to prioritize main content loading
        const timer = setTimeout(() => {
            setIsLoading(true);

            client.feed
                .adjacent({ id })
                .get()
                .then(({ data, error }) => {
                    if (!isMounted) return;

                    if (error) {
                        setError(error.value as string);
                    } else if (data && typeof data !== "string") {
                        setAdjacentFeeds(data);
                    }
                    setIsLoading(false);
                })
                .catch(err => {
                    if (!isMounted) return;
                    console.error("Error loading adjacent feeds:", err);
                    setIsLoading(false);
                });
        }, 300); // Delay loading to prioritize main content

        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [id, setError]);

    if (isLoading) {
        return null; // Don't show anything while loading
    }

    return (
        <div className="rounded-2xl bg-w m-2 grid grid-cols-1 sm:grid-cols-2">
            <AdjacentCard data={adjacentFeeds?.previousFeed} type="previous"/>
            <AdjacentCard data={adjacentFeeds?.nextFeed} type="next"/>
        </div>
    );
});

// Use memo for AdjacentCard component to prevent unnecessary rerenders
const AdjacentCard = memo(({ data, type }: { data: AdjacentFeed | null | undefined, type: "previous" | "next" }) => {
    const direction = type === "previous" ? "text-start" : "text-end";
    const radius = type === "previous" ? "rounded-t-2xl sm:rounded-none sm:rounded-l-2xl" : "rounded-b-2xl sm:rounded-none sm:rounded-r-2xl";
    const { t } = useTranslation();

    if (!data) {
        return (
            <div className="w-full p-6 duration-300">
                <p className={`t-secondary w-full ${direction}`}>
                    {type === "previous" ? "Previous" : "Next"}
                </p>
                <h1 className={`text-xl text-gray-700 dark:text-white text-pretty truncate ${direction}`}>
                    {t('no_more')}
                </h1>
            </div>
        );
    }

    // Pre-calculate formatted dates to avoid recalculation in render
    const createdAtStr = timeago(data.createdAt);
    const updatedAtStr = timeago(data.updatedAt);
    const createdAtTitle = new Date(data.createdAt).toLocaleString();
    const updatedAtTitle = new Date(data.updatedAt).toLocaleString();

    return (
        <Link
            href={`/feed/${data.id}`}
            target="_blank"
            className={`w-full p-6 duration-300 bg-button ${radius}`}
        >
            <p className={`t-secondary w-full ${direction}`}>
                {type === "previous" ? "Previous" : "Next"}
            </p>
            <h1 className={`text-xl font-bold text-gray-700 dark:text-white text-pretty truncate ${direction}`}>
                {data.title}
            </h1>
            <p className={`space-x-2 ${direction}`}>
                <span className="text-gray-400 text-sm" title={createdAtTitle}>
                    {data.createdAt === data.updatedAt
                        ? createdAtStr
                        : t('feed_card.published$time', {time: createdAtStr})}
                </span>
                {data.createdAt !== data.updatedAt && (
                    <span className="text-gray-400 text-sm" title={updatedAtTitle}>
                        {t('feed_card.updated$time', {time: updatedAtStr})}
                    </span>
                )}
            </p>
        </Link>
    );
});

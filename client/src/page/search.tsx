import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../main"
import { headersWithAuth } from "../utils/auth"
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import MetaTags from "../components/meta_tags.tsx";

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

export function SearchPage({ keyword }: { keyword: string }) {
    const { t } = useTranslation()
    const query = new URLSearchParams(useSearch());
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsData>()
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(10, query.get("limit"), process.env.PAGE_SIZE)
    const ref = useRef("")
    function fetchFeeds() {
        if (!keyword) return
        client.search({ keyword }).get({
            query: {
                page: page,
                limit: limit
            },
            headers: headersWithAuth()
        }).then(({ data }) => {
            if (data && typeof data !== 'string') {
                setFeeds(data)
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${page} ${limit} ${keyword}`
        if (ref.current == key) return
        setStatus('loading')
        fetchFeeds()
        ref.current = key
    }, [page, limit, keyword])
    const title = t('article.search.title$keyword', { keyword })
    return (
        <>
            <MetaTags
                title={`${title} - ${process.env.NAME}`}
                siteName={siteName}
                image={process.env.AVATAR}
                type="website"
                description={`Search results for: ${keyword}`}
            />
            <Waiting for={status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {t('article.search.title')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: feeds?.size })}
                            </p>
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className="wauto flex flex-col">
                            {feeds?.data.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <div className="wauto flex flex-row items-center mt-4 ani-show">
                            {page > 1 &&
                                <Link href={`?page=${(page - 1)}`}
                                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                    {t('previous')}
                                </Link>
                            }
                            <div className="flex-1" />
                            {feeds?.hasNext &&
                                <Link href={`?page=${(page + 1)}`}
                                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                    {t('next')}
                                </Link>
                            }
                        </div>
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}

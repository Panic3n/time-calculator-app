"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type NewsArticle = {
  id: number;
  title: string;
  summary: string;
  url: string;
};

type MessageBoardContent = {
  id: string;
  title: string;
  content: string;
  updated_at: string;
};

export default function Home() {
  const router = useRouter();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [message, setMessage] = useState<MessageBoardContent | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [messageLoading, setMessageLoading] = useState(true);

  // Load company news from Halo KB
  useEffect(() => {
    const loadNews = async () => {
      try {
        const res = await fetch("/api/halo/news", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setNews(data.articles || []);
        }
      } catch (err) {
        console.error("Failed to load news:", err);
      } finally {
        setNewsLoading(false);
      }
    };
    loadNews();
  }, []);

  // Load message board content
  useEffect(() => {
    const loadMessage = async () => {
      try {
        const res = await fetch("/api/message-board", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setMessage(data.message || null);
        }
      } catch (err) {
        console.error("Failed to load message board:", err);
      } finally {
        setMessageLoading(false);
      }
    };
    loadMessage();
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-[var(--color-text)] mb-8">Welcome</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Company News Section */}
          <div>
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>Company News</CardTitle>
                <CardDescription>Latest updates from the knowledge base</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {newsLoading ? (
                  <p className="text-sm text-[var(--color-text)]/60">Loading news...</p>
                ) : news.length > 0 ? (
                  <ul className="space-y-4">
                    {news.map((article) => (
                      <li key={article.id} className="border-b border-[var(--color-text)]/10 pb-4 last:border-b-0">
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group"
                        >
                          <h3 className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors">
                            {article.title} →
                          </h3>
                          <p className="text-sm text-[var(--color-text)]/70 mt-1">{article.summary}</p>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--color-text)]/60">No news articles available</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Message Board Section */}
          <div>
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>Message Board</CardTitle>
                <CardDescription>Important announcements</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                {messageLoading ? (
                  <p className="text-sm text-[var(--color-text)]/60">Loading message...</p>
                ) : message ? (
                  <div className="flex flex-col h-full">
                    <h3 className="font-semibold text-[var(--color-text)] mb-3">{message.title}</h3>
                    <div className="text-sm text-[var(--color-text)]/80 whitespace-pre-wrap flex-1 mb-3">
                      {message.content}
                    </div>
                    <p className="text-xs text-[var(--color-text)]/50">
                      Updated: {new Date(message.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--color-text)]/60">No message available</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

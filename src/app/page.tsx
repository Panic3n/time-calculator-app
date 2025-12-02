"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabaseClient";
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

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabaseBrowser.auth.getSession();
      if (!session) router.push("/auth");
    };
    checkAuth();
  }, [router]);

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
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="w-full mb-8 rounded-2xl overflow-hidden shadow-2xl border border-[var(--color-surface)]/60 relative h-48 sm:h-64 md:h-80 lg:h-96 group">
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
           <Image 
             src="/banner.png" 
             alt="QuestIT Banner" 
             fill
             className="object-cover transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
             priority
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Company News Section */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-8 space-y-4 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)]">Company News</h2>
                <p className="text-sm text-[var(--color-text)]/60 font-medium mt-1">Latest updates from the knowledge base</p>
              </div>
              <div className="flex-1">
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
                          className="group/link"
                        >
                          <h3 className="font-semibold text-[var(--color-text)] group-hover/link:text-[var(--color-primary)] transition-colors line-clamp-2">
                            {article.title}
                          </h3>
                          <p className="text-sm text-[var(--color-text)]/70 mt-1 line-clamp-2">{article.summary}</p>
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-[var(--color-text)]/60">No news articles available</p>
                )}
              </div>
            </div>
          </div>

          {/* Message Board Section */}
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-8 space-y-4 group-hover:border-[var(--color-primary)]/30 flex flex-col h-full">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)]">Message Board</h2>
                <p className="text-sm text-[var(--color-text)]/60 font-medium mt-1">Important announcements</p>
              </div>
              <div className="flex-1 flex flex-col">
                {messageLoading ? (
                  <p className="text-sm text-[var(--color-text)]/60">Loading message...</p>
                ) : message ? (
                  <div className="flex flex-col h-full">
                    <h3 className="font-semibold text-[var(--color-text)] mb-3 text-lg">{message.title}</h3>
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
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

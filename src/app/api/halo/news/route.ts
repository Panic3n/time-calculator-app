import { NextResponse } from "next/server";
import { haloFetch } from "@/lib/halo";

export async function GET() {
  try {
    // Fetch knowledge base articles from "News (internt)" folder
    // Halo KB API: GET /knowledgebase/articles
    const data = await haloFetch("knowledgebase/articles", {
      query: {
        folder_id: process.env.HALO_NEWS_FOLDER_ID || "", // Set this in env vars
        status: 1, // Published
        limit: 10,
      },
    });

    // Transform Halo KB articles to our format
    const articles = (data.articles || []).map((article: any) => ({
      id: article.id,
      title: article.title || "Untitled",
      summary: article.description || article.article_text?.substring(0, 150) || "",
      url: article.web_link || `#`,
    }));

    return NextResponse.json({ articles }, { status: 200 });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Failed to fetch Halo news:", error);
    return NextResponse.json(
      { articles: [], error: error?.message || "Failed to fetch news" },
      { status: 200 } // Return 200 so page doesn't break
    );
  }
}

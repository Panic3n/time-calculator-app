import { NextResponse } from "next/server";
import { haloFetch } from "@/lib/halo";

export async function GET() {
  try {
    const folderId = process.env.HALO_NEWS_FOLDER_ID;
    
    if (!folderId) {
      console.warn("HALO_NEWS_FOLDER_ID not set");
      return NextResponse.json({ articles: [] }, { status: 200 });
    }

    // Fetch knowledge base articles from the News folder
    // Using KnowledgebaseArticles endpoint with folder filter
    const data = await haloFetch("KnowledgebaseArticles", {
      query: {
        folder_id: folderId,
        status: 1, // Published
        limit: 10,
        order_by: "date_created",
        order_direction: "desc",
      },
    });

    // Handle different response formats from Halo
    let articles: any[] = [];
    
    if (Array.isArray(data)) {
      articles = data;
    } else if (data?.articles && Array.isArray(data.articles)) {
      articles = data.articles;
    } else if (data?.data && Array.isArray(data.data)) {
      articles = data.data;
    } else if (data?.items && Array.isArray(data.items)) {
      articles = data.items;
    }

    // Transform Halo KB articles to our format
    const transformed = articles.map((article: any) => ({
      id: article.id || article.article_id || Math.random(),
      title: article.title || article.article_title || "Untitled",
      summary: article.description || article.article_description || article.article_text?.substring(0, 150) || "",
      url: article.web_link || article.link || `#`,
    }));

    console.log(`Fetched ${transformed.length} news articles from Halo`);
    return NextResponse.json({ articles: transformed }, { status: 200 });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Failed to fetch Halo news:", error?.message);
    return NextResponse.json(
      { articles: [], error: error?.message || "Failed to fetch news" },
      { status: 200 } // Return 200 so page doesn't break
    );
  }
}

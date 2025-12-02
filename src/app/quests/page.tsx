"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseClient";

type Badge = {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  subcategory: string | null;
};

type GroupedBadges = {
  [category: string]: {
    [subcategory: string]: Badge[];
  };
};

export default function QuestsPage() {
  const [groupedBadges, setGroupedBadges] = useState<GroupedBadges>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadBadges = async () => {
      const { data, error } = await supabaseBrowser
        .from("badges")
        .select("*")
        .order("category", { ascending: true })
        .order("subcategory", { ascending: true });
      
      if (error) {
        console.error("Error loading badges:", error);
        setLoading(false);
        return;
      }

      const grouped: GroupedBadges = {};
      (data as Badge[]).forEach((badge) => {
        const cat = badge.category || "Uncategorized";
        const sub = badge.subcategory || "General";
        if (!grouped[cat]) grouped[cat] = {};
        if (!grouped[cat][sub]) grouped[cat][sub] = [];
        grouped[cat][sub].push(badge);
      });
      setGroupedBadges(grouped);
      setLoading(false);
    };
    loadBadges();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10 flex items-center justify-center">
        <p className="text-[var(--color-text)]/60">Loading badges...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-[var(--color-text)]">QuestIT Badges</h1>
          <p className="text-lg text-[var(--color-text)]/60">Available badges and achievements</p>
        </div>

        {Object.entries(groupedBadges).map(([categoryTitle, subcategories]) => (
          <div key={categoryTitle} className="space-y-8">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold text-[var(--color-text)]">{categoryTitle}</h2>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            {Object.entries(subcategories).map(([subcategoryTitle, badges]) => (
              <div key={subcategoryTitle} className="space-y-6">
                <h3 className="text-xl font-medium text-[var(--color-text)]/60 text-center">
                  {subcategoryTitle}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {badges.map((badge) => (
                    <div key={badge.id} className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-6 flex flex-col items-center text-center space-y-4 group-hover:border-[var(--color-primary)]/30 h-full">
                        <div className="relative w-20 h-20 group-hover:scale-110 transition-transform duration-300">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={badge.image_url} 
                            alt={badge.name}
                            className="w-full h-full object-contain drop-shadow-md"
                          />
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-[var(--color-text)] text-lg">
                            {badge.name}
                          </h4>
                          <p className="text-sm text-[var(--color-text)]/60 leading-relaxed">
                            {badge.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </main>
    </div>
  );
}

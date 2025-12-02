"use client";

type Badge = {
  name: string;
  description: string;
  image: string;
};

type BadgeCategory = {
  title: string;
  badges: Badge[];
};

type BadgeSection = {
  title: string;
  categories: BadgeCategory[];
};

const BADGE_DATA: BadgeSection[] = [
  {
    title: "Shared Badges",
    categories: [
      {
        title: "Chronos challenge badges (Exclusive)",
        badges: [
          {
            name: "Keeper of time",
            description: "Claim this badge by ranking #1 in any season of the 'Chronos Challenge' 2024.",
            image: "https://cdn-icons-png.flaticon.com/512/4715/4715210.png"
          },
          {
            name: "Watcher of time",
            description: "Claim this badge by ranking #2nd two or more times in any season of the 'Chronos Challenge' 2024.",
            image: "https://cdn-icons-png.flaticon.com/128/2380/2380402.png"
          },
          {
            name: "Grasper of time",
            description: "Claim this badge by ranking #3rd two or more in any season of the 'Chronos Challenge' 2024.",
            image: "https://cdn-icons-png.flaticon.com/128/3392/3392379.png"
          },
          {
            name: "Teamplayer of time",
            description: "Claim this badge by making a 25% impact on final team results in any season of the 'Chronos Challenge' 2024.",
            image: "https://cdn-icons-png.flaticon.com/128/1036/1036338.png"
          }
        ]
      },
      {
        title: "Hidden badges (Unique)",
        badges: [
          {
            name: "First of his knowledge",
            description: "Claim this badge by being the first to claim a 'knowledge badge'.",
            image: "https://cdn-icons-png.flaticon.com/128/13745/13745903.png"
          },
          {
            name: "The Connection King",
            description: "Claim this badge by receiving 50 or more 'awesome' reviews in 6 months or less.",
            image: "https://cdn-icons-png.flaticon.com/128/12772/12772432.png"
          },
          {
            name: "Portal Master",
            description: "Claim this badge by traveling for 100h or more in 6 months or less.",
            image: "https://cdn-icons-png.flaticon.com/128/8558/8558271.png"
          },
          {
            name: "Time is of the Essence",
            description: "Claim this badge by being the first ever to register 100% of their time during one month.",
            image: "https://cdn-icons-png.flaticon.com/128/6606/6606357.png"
          },
          {
            name: "?????",
            description: "?????",
            image: "https://cdn-icons-png.flaticon.com/128/5727/5727965.png"
          },
          {
            name: "?????",
            description: "?????",
            image: "https://cdn-icons-png.flaticon.com/128/5727/5727965.png"
          }
        ]
      },
      {
        title: "Special badges",
        badges: [
          {
            name: "The Chronos Crown",
            description: "Claim this badge by winning the 'Time Masters' competition 2024/25.",
            image: "https://cdn-icons-png.flaticon.com/128/15534/15534859.png"
          },
          {
            name: "Ticket thief",
            description: "Claim this badge by closing 100 tickets not assigned to you.",
            image: "https://cdn-icons-png.flaticon.com/128/2302/2302312.png"
          },
          {
            name: "Boss fight",
            description: "Defeat the final boss.",
            image: "https://cdn-icons-png.flaticon.com/128/5442/5442786.png"
          },
          {
            name: "Pokémon trainer",
            description: "Train a pokémon to lvl 100 or above.",
            image: "https://cdn-icons-png.flaticon.com/128/361/361998.png"
          },
          {
            name: "Excalibur",
            description: "????",
            image: "https://cdn-icons-png.flaticon.com/128/3196/3196237.png"
          },
          {
            name: "Task Titan",
            description: "Complete 100 project-tasks.",
            image: "https://cdn-icons-png.flaticon.com/128/12249/12249977.png"
          },
          {
            name: "Finish Line Hero",
            description: "On a large project be the one to close the last ticket.",
            image: "https://cdn-icons-png.flaticon.com/128/4492/4492608.png"
          }
        ]
      },
      {
        title: "Agent status badges",
        badges: [
          {
            name: "Veteran Agent",
            description: "Claim this badge by being an agent in HaloPSA for 1 year.",
            image: "https://cdn-icons-png.flaticon.com/128/11693/11693134.png"
          },
          {
            name: "Master Agent",
            description: "Claim this badge by being an agent in HaloPSA for 2 years.",
            image: "https://cdn-icons-png.flaticon.com/128/12343/12343934.png"
          },
          {
            name: "Guru Agent",
            description: "Claim this badge by being an agent in HaloPSA for 3 years.",
            image: "https://cdn-icons-png.flaticon.com/128/5757/5757458.png"
          },
          {
            name: "Ascended Agent",
            description: "Claim this badge by being an agent in HaloPSA for 5 years.",
            image: "https://cdn-icons-png.flaticon.com/128/15097/15097108.png"
          },
          {
            name: "!-The One-!",
            description: "Claim this badge by being an agent in HaloPSA for 10 years.",
            image: "https://cdn-icons-png.flaticon.com/128/208/208962.png"
          }
        ]
      }
    ]
  },
  {
    title: "Servicedesk Badges",
    categories: [
      {
        title: "Knowledge badges",
        badges: [
          {
            name: "Veteran of knowledge",
            description: "Claim this badge by contributing 25 knowledge base articles.",
            image: "https://cdn-icons-png.flaticon.com/128/1644/1644231.png"
          },
          {
            name: "Master of knowledge",
            description: "Claim this badge by contributing 50 knowledge base articles.",
            image: "https://cdn-icons-png.flaticon.com/128/17483/17483004.png"
          },
          {
            name: "Guru of knowledge",
            description: "Claim this badge by contributing 100 knowledge base articles.",
            image: "https://cdn-icons-png.flaticon.com/128/17482/17482995.png"
          },
          {
            name: "!-Bird of knowledge-!",
            description: "Claim this badge by contributing 500 knowledge base articles.",
            image: "https://cdn-icons-png.flaticon.com/128/15161/15161974.png"
          }
        ]
      },
      {
        title: "SLA 'on time resolution' badges",
        badges: [
          {
            name: "SLA Veteran",
            description: "Claim this badge by having 95% 'on time resolution' during 1 month.",
            image: "https://cdn-icons-png.flaticon.com/128/14580/14580718.png"
          },
          {
            name: "SLA Master",
            description: "Claim this badge by having 95% 'on time resolution' during 2 months in a row.",
            image: "https://cdn-icons-png.flaticon.com/128/14580/14580872.png"
          },
          {
            name: "SLA Guru",
            description: "Claim this badge by having 95% 'on time resolution' during 3 months in a row.",
            image: "https://cdn-icons-png.flaticon.com/128/14580/14580673.png"
          },
          {
            name: "SLA Ascended",
            description: "Claim this badge by having 95% 'on time resolution' during 6 months in a row.",
            image: "https://cdn-icons-png.flaticon.com/128/14580/14580616.png"
          },
          {
            name: "!-Resolutionist-!",
            description: "Claim this badge by having 95% 'on time resolution' during 1 full year .",
            image: "https://cdn-icons-png.flaticon.com/128/14580/14580627.png"
          }
        ]
      },
      {
        title: "SLA 'avg.response time' badges",
        badges: [
          {
            name: "Responder Veteran",
            description: "Claim this badge by having 1h avg. response time during 1 month.",
            image: "https://cdn-icons-png.flaticon.com/128/17200/17200051.png"
          },
          {
            name: "Responder Master",
            description: "Claim this badge by having 1h avg. response time during 2 months in a row.",
            image: "https://cdn-icons-png.flaticon.com/128/17199/17199974.png"
          },
          {
            name: "Responder Guru",
            description: "Claim this badge by having 1.5h avg. response time during 3 month in a row.",
            image: "https://cdn-icons-png.flaticon.com/128/17199/17199970.png"
          },
          {
            name: "Responder Ascended",
            description: "Claim this badge by having 1.5h avg. response time during 6 month in a row.",
            image: "https://cdn-icons-png.flaticon.com/128/17199/17199990.png"
          },
          {
            name: "!-First Responder-!",
            description: "Claim this badge by having 1.5h avg.response time during 1 year.",
            image: "https://cdn-icons-png.flaticon.com/128/17199/17199950.png"
          }
        ]
      }
    ]
  },
  {
    title: "Consultant Badges",
    categories: [
      {
        title: "Special consultant badges",
        badges: [
          {
            name: "Deadline Dynamo",
            description: "Complete 100 large and 100 small projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/9419/9419011.png"
          },
          {
            name: "Task Shuffler",
            description: "Complete 15 tasks connected to projects in one day.",
            image: "https://cdn-icons-png.flaticon.com/128/4694/4694472.png"
          },
          {
            name: "Success Sage",
            description: "Success is the word...",
            image: "https://cdn-icons-png.flaticon.com/128/10997/10997732.png"
          }
        ]
      },
      {
        title: "Project badges",
        badges: [
          {
            name: "Small project veteran",
            description: "Close 25 small projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/14353/14353831.png"
          },
          {
            name: "Small project master",
            description: "Close 50 small projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/14353/14353981.png"
          },
          {
            name: "Small project guru",
            description: "Close 75 small projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/14354/14354055.png"
          },
          {
            name: "Projects is my thing!",
            description: "Close 50 small and 10 large projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/4580/4580385.png"
          },
          {
            name: "Project Prodigy",
            description: "Close 50 large projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/15756/15756869.png"
          },
          {
            name: "Project Pioneer",
            description: "Close 100 large projects on or before their end-date.",
            image: "https://cdn-icons-png.flaticon.com/128/2086/2086349.png"
          }
        ]
      }
    ]
  }
];

export default function QuestsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg)] to-[var(--color-surface)]/10">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-[var(--color-text)]">QuestIT Badges</h1>
          <p className="text-lg text-[var(--color-text)]/60">Available badges and achievements</p>
        </div>

        {BADGE_DATA.map((section, sectionIdx) => (
          <div key={sectionIdx} className="space-y-8">
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-bold text-[var(--color-text)]">{section.title}</h2>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            {section.categories.map((category, categoryIdx) => (
              <div key={categoryIdx} className="space-y-6">
                <h3 className="text-xl font-medium text-[var(--color-text)]/60 text-center">
                  {category.title}
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {category.badges.map((badge, badgeIdx) => (
                    <div key={badgeIdx} className="group relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-[var(--color-primary)]/10 to-[var(--color-primary)]/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="relative backdrop-blur-sm bg-[var(--color-surface)]/40 border border-[var(--color-surface)]/60 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-2xl p-6 flex flex-col items-center text-center space-y-4 group-hover:border-[var(--color-primary)]/30 h-full">
                        <div className="relative w-20 h-20 group-hover:scale-110 transition-transform duration-300">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img 
                            src={badge.image} 
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

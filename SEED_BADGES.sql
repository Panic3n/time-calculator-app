-- Seed data for Badges
-- You can run this script in the Supabase SQL Editor to populate the initial badges.

INSERT INTO badges (name, description, image_url, category, subcategory) VALUES
-- Shared Badges > Chronos challenge badges (Exclusive)
('Keeper of time', 'Claim this badge by ranking #1 in any season of the ''Chronos Challenge'' 2024.', 'https://cdn-icons-png.flaticon.com/512/4715/4715210.png', 'Shared Badges', 'Chronos challenge badges (Exclusive)'),
('Watcher of time', 'Claim this badge by ranking #2nd two or more times in any season of the ''Chronos Challenge'' 2024.', 'https://cdn-icons-png.flaticon.com/128/2380/2380402.png', 'Shared Badges', 'Chronos challenge badges (Exclusive)'),
('Grasper of time', 'Claim this badge by ranking #3rd two or more in any season of the ''Chronos Challenge'' 2024.', 'https://cdn-icons-png.flaticon.com/128/3392/3392379.png', 'Shared Badges', 'Chronos challenge badges (Exclusive)'),
('Teamplayer of time', 'Claim this badge by making a 25% impact on final team results in any season of the ''Chronos Challenge'' 2024.', 'https://cdn-icons-png.flaticon.com/128/1036/1036338.png', 'Shared Badges', 'Chronos challenge badges (Exclusive)'),

-- Shared Badges > Hidden badges (Unique)
('First of his knowledge', 'Claim this badge by being the first to claim a ''knowledge badge''.', 'https://cdn-icons-png.flaticon.com/128/13745/13745903.png', 'Shared Badges', 'Hidden badges (Unique)'),
('The Connection King', 'Claim this badge by receiving 50 or more ''awesome'' reviews in 6 months or less.', 'https://cdn-icons-png.flaticon.com/128/12772/12772432.png', 'Shared Badges', 'Hidden badges (Unique)'),
('Portal Master', 'Claim this badge by traveling for 100h or more in 6 months or less.', 'https://cdn-icons-png.flaticon.com/128/8558/8558271.png', 'Shared Badges', 'Hidden badges (Unique)'),
('Time is of the Essence', 'Claim this badge by being the first ever to register 100% of their time during one month.', 'https://cdn-icons-png.flaticon.com/128/6606/6606357.png', 'Shared Badges', 'Hidden badges (Unique)'),
('?????', '?????', 'https://cdn-icons-png.flaticon.com/128/5727/5727965.png', 'Shared Badges', 'Hidden badges (Unique)'),
-- Duplicate ????? entries handled by just adding one or unique constraint might ignore. Adding second ?????
('?????', '?????', 'https://cdn-icons-png.flaticon.com/128/5727/5727965.png', 'Shared Badges', 'Hidden badges (Unique)'),

-- Shared Badges > Special badges
('The Chronos Crown', 'Claim this badge by winning the ''Time Masters'' competition 2024/25.', 'https://cdn-icons-png.flaticon.com/128/15534/15534859.png', 'Shared Badges', 'Special badges'),
('Ticket thief', 'Claim this badge by closing 100 tickets not assigned to you.', 'https://cdn-icons-png.flaticon.com/128/2302/2302312.png', 'Shared Badges', 'Special badges'),
('Boss fight', 'Defeat the final boss.', 'https://cdn-icons-png.flaticon.com/128/5442/5442786.png', 'Shared Badges', 'Special badges'),
('Pokémon trainer', 'Train a pokémon to lvl 100 or above.', 'https://cdn-icons-png.flaticon.com/128/361/361998.png', 'Shared Badges', 'Special badges'),
('Excalibur', '????', 'https://cdn-icons-png.flaticon.com/128/3196/3196237.png', 'Shared Badges', 'Special badges'),
('Task Titan', 'Complete 100 project-tasks.', 'https://cdn-icons-png.flaticon.com/128/12249/12249977.png', 'Shared Badges', 'Special badges'),
('Finish Line Hero', 'On a large project be the one to close the last ticket.', 'https://cdn-icons-png.flaticon.com/128/4492/4492608.png', 'Shared Badges', 'Special badges'),

-- Shared Badges > Agent status badges
('Veteran Agent', 'Claim this badge by being an agent in HaloPSA for 1 year.', 'https://cdn-icons-png.flaticon.com/128/11693/11693134.png', 'Shared Badges', 'Agent status badges'),
('Master Agent', 'Claim this badge by being an agent in HaloPSA for 2 years.', 'https://cdn-icons-png.flaticon.com/128/12343/12343934.png', 'Shared Badges', 'Agent status badges'),
('Guru Agent', 'Claim this badge by being an agent in HaloPSA for 3 years.', 'https://cdn-icons-png.flaticon.com/128/5757/5757458.png', 'Shared Badges', 'Agent status badges'),
('Ascended Agent', 'Claim this badge by being an agent in HaloPSA for 5 years.', 'https://cdn-icons-png.flaticon.com/128/15097/15097108.png', 'Shared Badges', 'Agent status badges'),
('!-The One-!', 'Claim this badge by being an agent in HaloPSA for 10 years.', 'https://cdn-icons-png.flaticon.com/128/208/208962.png', 'Shared Badges', 'Agent status badges'),

-- Servicedesk Badges > Knowledge badges
('Veteran of knowledge', 'Claim this badge by contributing 25 knowledge base articles.', 'https://cdn-icons-png.flaticon.com/128/1644/1644231.png', 'Servicedesk Badges', 'Knowledge badges'),
('Master of knowledge', 'Claim this badge by contributing 50 knowledge base articles.', 'https://cdn-icons-png.flaticon.com/128/17483/17483004.png', 'Servicedesk Badges', 'Knowledge badges'),
('Guru of knowledge', 'Claim this badge by contributing 100 knowledge base articles.', 'https://cdn-icons-png.flaticon.com/128/17482/17482995.png', 'Servicedesk Badges', 'Knowledge badges'),
('!-Bird of knowledge-!', 'Claim this badge by contributing 500 knowledge base articles.', 'https://cdn-icons-png.flaticon.com/128/15161/15161974.png', 'Servicedesk Badges', 'Knowledge badges'),

-- Servicedesk Badges > SLA 'on time resolution' badges
('SLA Veteran', 'Claim this badge by having 95% ''on time resolution'' during 1 month.', 'https://cdn-icons-png.flaticon.com/128/14580/14580718.png', 'Servicedesk Badges', 'SLA ''on time resolution'' badges'),
('SLA Master', 'Claim this badge by having 95% ''on time resolution'' during 2 months in a row.', 'https://cdn-icons-png.flaticon.com/128/14580/14580872.png', 'Servicedesk Badges', 'SLA ''on time resolution'' badges'),
('SLA Guru', 'Claim this badge by having 95% ''on time resolution'' during 3 months in a row.', 'https://cdn-icons-png.flaticon.com/128/14580/14580673.png', 'Servicedesk Badges', 'SLA ''on time resolution'' badges'),
('SLA Ascended', 'Claim this badge by having 95% ''on time resolution'' during 6 months in a row.', 'https://cdn-icons-png.flaticon.com/128/14580/14580616.png', 'Servicedesk Badges', 'SLA ''on time resolution'' badges'),
('!-Resolutionist-!', 'Claim this badge by having 95% ''on time resolution'' during 1 full year .', 'https://cdn-icons-png.flaticon.com/128/14580/14580627.png', 'Servicedesk Badges', 'SLA ''on time resolution'' badges'),

-- Servicedesk Badges > SLA 'avg.response time' badges
('Responder Veteran', 'Claim this badge by having 1h avg. response time during 1 month.', 'https://cdn-icons-png.flaticon.com/128/17200/17200051.png', 'Servicedesk Badges', 'SLA ''avg.response time'' badges'),
('Responder Master', 'Claim this badge by having 1h avg. response time during 2 months in a row.', 'https://cdn-icons-png.flaticon.com/128/17199/17199974.png', 'Servicedesk Badges', 'SLA ''avg.response time'' badges'),
('Responder Guru', 'Claim this badge by having 1.5h avg. response time during 3 month in a row.', 'https://cdn-icons-png.flaticon.com/128/17199/17199970.png', 'Servicedesk Badges', 'SLA ''avg.response time'' badges'),
('Responder Ascended', 'Claim this badge by having 1.5h avg. response time during 6 month in a row.', 'https://cdn-icons-png.flaticon.com/128/17199/17199990.png', 'Servicedesk Badges', 'SLA ''avg.response time'' badges'),
('!-First Responder-!', 'Claim this badge by having 1.5h avg.response time during 1 year.', 'https://cdn-icons-png.flaticon.com/128/17199/17199950.png', 'Servicedesk Badges', 'SLA ''avg.response time'' badges'),

-- Consultant Badges > Special consultant badges
('Deadline Dynamo', 'Complete 100 large and 100 small projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/9419/9419011.png', 'Consultant Badges', 'Special consultant badges'),
('Task Shuffler', 'Complete 15 tasks connected to projects in one day.', 'https://cdn-icons-png.flaticon.com/128/4694/4694472.png', 'Consultant Badges', 'Special consultant badges'),
('Success Sage', 'Success is the word...', 'https://cdn-icons-png.flaticon.com/128/10997/10997732.png', 'Consultant Badges', 'Special consultant badges'),

-- Consultant Badges > Project badges
('Small project veteran', 'Close 25 small projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/14353/14353831.png', 'Consultant Badges', 'Project badges'),
('Small project master', 'Close 50 small projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/14353/14353981.png', 'Consultant Badges', 'Project badges'),
('Small project guru', 'Close 75 small projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/14354/14354055.png', 'Consultant Badges', 'Project badges'),
('Projects is my thing!', 'Close 50 small and 10 large projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/4580/4580385.png', 'Consultant Badges', 'Project badges'),
('Project Prodigy', 'Close 50 large projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/15756/15756869.png', 'Consultant Badges', 'Project badges'),
('Project Pioneer', 'Close 100 large projects on or before their end-date.', 'https://cdn-icons-png.flaticon.com/128/2086/2086349.png', 'Consultant Badges', 'Project badges');

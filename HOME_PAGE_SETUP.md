# Home Page Setup Guide

## Overview
The Home page now displays two columns:
1. **Company News** - Knowledge base articles from Halo's "News (internt)" folder
2. **Message Board** - Editable announcements managed in the Admin CMS

## Setup Instructions

### 1. Create Message Board Table in Supabase

Run the SQL from `SETUP_MESSAGE_BOARD.sql` in your Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS public.message_board (
  id TEXT PRIMARY KEY DEFAULT 'main',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and create policies...
```

### 2. Configure Halo Integration (for Company News)

Set the following environment variable in your Vercel project:

- **HALO_NEWS_FOLDER_ID**: The folder ID in Halo for "News (internt)"

To find the folder ID:
1. Go to your Halo instance
2. Navigate to Knowledge Base
3. Find the "News (internt)" folder
4. The folder ID is in the URL or API response

### 3. Files Created/Modified

**New Files:**
- `/src/app/api/halo/news/route.ts` - Fetches news articles from Halo KB
- `/src/app/api/message-board/route.ts` - Manages message board content
- `SETUP_MESSAGE_BOARD.sql` - Database setup script

**Modified Files:**
- `/src/app/page.tsx` - Home page with two-column layout
- `/src/app/admin/page.tsx` - Added Message Board CMS section

### 4. Admin Interface

Admins can now:
1. Go to Admin page → **Message Board** tab
2. Edit the title and content
3. Click **Save Message** to update

The message is displayed on the home page in the right column.

### 5. Company News

The left column automatically fetches and displays:
- Latest articles from Halo's "News (internt)" folder
- Article titles, summaries, and links
- Updates automatically when Halo KB is updated

## API Endpoints

### GET /api/message-board
Returns the current message board content:
```json
{
  "message": {
    "id": "main",
    "title": "Welcome",
    "content": "Welcome to the app!",
    "updated_at": "2025-12-01T09:00:00Z"
  }
}
```

### POST /api/message-board
Updates the message board (admin only):
```json
{
  "title": "Important Update",
  "content": "This is an important announcement..."
}
```

### GET /api/halo/news
Returns company news articles:
```json
{
  "articles": [
    {
      "id": 123,
      "title": "Article Title",
      "summary": "Article summary...",
      "url": "https://halo.example.com/kb/article/123"
    }
  ]
}
```

## Troubleshooting

### No news articles showing
- Check that `HALO_NEWS_FOLDER_ID` is set correctly in Vercel
- Verify the folder ID exists in your Halo instance
- Check browser console for API errors

### Message board not saving
- Ensure you're logged in as an admin
- Check that the `message_board` table exists in Supabase
- Verify RLS policies are correctly set

### Database errors
- Run the SQL setup script in Supabase
- Ensure RLS is enabled on the table
- Check that policies are created correctly

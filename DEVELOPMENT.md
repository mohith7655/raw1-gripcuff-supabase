# Development Guide

## Environment Variables

For local development, create a `.env.local` file in the project root (already gitignored):

```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
EXPO_PUBLIC_AGORA_APP_ID=your_agora_app_id
```

Use `.env.example` as the reference for all available variables.

**For production (Netlify):** set these in the Netlify dashboard under  
Site Settings → Environment Variables. Never commit real keys to git.

> After adding or changing environment variables in Netlify, trigger a manual  
> redeploy: Deploys → Trigger deploy → Deploy site.

## Getting API Keys

- **Google Places API**: Google Cloud Console → APIs & Services → Credentials  
  Enable: Places API. For production, restrict the key to your Netlify domain.

- **Agora**: Agora Console → Project Management

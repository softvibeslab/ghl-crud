# Deployment Guide - EasyPanel + Supabase Self-Hosted

## Prerequisites

- VPS with EasyPanel installed
- Domain pointing to your VPS
- Git repository (GitHub, GitLab, etc.)

---

## Step 1: Deploy Supabase on EasyPanel

### Option A: Use EasyPanel Supabase Template (Recommended)

1. Open EasyPanel dashboard
2. Click **"Create"** > **"Templates"**
3. Search for **"Supabase"**
4. Click **"Deploy"**
5. Configure:
   - **Domain**: `supabase.tu-dominio.com`
   - **JWT Secret**: Generate a secure 32+ character string
   - **Postgres Password**: Set a strong password

6. Wait for deployment to complete (~5 minutes)

7. Access Supabase Studio at: `https://supabase.tu-dominio.com`

### Option B: Manual Docker Compose

If template not available, use the official Supabase self-hosting guide:
https://supabase.com/docs/guides/self-hosting/docker

---

## Step 2: Configure Supabase Database

1. Open Supabase Studio: `https://supabase.tu-dominio.com`

2. Go to **SQL Editor**

3. Run the migration file:
   - Copy contents of `supabase/migrations/20240104000000_ghl_schema.sql`
   - Paste and execute in SQL Editor

4. (Optional) Run seed data:
   - Copy contents of `supabase/seed.sql`
   - Paste and execute

5. Get your API keys:
   - Go to **Settings** > **API**
   - Copy **anon/public** key
   - Copy **service_role** key (keep secret!)

---

## Step 3: Push Code to Git Repository

```bash
# Initialize git if not done
git init
git add .
git commit -m "Initial commit - GHL CRM"

# Push to your repository
git remote add origin https://github.com/tu-usuario/ghl-crud.git
git push -u origin main
```

---

## Step 4: Deploy Next.js App on EasyPanel

1. Open EasyPanel dashboard

2. Click **"Create"** > **"App"**

3. Configure:
   - **Name**: `ghl-crm`
   - **Source**: GitHub/GitLab
   - **Repository**: Select your repo
   - **Branch**: `main`
   - **Build**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile`

4. Set **Environment Variables**:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://supabase.tu-dominio.com
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-from-step-2
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-from-step-2
   ```

5. Configure **Domain**:
   - Add domain: `crm.tu-dominio.com`
   - Enable HTTPS (Let's Encrypt)

6. Click **"Deploy"**

---

## Step 5: Verify Deployment

1. Open your app: `https://crm.tu-dominio.com`

2. Register a new user

3. Check email confirmation (configure SMTP in Supabase for production)

4. Login and verify dashboard shows data

---

## Production Checklist

### Security
- [ ] Strong JWT secret (32+ characters)
- [ ] Strong Postgres password
- [ ] HTTPS enabled on all services
- [ ] Environment variables secured (not in code)

### Email (Required for Auth)
Configure SMTP in Supabase:
1. Go to Supabase Studio > Authentication > Email Templates
2. Configure SMTP settings with your email provider

### Backups
- [ ] Enable automated Postgres backups in EasyPanel
- [ ] Test backup restoration

### Monitoring
- [ ] Enable EasyPanel resource monitoring
- [ ] Set up alerts for high CPU/memory

---

## Environment Variables Reference

| Variable | Description | Where to Get |
|----------|-------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL | Your Supabase domain |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key | Supabase > Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key | Supabase > Settings > API |

---

## Troubleshooting

### App not starting
- Check EasyPanel logs for errors
- Verify environment variables are set
- Ensure Supabase is accessible from the app

### Auth not working
- Verify Supabase URL is correct (with https://)
- Check anon key is correct
- Configure Site URL in Supabase Auth settings

### Database connection errors
- Verify Supabase is running
- Check network connectivity between containers
- Verify credentials

---

## Support

- EasyPanel Docs: https://easypanel.io/docs
- Supabase Self-Hosting: https://supabase.com/docs/guides/self-hosting
- Next.js Deployment: https://nextjs.org/docs/deployment

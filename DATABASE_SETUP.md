# FAD HOMES AND PROPERTIES Database Setup

This site uses Supabase for properties, promo images, and admin uploads.

## 1. Create Supabase Project

1. Go to `https://supabase.com/dashboard`.
2. Create a new project.
3. Wait for the project to finish provisioning.

## 2. Run The Schema

1. Open the project.
2. Go to `SQL Editor`.
3. Open `supabase-schema.sql` from this repo.
4. Paste the full file into Supabase.
5. Run it.

This creates:
- `properties`
- `promos`
- `admins`
- `property-images` storage bucket
- `promo-images` storage bucket
- public read policies
- authenticated admin write/upload policies

## 3. Add Project Keys

1. Go to `Project Settings`.
2. Open `API`.
3. Copy the `Project URL`.
4. Copy the `anon public` key.
5. Paste both into `supabase-config.js`.

```js
export const SUPABASE_URL = "YOUR_PROJECT_URL";
export const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
```

## 4. Secure Admin Login

Create the admin user in Supabase Auth:

1. Go to `Authentication`.
2. Open `Users`.
3. Click `Add user`.
4. Enter the admin email and a strong password.
5. Create the user.
6. Copy the user's `User UID`.

Then open `SQL Editor` and run this, replacing the values:

```sql
insert into public.admins (user_id, email)
values ('PASTE_USER_UID_HERE', 'fadilullahhomesandproperty@gmail.com')
on conflict (user_id) do update set email = excluded.email;
```

The site now uses Supabase Auth. The password is not stored in frontend code.

Public visitors can read properties and promos. Only users listed in `public.admins` can add, update, delete, or upload property media.

## 5. Property Fields

The admin panel saves:
- title
- location
- category
- bedrooms
- bathrooms
- description
- price
- images
- media, including image/video URLs
- status

Search on the homepage checks all property fields, including location and category.

## 6. Enabling Video Uploads

Run the latest `supabase-schema.sql` again in SQL Editor. It adds the `media` JSON column used for mixed image/video uploads.

Then check Supabase Storage:

1. Open `Storage`.
2. Open `property-images`.
3. Go to bucket settings.
4. If there is a file size limit, raise it high enough for walkthrough videos.
5. If allowed MIME types are restricted, allow:
   - `image/jpeg`
   - `image/png`
   - `image/webp`
   - `video/mp4`
   - `video/webm`
   - `video/quicktime`

The site still uses the `property-images` bucket for both images and videos.

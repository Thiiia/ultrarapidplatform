This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## School roster imports

Administrators can open **Admin → School rosters → Import** to upload a CSV, preview its database changes, and apply it. A template is available from the import page.

The required columns are:

```text
student_external_id,student_email,student_name,class_external_id,class_name,teacher_external_id,teacher_email,teacher_name,term
```

- **Additive** imports create and update records without removing existing enrollments.
- **Full reconciliation** also removes memberships missing from represented classes and deactivates school students absent from the uploaded roster.
- Applying the same roster repeatedly is safe because students and classes use school-scoped external IDs.
- Imported users remain `invited` until they sign in with a verified matching Auth0 email.

Apply the Prisma migrations before enabling roster imports in an environment:

```bash
npx prisma migrate deploy
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

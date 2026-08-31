/** @type {import('next').NextConfig} */
const nextConfig = {
  // ESLint isn't a dependency of this project; skip it during `next build`.
  eslint: { ignoreDuringBuilds: true },
  // Keep TypeScript type-checking ON during builds — it's part of the honesty story.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;

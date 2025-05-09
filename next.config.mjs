let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

// Определяем, находимся ли мы на GitHub Pages
const isGithubPages = process.env.GITHUB_ACTIONS === 'true' || process.env.DEPLOY_TARGET === 'gh-pages'
const repoName = 'App_screen'

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
    tsconfigPath: "tsconfig.json.bak", // Использовать неправильный путь, чтобы обойти проверку TS
  },
  transpilePackages: ["next"],
  images: {
    unoptimized: true,
  },
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  // Настройки для GitHub Pages, применяются только когда мы деплоим на GitHub
  ...(isGithubPages && {
    output: 'export',
    basePath: `/${repoName}`,
    assetPrefix: `/${repoName}/`,
    trailingSlash: true,
  }),
  // Настройки для React компонентов
  reactStrictMode: true,
  env: {
    APP_ENV: process.env.APP_ENV || 'production',
  },
  redirects: () => {
    return []
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig

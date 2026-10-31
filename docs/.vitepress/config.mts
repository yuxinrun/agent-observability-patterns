import { defineConfig } from 'vitepress'
import { catalog } from './data/catalog'
import { ecosystem, siteMeta } from './data/ecosystem'

const sidebarZh = [
  {
    text: '开始',
    items: [
      { text: '阅读指南', link: '/start/' },
      { text: '生态全景：五块拼图', link: '/ecosystem/#top' },
    ],
  },
  ...catalog.map((c) => ({
    text: `${c.num} · ${c.zhTitle}`,
    link: `/${c.slug}/`,
    collapsed: true,
    items: [
      { text: '本章导语', link: `/${c.slug}/#top` },
      ...c.sections.map((s) => ({ text: s.zh, link: `/${c.slug}/#${s.id}` })),
    ],
  })),
  {
    text: '附录',
    items: [
      { text: '术语表', link: '/glossary/' },
      { text: '延伸阅读与规范原文', link: '/reading/' },
    ],
  },
]

const sidebarEn = [
  {
    text: 'Start here',
    items: [
      { text: 'How to read this', link: '/en/start/' },
      { text: 'The five-piece map', link: '/en/ecosystem/#top' },
    ],
  },
  ...catalog.map((c) => ({
    text: `${c.num} · ${c.enTitle}`,
    link: `/en/${c.slug}/`,
    collapsed: true,
    items: [
      { text: 'Chapter intro', link: `/en/${c.slug}/#top` },
      ...c.sections.map((s) => ({ text: s.en, link: `/en/${c.slug}/#${s.id}` })),
    ],
  })),
  {
    text: 'Appendix',
    items: [
      { text: 'Glossary', link: '/en/glossary/' },
      { text: 'Further reading', link: '/en/reading/' },
    ],
  },
]

const ecoNavZh = {
  text: '生态',
  items: ecosystem.map((e) => ({
    text: `${e.name} · ${e.zhRole}`,
    link: e.url,
  })),
}

const ecoNavEn = {
  text: 'Ecosystem',
  items: ecosystem.map((e) => ({
    text: `${e.name} · ${e.enRole}`,
    link: e.url,
  })),
}

export default defineConfig({
  base: '/agent-observability-patterns/',
  lang: 'zh-CN',
  title: 'Agent 可观测性模式手册',
  description:
    'Agent 可观测性工程模式完全手册：Trace、Metrics、Logs、Evals、告警与看板，中英双语，拿来就能上线。',
  cleanUrls: false,
  lastUpdated: false,
  sitemap: {
    hostname: 'https://yuxinrun.github.io/agent-observability-patterns/',
  },
  head: [
    [
      'link',
      { rel: 'icon', type: 'image/svg+xml', href: '/agent-observability-patterns/favicon.svg' },
    ],
    [
      'link',
      {
        rel: 'icon',
        href: '/agent-observability-patterns/favicon.ico',
        sizes: 'any',
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/agent-observability-patterns/favicon-32.png',
      },
    ],
    ['link', { rel: 'apple-touch-icon', href: '/agent-observability-patterns/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#0a958a' }],
    ['meta', { property: 'og:type', content: 'website' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'Agent 可观测性模式手册 · Agent Observability Patterns',
      },
    ],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Instrument, trace, measure and alert your agent stack. Bilingual field guide with runnable demos.',
      },
    ],
    [
      'meta',
      {
        property: 'og:url',
        content: 'https://yuxinrun.github.io/agent-observability-patterns/',
      },
    ],
  ],
  markdown: {
    lineNumbers: true,
    // 代码块在明暗两种模式下都使用深色面板，因此统一采用深色 token，
    // 避免浅色模式出现「浅底主题色 + 深色背景」的低对比度问题。
    theme: { light: 'vitesse-dark', dark: 'vitesse-dark' },
    container: {
      tipLabel: '人话翻译',
      warningLabel: '注意',
      dangerLabel: '危险',
      infoLabel: '说明',
      detailsLabel: '展开',
    },
  },
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'Agent 可观测性模式手册',
      description:
        'Agent 可观测性工程模式完全手册：Trace、Metrics、Logs、Evals、告警与看板，中英双语，拿来就能上线。',
      themeConfig: {
        nav: [
          { text: '阅读指南', link: '/start/' },
          {
            text: '章节',
            items: catalog.map((c) => ({ text: `${c.num} · ${c.zhTitle}`, link: `/${c.slug}/` })),
          },
          { text: '追踪模式', link: '/traces/' },
          { text: 'Demo 与模板', link: '/demos/' },
          ecoNavZh,
        ],
        sidebar: sidebarZh,
        outline: { level: [2, 3], label: '本页目录' },
        docFooter: { prev: '上一章', next: '下一章' },
        lastUpdated: { text: '最后更新' },
        darkModeSwitchLabel: '主题',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        sidebarMenuLabel: '目录',
        returnToTopLabel: '回到顶部',
        langMenuLabel: '切换语言',
        externalLinkIcon: true,
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'Agent Observability Patterns',
      description:
        'The complete field guide to agent observability: traces, metrics, logs, evals, alerts and dashboards.',
      themeConfig: {
        nav: [
          { text: 'How to read', link: '/en/start/' },
          {
            text: 'Chapters',
            items: catalog.map((c) => ({ text: `${c.num} · ${c.enTitle}`, link: `/en/${c.slug}/` })),
          },
          { text: 'Tracing', link: '/en/traces/' },
          { text: 'Demos', link: '/en/demos/' },
          ecoNavEn,
        ],
        sidebar: sidebarEn,
        outline: { level: [2, 3], label: 'On this page' },
        docFooter: { prev: 'Previous', next: 'Next' },
        lastUpdated: { text: 'Last updated' },
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light theme',
        darkModeSwitchTitle: 'Switch to dark theme',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Return to top',
        langMenuLabel: 'Change language',
        externalLinkIcon: true,
      },
    },
  },
  themeConfig: {
    logo: { src: '/logo.svg', alt: 'Agent Observability Patterns' },
    siteTitle: 'Agent Observability',
    socialLinks: [{ icon: 'github', link: siteMeta.repo }],
    footer: {
      message:
        '内容基于 OpenTelemetry GenAI 语义约定、Anthropic 与 OpenAI 的 Agent 追踪实践整理，示例仅用于教学。',
      copyright: `© ${new Date().getFullYear()} 鱼心 · Yuxin · MIT`,
    },
  },

  vite: {
    server: { port: 5190 },
  },
})

import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

const sourceFiles = ['src/**/*.{js,ts,vue}']
const maintainedFiles = [
  ...sourceFiles,
  'scripts/*.mjs',
  'deploy/*.mjs',
  'tests/**/*.mjs',
  '*.{config.js,config.mjs}',
]

export default [
  {
    ignores: [
      '**/node_modules/**',
      'dist/**',
      'dist-*/**',
      'tmp/**',
      'outputs/**',
      'backups/**',
      '动效组件库/**',
      '作品/**',
      '参考资料/**',
      '上线交付/**',
      '网站部署文件/**',
      '逆向工程工具/**',
      '.workbuddy-ai/**',
    ],
  },
  { ...js.configs.recommended, files: maintainedFiles },
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: sourceFiles })),
  ...vue.configs['flat/essential'],
  {
    files: ['scripts/*.mjs', 'deploy/*.mjs', 'tests/**/*.mjs', '*.config.{js,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: sourceFiles,
    languageOptions: { globals: globals.browser },
    rules: {
      // `_` 表示接口要求保留、当前实现故意不消费的参数。
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 现有根级加载组件保持公开名称；其余新组件仍执行多词命名规则。
      'vue/multi-word-component-names': ['error', { ignores: ['Preloader'] }],
    },
  },
  {
    files: ['deploy/*.mjs'],
    languageOptions: { globals: { FixedLengthStream: 'readonly' } },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  prettier,
]

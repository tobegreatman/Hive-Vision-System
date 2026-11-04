import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import boundaries from 'eslint-plugin-boundaries'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/** FSD 层级：白名单由上到下递减，只允许向下依赖。 */
const LAYERS = ['app', 'pages', 'widgets', 'features', 'entities', 'shared']

const elementDescriptors = [
  ...LAYERS.map((layer) => ({ type: layer, pattern: `src/${layer}/**` })),
  // 前后端共享的 Zod 契约包：独立分类，任何层都可消费
  { type: 'contracts', pattern: 'packages/contracts/**' },
]

const layerPolicies = [
  ...LAYERS.map((layer, index) => ({
    from: { element: { type: layer } },
    allow: { to: { element: { types: LAYERS.slice(index + 1) } } },
  })),
  // 第三方依赖不属于分层，任何层都可以引用
  {
    from: { element: { types: LAYERS } },
    allow: { to: { module: { origin: 'external' } } },
  },
  // 共享契约包是跨层的只读依赖
  {
    from: { element: { types: LAYERS } },
    allow: { to: { element: { type: 'contracts' } } },
  },
]

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules', 'public', 'tools', 'packages/*/dist', '*.d.ts', 'eslint.config.js'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/essential'],

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      eqeqeq: ['error', 'smart'],
      'prefer-const': 'error',
    },
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
  },

  {
    files: ['src/**/*.{ts,vue}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: { project: './tsconfig.json' },
        node: { extensions: ['.ts', '.vue', '.js'] },
      },
      'boundaries/elements': elementDescriptors,
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: layerPolicies,
          message:
            'FSD 违规：{{ from.element.type }} 层不允许依赖 {{ to.element.type }} 层（依赖只能自上而下）',
        },
      ],
      'boundaries/no-unknown-dependencies': 'error',
    },
  },

  {
    files: ['server/**/*.ts', 'packages/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  prettier,
)

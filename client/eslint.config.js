import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // The standard "fetch on mount" pattern (useEffect calling an async
      // loader that eventually calls setState) is idiomatic React and is
      // used throughout this app's pages for loading server data. This
      // experimental rule flags that pattern as unsafe; disable it rather
      // than contort every data-loading effect.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])

import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier/flat'

export default tseslint.config(eslint.configs.recommended, tseslint.configs.recommended, prettierConfig)

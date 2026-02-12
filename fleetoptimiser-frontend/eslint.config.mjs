import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
    ...nextVitals,
    ...nextTs,
    globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
    {
        rules: {
            '@typescript-eslint/no-unused-vars': 'off',
            'react-hooks/purity': 'off',
            'react-hooks/incompatible-library': 'off',
        },
    },
])

export default eslintConfig

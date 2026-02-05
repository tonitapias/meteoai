import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import react from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignorem carpetes de build i fitxers generats pel Service Worker
  { ignores: ['dist', 'dev-dist', 'sw.js', 'workbox-*.js'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      react,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      
      // 1. GESTIÓ DE CONSOLA (Permetem errors i warnings, bloquegem logs bruts)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      
      // 2. TYPESCRIPT STRICTE (RISC ZERO)
      // Canviem a 'error' per prohibir nous 'any'
      '@typescript-eslint/no-explicit-any': 'error',
      
      // Ignorem variables que comencin per _
      '@typescript-eslint/no-unused-vars': ['warn', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_' 
      }],

      // Regles recomanades de React
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
    },
    settings: {
      react: { 
        // CANVI CRÍTIC: Autodetectar versió per suportar React 19 correctament
        version: 'detect' 
      },
    },
  },
);
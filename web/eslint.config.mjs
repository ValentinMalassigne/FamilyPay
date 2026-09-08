// Flat config ESLint pour Next.js 16.
// eslint-config-next 16 exporte nativement des tableaux de flat config
// (plus besoin de FlatCompat, qui était l'approche Next 15 / eslintrc).
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;

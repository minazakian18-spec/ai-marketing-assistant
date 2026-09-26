import {defineConfig,globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
export default defineConfig([...nextVitals,globalIgnores(['.next/**','node_modules/**','.claude/**']),{rules:{'react-hooks/set-state-in-effect':'off','react-hooks/refs':'off','react-hooks/purity':'off'}}]);

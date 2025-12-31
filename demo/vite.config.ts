import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@lumina/sdk': path.resolve(__dirname, '../sdk/src/index.ts')
        }
    },
    server: {
        fs: {
            allow: ['..']
        }
    }
});

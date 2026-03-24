import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import path from 'path';

export default defineConfig({
    plugins: [solidPlugin()],
    resolve: {
        alias: {
            '@slutsnus/shared': path.resolve(__dirname, '../shared/src/index.ts'),
        },
    },
    server: {
        port: 3003,
        proxy: {
            '/api': { target: 'http://localhost:4000', changeOrigin: true, configure: (proxy) => { proxy.on('error', () => {}); } },
            '/uploads': { target: 'http://localhost:4000', changeOrigin: true, configure: (proxy) => { proxy.on('error', () => {}); } },
            '/socket.io': {
                target: 'http://localhost:4000',
                ws: true,
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('error', () => {});
                    proxy.on('proxyReqWsErr', () => {});
                },
            },
        },
    },
});

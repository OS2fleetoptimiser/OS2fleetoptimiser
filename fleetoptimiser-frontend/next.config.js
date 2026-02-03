/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/fleet/:path*',
                destination: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'http://backend:3001'}/:path*`,
            },
        ];
    },
};

module.exports = nextConfig;

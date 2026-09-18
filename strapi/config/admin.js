// Dev-only fallbacks so a fresh local checkout boots without extra setup.
// In production these env vars are required — an undefined secret makes
// Strapi fail to boot instead of silently running with a known value.
const devFallback = (value) => (env) => env('NODE_ENV', 'development') === 'production' ? undefined : value;

module.exports = ({ env }) => ({
  autoOpen: false,
  auth: {
    secret: env('ADMIN_AUTH_SECRET', devFallback('lycie-admin-auth-secret-dev-only')(env)),
  },
  apiToken: {
    salt: env('API_TOKEN_SALT', devFallback('lycie-api-token-salt-dev-only')(env)),
  },
  transfer: {
    token: {
      salt: env('TRANSFER_TOKEN_SALT', devFallback('lycie-transfer-token-salt-dev-only')(env)),
    },
  },
  secrets: {
    encryptionKey: env('ADMIN_ENCRYPTION_KEY', devFallback('lycie-admin-encryption-key-dev-only')(env)),
  },
});

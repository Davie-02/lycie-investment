module.exports = ({ env }) => ({
  // Public self-registration is off: nothing in this app uses the
  // users-permissions public role — the NestJS server reads content
  // through a scoped API token instead (see server/src/cms).
  'users-permissions': {
    enabled: true,
    config: {
      jwt: { expiresIn: '7d' },
      register: { allowed: false },
    },
  },
  'content-manager': {
    enabled: true,
    config: {
      icons: {},
    },
  },
  'content-type-builder': {
    enabled: true,
  },
});

module.exports = ({ env }) => {
  const connectionString = env('DATABASE_URL');
  // Disable SSL for local development (local Postgres doesn't support it)
  const ssl = !connectionString.includes('localhost');
  return {
    connection: {
      client: 'postgres',
      connection: {
        connectionString,
        ssl: ssl ? { rejectUnauthorized: false } : false,
      },
      pool: { min: 2, max: 10 },
    },
  };
};

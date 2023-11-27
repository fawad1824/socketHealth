module.exports = {
    development: {
      client: 'mysql',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USERS ||'new_user',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'sockets',
      },
      migrations: {
        directory: './db/migrations',
      },
      seeds: {
        directory: './db/seeds',
      },
    },
    // Other environments like production, staging, etc., can be added here
  };

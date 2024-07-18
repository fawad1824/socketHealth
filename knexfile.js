module.exports = {
  development: {
    client: 'mysql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  },
  production: {
    client: 'mysql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations'
    },
    seeds: {
      directory: './seeds'
    }
  }
};

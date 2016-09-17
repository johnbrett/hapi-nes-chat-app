const day = 24 * 60 * 60 * 1000;

module.exports = {
  server: {
    port: process.env.PORT || 3000
  },
  auth: {
    session: {
      expiry: process.env.CHAT_APP_AUTH_SESSION_EXPIRY || (3 * day)
    },
    github: {
      provider: 'github',
      password: process.env.CHAT_APP_AUTH_GITHUB_PASSWORD || 'this-is-a-32-digit-password-so-it-is',
      isSecure: process.env.CHAT_APP_AUTH_GITHUB_ISSECURE || false,
      clientId: process.env.CHAT_APP_AUTH_GITHUB_CLIENTID || '', // You can aquire this here: https://github.com/settings/applications/new
      clientSecret: process.env.CHAT_APP_AUTH_GITHUB_CLIENTSECRET || '' // same as above
    },
    cookie: {
      password: process.env.CHAT_APP_AUTH_COOKIE_PASSWORD || 'password-must-be-at-least-32-characters',
      isSecure: process.env.CHAT_APP_AUTH_COOKIE_ISSECURE || false
    }
  }
}
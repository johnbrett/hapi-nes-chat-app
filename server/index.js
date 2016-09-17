//Import Modules
const Hapi = require('hapi');
const Nes = require('nes');
const Bell = require('bell');
const CookieAuth = require('hapi-auth-cookie');
const BearerAuth = require('hapi-auth-bearer-token');
const Inert = require('inert');
const Vision = require('vision');
const Blipp = require('blipp');
const Hoek = require('hoek');
const HapiSwagger = require('hapi-swagger');
const Path = require('path');
const Good = require('good');
const Bunyan = require('bunyan');
const BunyanFormat = require('bunyan-format');

const config = require('./config');

// Internals
const internals = {
  uuid: 1
}

// Logging
internals.logger = Bunyan.createLogger({
  name: 'chat',
  level: 'trace',
  stream: BunyanFormat({ outputMode: 'short'})
});
internals.goodOptions = {
  reporters: {
    reporter: [{
      module: 'good-bunyan',
      args: [
        { ops: '*', response: '*', log: '*', error: '*', request: '*' },
        {
          logger: internals.logger,
          levels: { response: 'debug', request:  'debug', ops:  'debug' }
        }
      ]
    }]
  }
};

const server = new Hapi.Server();
server.connection({ port: config.server.port });

server.register([
    { register: Nes, options: { auth: { type: 'direct' } } }, Bell, CookieAuth, BearerAuth, Inert,
    { register: Blipp, options: { showAuth: true } }, Vision, HapiSwagger,
    { register: Good, options: internals.goodOptions}
], (err) => {

  Hoek.assert(!err, err);

  const cache = server.cache({ segment: 'sessions', expiresIn: config.auth.session.expiry });
  server.app.cache = cache;

  server.subscription('/api/chatroom/{id}');

  server.auth.strategy('github', 'bell', config.auth.github);

  server.auth.strategy('session', 'cookie', true, {
    cookie: 'session',
    password: config.auth.cookie.password,
    isSecure: config.auth.cookie.isSecure,
    isHttpOnly: false,
    redirectTo: '/auth/callback',
    redirectOnTry: true,
    validateFunc: function (request, session, callback) {
      cache.get(session.sid, (err, cached) => {

          if (err) {
              return callback(err, false);
          }
          if (!cached) {
              return callback(null, false);
          }

          return callback(null, true, cached.account);
      });
    }
  });

  const chatrooms = {};

  server.route([{
    method: 'POST',
    path: '/api/chatroom/{id*}',
    config: {
      description: 'Chat message handler',
      handler: (request, reply) => {

        const roomId = request.params.id ? request.params.id : 'public';
        const message = { message: request.payload.message };
        chatrooms[roomId] ? chatrooms[roomId].messages.push(message) : chatrooms[roomId] = {messages: [message]};

        server.publish(`/api/chatroom/${roomId}`, message);
        server.log('info', `new message in: /chatroom/${roomId}: ${message.message}`);
        return reply(message);
      },
      tags: ['api']
    }
  },
  {
    method: 'GET',
    path: '/api/chatroom/{id*}',
    config: {
      description: 'Get chat history',
      handler: (request, reply) => {

        const roomId = request.params.id ? request.params.id : 'public';
        const chatHistory = chatrooms[roomId] ? chatrooms[roomId].messages : [{message: 'You are the first here!'}];
        return reply(chatHistory);
      },
      tags: ['api']
    }
  },
  {
    method: '*',
    path: '/auth/callback',
    config: {
      auth: 'github',
      description: 'OAuth callback for Github',
      handler: (request, reply) => {

        const profile = request.auth.credentials.profile;
        const account = {
          uid: profile.id,
          username: profile.username,
          email: profile.email,
          displayName: profile.displayName,
          avatarUrl: profile.raw.avatar_url,
          githubUrl: profile.raw.url
        }
        const sid = String(++internals.uuid);
        request.server.app.cache.set(sid, { account: account }, 0, (err) => {

            if (err) {
                return reply(err);
            }
            request.cookieAuth.set({sid: sid});
            return reply.redirect('/');
        });
      }
    }
  },
  {
    method: '*',
    path: '/{params*}',
    config: {
      auth: {
        strategy: 'session',
        mode: 'try'
      },
      description: 'Static file server',
      handler: (request, reply) => {

        if (!request.auth.isAuthenticated) {
          return reply.redirect('/auth/callback')
        }

        return reply.file('./client/index.html' , {confine: false});
      }
    }
  },
  {
    method: 'GET',
    path: '/static/bundle.js',
    config: {
      description: 'Serve the websocket client library',
      handler: { file: './node_modules/nes/lib/client.js' }
    }
  },
  {
    method: 'GET',
    path: '/logout',
    config: {
      handler: (request, reply) => {

          request.cookieAuth.clear();
          return reply({logged: 'out'});
      }
    }
  }]);

  server.start((err) => {

    Hoek.assert(!err, err);
    console.log('Chat service running...');
  });
});

process.on('SIGINT', () => {

  console.log('\nShutting down chat service...');
  server.stop({timeout: 4000}, (err) => {

    if (err) {
      console.log(`There was an error shutting down the service: ${err}`);
    } else {
      console.log('Service shut down successfully.');
    }
    process.exit(0);
  })
})
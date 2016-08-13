const Hapi = require('hapi');
const Nes = require('nes');
const Inert = require('inert');
const Vision = require('vision');
const Blipp = require('blipp');
const Hoek = require('hoek');
const HapiSwagger = require('hapi-swagger');

// Logging
const Good = require('good');
const Bunyan = require('bunyan');
const BunyanFormat = require('bunyan-format');
const logger = Bunyan.createLogger({ name: 'chat-service', level: 'trace', stream: BunyanFormat({ outputMode: 'short' })});

const internals = {
  goodOptions: {
    reporters: {
      reporter: [{
        module: 'good-bunyan',
        args: [
          { ops: '*', response: '*', log: '*', error: '*', request: '*' },
          {
            logger: logger,
            levels: { response: 'debug', request:  'debug', ops:  'debug' }
          }
        ]
      }]
    }
  }
};

const server = new Hapi.Server();
server.connection({ port: 3000 });

server.register([ Nes, Inert, Blipp, Vision, HapiSwagger, {register: Good, options: internals.goodOptions} ], (err) => {

  Hoek.assert(!err, err);

  server.subscription('/api/chatroom/{id}');

  const chatrooms = {};

  server.route([{
    method: 'POST',
    path: '/api/chatroom/{id*}',
    config: {
      id: 'chatroom',
      handler: (request, reply) => {

        const roomId = request.params.id ? request.params.id : 'general';
        const message = { message: request.payload.message };
        chatrooms.roomId ? chatrooms.roomId.messages.push(message) : chatrooms.roomId = {messages: [message]};
        
        server.publish(`/api/chatroom/${roomId}`, message);
        server.log('info', `new message in: /chatroom/${roomId}: ${message.message}`);
        return reply(message);
      },
      description: 'Chat message handler',
      tags: ['api']
    }
  },
  {
    method: 'GET',
    path: '/api/chatroom/{id*}',
    config: {
      id: 'getChatroom',
      handler: (request, reply) => {

        const roomId = request.params.id ? request.params.id : 'general';
        const chatHistory = chatrooms.roomId ? chatrooms.roomId.messages : [{messages: {message: 'You are the first here!'}}];
        return reply(chatHistory);
      },
      description: 'Get chat history',
      tags: ['api']
    }
  }]);

  server.route([
    {
      method: 'GET',
      path: '/{params*}',
      config: {
        handler: { file: './lib/index.html' },
        description: 'Static file server'
      }
    },
    {
      method: 'GET',
      path: '/static/bundle.js',
      config: {
        handler: { file: './node_modules/nes/lib/client.js' },
        description: 'Serve the websocket client library'
      }
    }
  ]);

  server.start((err) => {

    Hoek.assert(!err, err);
    console.log('Chat service running...');
  });
});

process.on('SIGINT', () => {

  console.log('\nShutting down chat service...');
  process.exit(0);
})
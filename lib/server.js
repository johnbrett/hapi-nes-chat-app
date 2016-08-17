//Import Modules
const Hapi = require('hapi');
const Nes = require('nes');
const Inert = require('inert');
const Vision = require('vision');
const Blipp = require('blipp');
const Hoek = require('hoek');
const HapiSwagger = require('hapi-swagger');
const Good = require('good');
const Bunyan = require('bunyan');
const BunyanFormat = require('bunyan-format');

// Internals
const internals = {}

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
server.connection({ port: 3000 });

server.register([ Nes, Inert, Blipp, Vision, HapiSwagger, {register: Good, options: internals.goodOptions} ], (err) => {

  Hoek.assert(!err, err);

  server.subscription('/api/chatroom/{id}');

  const chatrooms = {};

  server.route([{
    method: 'POST',
    path: '/api/chatroom/{id*}',
    config: {
      description: 'Chat message handler',
      handler: (request, reply) => {

        const roomId = request.params.id ? request.params.id : 'public';
        const message = { message: request.payload.message };
        chatrooms.roomId ? chatrooms[roomId].messages.push(message) : chatrooms[roomId] = {messages: [message]};
        
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
        const chatHistory = chatrooms[roomId] ? chatrooms[roomId].messages : [{messages: {message: 'You are the first here!'}}];
        return reply(chatHistory);
      },
      tags: ['api']
    }
  },
  {
    method: 'GET',
    path: '/{params*}',
    config: {
      description: 'Static file server',
      handler: { file: './lib/index.html' }
    }
  },
  {
    method: 'GET',
    path: '/static/bundle.js',
    config: {
      description: 'Serve the websocket client library',
      handler: { file: './node_modules/nes/lib/client.js' }
    }
  }]);

  server.start((err) => {

    Hoek.assert(!err, err);
    console.log('Chat service running...');
  });
});

process.on('SIGINT', () => {

  console.log('\nShutting down chat service...');
  process.exit(0);
})
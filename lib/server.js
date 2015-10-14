var Hapi = require('hapi');
var Nes = require('nes');
var Inert = require('inert');
var Blipp = require('blipp');
var Hoek = require('hoek');

var server = new Hapi.Server();
server.connection({ port: 3000 });

server.register([ Nes, Inert, Blipp ], (err) => {

    Hoek.assert(!err, err);

    server.subscription('/chatroom/{id}');

    server.route({
        method: 'POST',
        path: '/chatroom/{id*}',
        config: {
            id: 'chatroom',
            handler: (request, reply) => {

                var roomId = request.params.id ? request.params.id : 'general';
                
                server.log(`new message in: /chatroom/${roomId}`);
                
                server.publish(`/chatroom/${roomId}`, { message: request.payload.message });
                return reply('message recieved');
            },
            description: 'Chat message handler'
        }
    });

    server.route([
        {
            method: 'GET',
            path: '/{params*}',
            config: {
                handler: {
                    file: './index.html'
                },
                description: 'Static file server'
            }
        },
        {
            method: 'GET',
            path: '/static/bundle.js',
            config: {
                handler: {
                    file: '../node_modules/nes/lib/client.js'
                },
                description: 'Serve the websocket client library'
            }
        }
    ]);

    server.start((err) => {

        Hoek.assert(!err, err);
    });
});
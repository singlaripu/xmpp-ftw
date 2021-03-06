var should  = require('should')
  , Chat    = require('../../lib/chat')
  , ltx     = require('ltx')
  , helper  = require('../helper')

describe('Chat', function() {

    var chat
    var socket
    var xmpp

    before(function() {
        socket = new helper.Eventer()
        xmpp = new helper.Eventer()
        var manager = {
            socket: socket,
            client: xmpp
        }
        chat = new Chat()
        chat.init({ socket: socket, client: xmpp })
    })

    describe('Can handle incoming messages', function() {
    
        it('Shouldn\'t handle non-message stanzas', function() {
            chat.handles(ltx.parse('<iq/>')).should.be.false
        })

        it('Shouldn\'t handle messages without a type', function() {
            chat.handles(ltx.parse('<message />')).should.be.false
        })

        it('Should confirm it can handle chat messages', function() {
            var item = ltx.parse('<message type="headline" />')
            chat.handles(item).should.be.false
        })

        it('Should handle chat type messages', function() {
            var item = ltx.parse('<message type="chat" />')
            chat.handles(item).should.be.true
        })

        it('Can handle simple plain text messages', function(done) {
            socket.once('xmpp.chat.message', function(data) {
                data.from.should.eql({
                    user: 'user',
                    domain: 'domain',
                    resource: 'resource'
                })
                data.content.should.equal('message')
                data.format.should.equal(chat.PLAIN)
                done()
            })
            chat.handle(helper.getStanza('chat/plain')).should.be.true
        })

        it('Can handle XHTML type messages', function(done) {
            socket.once('xmpp.chat.message', function(data) {
                data.from.should.eql({
                    user: 'user',
                    domain: 'domain',
                    resource: 'resource'
                })
                data.content.should.equal('<p>Hello to <strong>you!</strong></p>')
                data.format.should.equal(chat.XHTML)
                done()
            })
            chat.handle(helper.getStanza('chat/xhtml')).should.be.true
        })

        it('Can handle <delay> element', function(done) {
            socket.once('xmpp.chat.message', function(data) {
                data.delay.when.should.equal('2002-09-10T23:08:25Z')
                data.delay.reason.should.equal('Offline Storage')
                data.delay.from.should.equal('capulet.com')
                done()
            })
            chat.handle(helper.getStanza('chat/plain-with-delay'))
                .should.be.true
        })
    })

    describe('Can send messages', function() {

        it('Sends error message if \'to\' parameter missing', function(done) {
            socket.once('xmpp.error.client', function(data) {
                data.description.should.equal("Missing 'to' JID")
                data.type.should.equal('modify')
                data.condition.should.equal('client-error')
                data.request.should.eql({})
                done()
            })
            chat.sendMessage({})
        })

        it('Sends error if \'content\' parameter missing', function(done) {
            socket.once('xmpp.error.client', function(data) {
                data.description.should.equal("Message content not provided")
                data.type.should.equal('modify')
                data.condition.should.equal('client-error')
                data.request.to.should.equal('romeo@montague.net/orchard')
                data.request.type.should.equal('chat')
                done()
            })
            chat.sendMessage({ to: 'romeo@montague.net/orchard' })
            
        })

        it('Can send simple plain text messages', function(done) {
            var to = 'user@domain/resource'
            var content = 'message'
            xmpp.once('stanza', function(stanza) {
                stanza.attrs.to.should.equal(to)
                stanza.attrs.type.should.equal('chat')
                stanza.getChild('body').getText().should.equal(content)
                done()
            })
            chat.sendMessage({to: to, content: content})
        })

        it('Returns error if invalid XHTML provided', function(done) {
            var to = 'romeo@montague.net/orchard'
            var content = 'This will <strong>fail'
            socket.once('xmpp.error.client', function(data) {
                data.description.should.equal("Can not parse XHTML message")
                data.type.should.equal('modify')
                data.condition.should.equal('client-error')
                data.request.to.should.equal(to)
                data.request.type.should.equal('chat'),
                data.request.content.should.equal(content)
                done()
            })
            chat.sendMessage({
                to: to, content: content, format: chat.XHTML
            })
        })

        it('Returns expected XHTML message stanza', function(done) {
            var to = 'romeo@montague.net/orchard'
            var content = '<p>This will <strong>pass</strong></p>'
            xmpp.once('stanza', function(stanza) {
                stanza.getChild('body').getText()
                    .should.equal('This will pass')
                stanza.attrs.to.should.equal(to)
                stanza.getChild('html', 'http://jabber.org/protocol/xhtml-im')
                    .should.exist
                stanza.getChild('html')
                    .getChild('body', 'http://www.w3.org/1999/xhtml')
                    .should.exist
                stanza.getChild('html')
                    .getChild('body')
                    .children.join('')
                    .should.equal(content)
                done()
            })
            chat.sendMessage({
                to: to, content: content, format: chat.XHTML
            })
        })

    })
})

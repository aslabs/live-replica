/**
 * Created by barakedry on 06/07/2018.
 */
'use strict';
const eventName = require('../common/events');
const { EventEmitter }  = require('events');
const LiveReplicaServer = require('../server');

class Connection extends EventEmitter {
    constructor() {
        super();

        this.setMaxListeners(50000);

        this.messageFromMaster = ({data}) => {
            if (data.liveReplica) {
                const {event, payload, ack} = data.liveReplica;

                let ackFunction;
                if (ack) {
                    ackFunction = (...args)=> {
                        this.send(ack, ...args);
                    }
                }

                this.emit(event, payload, ackFunction);
            }
        };

        global.addEventListener('message', this.messageFromMaster);
    }


    send(event, ...args) {
        event = eventName(event);
        global.postMessage({
            liveReplica: {
                event,
                args
            }
        });
    }


    emit(event, ...args) {
        event = eventName(event);
        const callArgs = [event].concat(args);
        super.emit.apply(this, callArgs);
    }

    addEventListener(event, handler) {
        super.addEventListener(eventName(event), handler);
    }

    removeListener(event, handler) {
        super.removeListener(eventName(event), handler);
    }

}

/**
 *  LiveReplicaWorkerSocket
 */
class LiveReplicaWorkerServer extends LiveReplicaServer {
    constructor() {
        if (typeof onmessage !== 'function') {
            throw new Error('LiveReplicaWorkerServer can be initiated only inside a web worker')
        }
        super();

        this._masterConnection = new Connection();
        this.onConnect(this._masterConnection)
    }

}

module.exports = LiveReplicaWorkerServer;
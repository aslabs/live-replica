/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
/*@type {PatchDiff}*/
const PatchDiff = require('../patch-diff');
const PatcherProxy = require('../proxy');
const LiveReplicaSocket = require('../socket');
const concatPath = PatchDiff.utils.concatPath;

let replicaId = 1000;

// privates
const deserializeFunctions  = Symbol('deserializeFunctions');
const createRPCfunction     = Symbol('createRPCfunction');
const remoteApply           = Symbol('remoteApply');
const bindToSocket           = Symbol('bindToSocket');

class Replica extends PatchDiff {

    // private
    [bindToSocket]() {

        this.connection.on(`apply:${this.id}`, (delta) => {
            this[remoteApply](delta);
            if (delta && !this._subscribed) {
                this._subscribed = true;
                this.emit('_subscribed', this.get());
            }
        });

        if (this.options.readonly === false) {
            this.subscribe((data, diff, options) => {
                if (options.local) {
                    this.connection.send(`apply:${this.id}`, data);
                }
            });
        }
    }

    [createRPCfunction](path) {
        const self = this;
        return function rpcToRemote(...args) {
            return new Promise((resolve) => {
                self.connection.send(`invokeRPC:${self.id}`, {path, args}, (returnValue) => {
                    resolve(returnValue);
                });
            });
        }
    }

    [deserializeFunctions](data, path) {

        const keys = Object.keys(data);
        for (let i = 0, l = keys.length; i < l; i++) {
            const key = keys[i];
            const value = data[key];

            if (value === 'function()') {
                data[key] = this[createRPCfunction](concatPath(path, key));
            } if (typeof value === 'object' && value !== null) {
                this[deserializeFunctions](value, concatPath(path, key));
            }
        }
        return data;
    }

    [remoteApply](data) {
        super.apply(this[deserializeFunctions](data));
    }

    // public
    /**
     * @param {string}  remotePath
     * @param {Object} [options={}] - An optional param (Closure syntax)
     * @return {Replica}
     */
    constructor(remotePath, options = {dataObject: {}}) {

        options = Object.assign({
            readonly: true,
            subscribeRemoteOnCreate: !!options.connection
        }, options);

        super(options.dataObject || {}, options);
        this.remotePath = remotePath;
        this.id = ++replicaId;
        /*@type WeakMap<Object, Proxy>*/
        this.proxies = new WeakMap();

        if (!this.options.connectionCallback) {
            this.options.connectionCallback = (result) => {
                if (result.success) {
                    console.info(`live-replica subscribed to remote ${this.options.readonly ? 'readonly': ''} path=${this.remotePath}`);
                } else {
                    console.error(`live-replica failed to subscribe remote ${this.options.readonly ? 'readonly': ''} path=${this.remotePath} reason=${result.reason}`);
                }
            };
        }

        if (this.options.subscribeRemoteOnCreate) {
            this.subscribeRemote(this.options.connection)
        }
    }

    subscribeRemote(connection = this.options.connection, connectionCallback = this.options.connectionCallback) {

        if (!(connection && connection instanceof LiveReplicaSocket)) {
            throw Error('undefined connection or not a LiveReplicaSocket');
        }

        this._subscribed = false;
        this.connection = connection;
        this[bindToSocket]();
        this.connection.send('subscribe', {
            id: this.id,
            path: this.remotePath,
            allowRPC: !this.options.readonly || this.options.allowRPC,
            allowWrite: !this.options.readonly
        }, connectionCallback);
    }

    /**
     * Apply a patch on the replica object
     * @param {Object}  patch - data to apply on replica object
     * @param {string=} path - sub path on replica to apply patch on
     * @param {Object}  [options={}]
     */
    apply(patch, path, options = {}) {
        if (this.options.readonly === false) {
            options.local = true;
            super.apply(patch, path, options);
        }
    }

    /**
     * Write a complete object into replica, overwriting any previous data on given path
     * @param {Object}  fullDocument - full representation of the replica object
     * @param {string=} path - sub path on replica to apply on. If not provided, root replica will be overwritten.
     * @param {Object}  [options={}]
     */
    set(fullDocument, path, options = {}) {
        if (this.options.readonly === false) {
            options.local = true;
            super.set(fullDocument, path, options);
        }
    }

    splice(patch, path, options = {}) {
        if (this.options.readonly === false) {
            options.local = true;
            super.apply(patch, path, options);
        }
    }


    unsubscribeRemote() {
        if (!this.connection) { return; }
        this.connection.send(`unsubscribe:${this.id}`);
        delete this.connection;
    }


    destroy() {
        this.unsubscribeRemote();
        this.removeAllListeners();
    }

    /**
     * Promise that resolves when a value added on given replica path
     * @param {string} path - sub path on replica to wait on
     * @returns {Promise<Replica>}
     */
    getWhenExists(path) {
        return new Promise(resolve => {
            this.get(path, resolve);
        });
    }

    /**
     * Getter wrapper to getWhenExists method - resolves when replica root is populated with data
     * @returns {Promise<Replica>}
     */
    get existance() {
        return this.getWhenExists();
    }

    /**
     * @returns {Proxy}
     * */
    get data() {
        if (!this.proxies.has(this)) {
            const proxy = PatcherProxy.create(this, '', null, this.options.readonly);
            this.proxies.set(this, proxy);
        }
        return this.proxies.get(this);
    }

    /**
     * Resolves with data once first message arrives from server origin
     * @returns {Promise<Object>}
     * */
    get subscribed() {
        return new Promise((resolve) => {
            if (this._subscribed) {
                resolve(this.get());
            } else {
                this.once('_subscribed', resolve);
            }

        });
    }
}

// export default Replica;
module.exports = Replica;
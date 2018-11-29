/**
 * LiveReplica
 * @module @live-replica/live-replica
 */
module.exports = {
    Server: require('./packages/server'),
    Proxy: require('./packages/proxy'),
    /*@type {Replica}*/
    Replica: require('./packages/replica'),
    PatchDiff: require('./packages/patch-diff')
};
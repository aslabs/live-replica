export declare interface Replica {
    constructor(remotePath: string, options = {dataObject: {}});
    subscribeRemote(connection?, connectionCallback?);
    apply(patch, path: string, options = {});
    set(fullDocument, path, options = {});
    splice(patch, path, options = {});
    unsubscribeRemote();
    destroy();
    getWhenExists(path: string);
    data: ProxyHandler<any>;
}
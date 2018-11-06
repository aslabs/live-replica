export declare interface PatcherProxy {
    proxies: WeakMap;
    proxyProperties: WeakMap;
    create(patcher, path: string, root, readonly: boolean): ProxyHandler<any>;
    createArrayMethod(proxy: ProxyHandler<any>, array, methodName: string, readonly: boolean);
    getOrCreateArrayMethod(proxy: ProxyHandler<any>, array, name: string, readonly: boolean);
    getRoot (proxy: ProxyHandler<any>);
    getPath(proxy: ProxyHandler<any>, key: string);
}
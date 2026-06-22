import { IRouter as IExpressRouter, Router, NextFunction } from "express";
import pluralize from "pluralize";
import listRoutes from "express-list-routes";

import { isResourceConfig, makeCamelCase, makePlaceholder, normalizePath, toExpressPath } from "./utils";
import { EndpointNames, GroupArgs, IResource, IRouter, RegisterCb, RequestMethods, ResourceType } from "../types";
import RESOURCES from "./resources";

const ROUTE_GROUP_METHODS = new Set(["getPath", "getRouter", "export", "listRoutes", "group", "resource"]);
type RouteGroupPublicKey = "getPath" | "getRouter" | "export" | "listRoutes" | "group" | "resource";

class RouteGroup {
  private head: string;

  private router: IExpressRouter;

  private middlewares: NextFunction[];

  constructor(path: string = "", router: IExpressRouter = Router(), middlewares: NextFunction[] = []) {
    this.head = path;
    this.router = router;
    this.middlewares = middlewares;
  }

  getPath() {
    return this.head;
  }

  public getRouter() {
    return this.router;
  }

  public export() {
    return this.router;
  }

  public listRoutes() {
    return listRoutes(this.router, { logger: false });
  }

  public group(...rawArgs: GroupArgs) {
    const { middlewares, register, prefix = "" } = this.parseGroupArgs(rawArgs);
    const head = normalizePath(this.head, prefix);
    const group = new RouteGroup(head, this.router, [...this.middlewares, ...middlewares]);
    const proxy = this.createProxy(this.router, group);

    register(proxy);

    return this as unknown as IRouter;
  }

  public resource(arg: IResource | ResourceType) {
    let handlers = arg;
    let middlewares = {} as ResourceType["middlewares"];
    let parameters = {} as { [prop: string]: string };
    const base = this.head.split("/");
    let path = base.pop() || "";

    if (isResourceConfig(arg)) {
      handlers = arg.handlers;
      path = arg.path || "";
      middlewares = arg.middlewares || {};
      parameters = arg.parameters || {};
    }

    Object.entries(RESOURCES).forEach(([endpoint, conf]) => {
      if (!Reflect.has(handlers, endpoint)) {
        return;
      }

      const key = endpoint as EndpointNames;
      const { [key]: midds = [] } = middlewares || {};

      // parse the path and generate parameter names
      const names = path
        .split(".")
        .filter(Boolean)
        .reduce((acc: string[], segment: string) => {
          let items = [pluralize.singular(segment), "id"];
          if (parameters[segment]) {
            items = parameters[segment].split(":");
          }
          const placeholder = makePlaceholder(makeCamelCase(...items));
          acc.push(...base, segment, placeholder);
          return acc;
        }, []);

      // if no need placeholder in last segment,
      // remove it.
      if (!conf.suffix) {
        names.pop();
      }

      // get the method from the router
      const fn = Reflect.get(this.router, conf.method);
      if (typeof fn !== "function") {
        throw new Error("Invalid method");
      }

      // get the handler from the resource
      const handler = (handlers as IResource)[endpoint as EndpointNames];
      if (typeof handler !== "function") {
        throw new Error("Handler is not a function");
      }

      const http = fn.bind(this.router);
      http(toExpressPath(names.join("/")), ...this.middlewares, midds, handler.bind(handlers));
    });

    return this;
  }

  private callRouter(arg: Function | RequestMethods) {
    return typeof arg === "function"
      ? (path: string, ...inlineMiddlewares: NextFunction[]) => {
          const http = arg.bind(this.router);
          const route = toExpressPath(normalizePath(this.head, path));
          http(route, ...this.middlewares, ...inlineMiddlewares);
        }
      : this.router[arg];
  }

  private createProxy(router: IExpressRouter, target: RouteGroup) {
    const callRouter = this.callRouter.bind(target);
    const handler: ProxyHandler<IRouter> = {
      get: (_target, prop) => {
        if (typeof prop === "string" && ROUTE_GROUP_METHODS.has(prop)) {
          return Reflect.get(target, prop as RouteGroupPublicKey);
        }
        if (typeof prop === "string") {
          return callRouter(router[prop as RequestMethods]);
        }
        return undefined;
      },
    };
    return new Proxy(this as unknown as IRouter, handler);
  }

  private parseGroupArgs(args: unknown[]) {
    switch (typeof args[0]) {
      case "string": {
        const register = args.pop();
        return {
          prefix: args[0],
          register: register as RegisterCb,
          middlewares: args.slice(1) as NextFunction[],
        };
      }
      case "function": {
        const register = args.pop();
        return {
          register: register as RegisterCb,
          middlewares: args as NextFunction[],
        };
      }
      default:
        throw new Error("invalid group parameters");
    }
  }
}

export type { EndpointNames, GroupArgs, IResource, IRouter, RegisterCb, RequestMethods, ResourceType } from "../types";
export default RouteGroup;

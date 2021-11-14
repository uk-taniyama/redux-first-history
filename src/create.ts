import type { History, Location, LocationState } from 'history';
import type { History as ReachHistory } from '@reach/router';
import type { Middleware, Reducer, Store } from 'redux';
import {
   go,
   goBack,
   goForward,
   back,
   forward,
   push,
   replace,
   locationChangeAction,
} from './actions';
import { createRouterMiddleware } from './middleware';
import { createRouterReducer, RouterState } from './reducer';

export interface IHistoryContextOptions<S = LocationState> {
   history: History<S>;
   routerReducerKey?: string;
   oldLocationChangePayload?: boolean;
   reduxTravelling?: boolean;
   showHistoryAction?: boolean;
   selectRouterState?: <T>(state: T) => RouterState<T>;
   savePreviousLocations?: number;
   batch?: (callback: () => void) => void;
   reachGlobalHistory?: ReachHistory;
}

export interface IHistoryContext<S = LocationState> {
   createReduxHistory: (store: Store) => History & { listenObject: boolean };
   routerMiddleware: Middleware;
   routerReducer: Reducer<RouterState<S>>;
}

export const createReduxHistoryContext = <S = LocationState>({
   history,
   routerReducerKey = 'router',
   reduxTravelling = false,
   showHistoryAction = false,
   selectRouterState,
   savePreviousLocations = 0,
   batch,
   reachGlobalHistory,
}: IHistoryContextOptions<S>): IHistoryContext<S> => {
   let listenObject = false;

   // @ts-ignore
   const callListener = (listener, location, action) =>
      listenObject ? listener({ location, action }) : listener(location, action);

   if (typeof batch !== 'function') {
      batch = fn => {
         fn();
      };
   }

   /** ********************************************  REDUX REDUCER ***************************************************** */

   if (typeof selectRouterState !== 'function') {
      selectRouterState = state => state[routerReducerKey];
   }

   const routerReducer = createRouterReducer<S>({ savePreviousLocations });
   const routerMiddleware = createRouterMiddleware({ history, showHistoryAction });

   /** ******************************************  REDUX TRAVELLING  ************************************************** */

   let isReduxTravelling = false;

   const handleReduxTravelling = (store: Store) => {
      const locationEqual = (loc1: Location, loc2: Location) =>
         loc1.pathname === loc2.pathname && loc1.search === loc2.search && loc1.hash === loc2.hash;

      return store.subscribe(() => {
         // @ts-ignore
         const sLoc = selectRouterState(store.getState()).location;
         const hLoc = history.location;
         if (sLoc && hLoc && !locationEqual(sLoc, hLoc)) {
            isReduxTravelling = true;
            history.push({ pathname: sLoc.pathname, search: sLoc.search, hash: sLoc.hash });
         }
      });
   };

   /** ******************************************  REDUX FIRST HISTORY   *********************************************** */

   const createReduxHistory = (store: Store): History & { listenObject: boolean } => {
      let registeredCallback: unknown[] = [];

      // init location store
      store.dispatch(locationChangeAction(history.location, history.action));

      if (reduxTravelling) {
         handleReduxTravelling(store);
      }
      // listen to history API
      // @ts-ignore
      history.listen((location, action) => {
         // support history v5
         // @ts-ignore
         if (location.location) {
            // @ts-ignore
            action = location.action;
            // @ts-ignore
            location = location.location;
            listenObject = true;
         }

         if (isReduxTravelling) {
            isReduxTravelling = false;
            // notify registered callback travelling
            // @ts-ignore
            const routerState = selectRouterState(store.getState());
            registeredCallback.forEach(c =>
               callListener(c, routerState.location, routerState.action),
            );
            return;
         }
         // @ts-ignore
         batch(() => {
            store.dispatch(locationChangeAction(location, action));
            // @ts-ignore
            const routerState = selectRouterState(store.getState());
            registeredCallback.forEach(c =>
               callListener(c, routerState.location, routerState.action),
            );
         });
      });

      // listen to reach globalHistory (support "navigate")
      if (reachGlobalHistory) {
         reachGlobalHistory.listen(({ location, action }) => {
            if (action !== `POP`) {
               const loc = {
                  pathname: location.pathname,
                  search: location.search,
                  hash: location.hash,
                  key: location.key,
                  state: location.state,
               };
               // @ts-ignore
               batch(() => {
                  // @ts-ignore
                  store.dispatch(locationChangeAction(loc, action));
                  // @ts-ignore
                  const routerState = selectRouterState(store.getState());
                  registeredCallback.forEach(c =>
                     callListener(c, routerState.location, routerState.action),
                  );
               });
            }
         });
      }

      // @ts-ignore
      return {
         block: history.block,
         createHref: history.createHref,
         push: (...args: Parameters<History['push']>) => store.dispatch(push(...args)),
         replace: (...args: Parameters<History['replace']>) => store.dispatch(replace(...args)),
         go: (...args: Parameters<History['go']>) => store.dispatch(go(...args)),
         // @ts-ignore
         goBack: (...args: Parameters<History['goBack']>) => store.dispatch(goBack(...args)),
         // @ts-ignore
         goForward: (...args: Parameters<History['goForward']>) =>
            store.dispatch(goForward(...args)),
         // @ts-ignore
         back: (...args: Parameters<History['back']>) => store.dispatch(back(...args)),
         // @ts-ignore
         forward: (...args: Parameters<History['forward']>) => store.dispatch(forward(...args)),
         listen: callback => {
            if (registeredCallback.indexOf(callback) < 0) {
               registeredCallback.push(callback);
            }
            return () => {
               registeredCallback = registeredCallback.filter(c => c !== callback);
            };
         },
         // @ts-ignore
         get location() {
            // @ts-ignore
            return selectRouterState(store.getState()).location;
         },
         // @ts-ignore
         get action() {
            // @ts-ignore
            return selectRouterState(store.getState()).action;
         },
         get length() {
            // @ts-ignore
            return history.length;
         },
         // @ts-ignore
         get listenObject() {
            return listenObject;
         },
      };
   };

   return { routerReducer, routerMiddleware, createReduxHistory };
};

import { Action, Location, LocationState } from 'history';
import { AnyAction, Reducer } from 'redux';
import { LOCATION_CHANGE } from './actions';

export type RouterState<S = LocationState> = {
   location?: Location<S> | null;
   action?: Action | null;
   previousLocations?: { location?: Location<S> | null; action?: Action | null }[];
};

export const createRouterReducer = <S = LocationState>({
   savePreviousLocations = 0,
}): Reducer<RouterState<S>> => {
   const initialState: RouterState<S> = {
      location: null,
      action: null,
   };

   // eslint-disable-next-line no-restricted-globals
   const numLocationToTrack = isNaN(savePreviousLocations) ? 0 : savePreviousLocations;
   if (numLocationToTrack) initialState.previousLocations = [];

   return (state = initialState, { type, payload } = {} as AnyAction) => {
      if (type === LOCATION_CHANGE) {
         const { location, action } = payload || {};
         const previousLocations = numLocationToTrack // @ts-ignore
            ? [{ location, action }, ...state.previousLocations.slice(0, numLocationToTrack)]
            : undefined;
         return { ...state, location, action, previousLocations };
      }
      return state;
   };
};

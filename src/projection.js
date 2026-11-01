// A single 2:1 axonometric camera for map geometry and 3D map previews.
export const TILE_WIDTH=64;
export const TILE_HEIGHT=32;
export const MAP_CAMERA_DIRECTION=Object.freeze([1,Math.sqrt(2/3),1]);
export function projectMap(x,z,height=0){return {x:(x-z)*TILE_WIDTH/2,y:(x+z)*TILE_HEIGHT/2-height};}

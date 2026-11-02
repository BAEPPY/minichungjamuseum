// Map-only derivatives keep moving through the museum independent of the
// large, unchanged models opened for detailed observation.
export const MAP_MODEL_PATHS=Object.freeze(Object.fromEntries([
 'celadon-incense.glb','celadon-ewer.glb','celadon-maebyeong-v2.glb',
 'japan-peony-reconstruction.glb','celadon-stool-wrl.glb',
 'yuan-celadon-vase.glb','celadon-pillow-reconstruction.glb'
].map(name=>[`/models/${name}`,`/models/map/${name}`])));

export function mapModelPath(artifact){
 return MAP_MODEL_PATHS[artifact.model]||(artifact.model?.startsWith('blob:')?artifact.model:null);
}

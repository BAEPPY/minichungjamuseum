// World coordinates shared by the walkable map, navigation and saved-position migration.
export const comparisonPositions=[[-5,-2],[0,-2],[5,-2]];
export const collectionPositions=[[-5,-13],[5,-13],[0,-18],[-5,-23],[5,-23]];
export const MAP_LAYOUT=Object.freeze({
 version:'linear-course-exhibition-v1',
 study:{x0:-10,z0:-32,x1:10,z1:6},
 arrival:{x0:-11,z0:5.2,x1:9,z1:25},
 bridge:{x0:7,z0:19,x1:19,z1:24},
 exhibition:{x0:16,z0:-36,x1:54,z1:24},
 spawns:{arrival:{x:0,z:11,inside:false},study:{x:0,z:4,inside:true},exhibition:{x:25,z:19,inside:false}},
 destinations:{entrance:[0,7],exit:[6,-29],'comparison-desk':[-7,-7],desk:[0,-29],publish:[25,20]},
 reportColumns:5,reportRows:6,reportSpacing:{x:6,z:8},
});
export function reportPosition(index){return [23+(index%MAP_LAYOUT.reportColumns)*6,13-Math.floor(index/MAP_LAYOUT.reportColumns)*8];}
export function exhibitionBounds(reportCount=30){const rows=Math.max(MAP_LAYOUT.reportRows,Math.ceil(reportCount/MAP_LAYOUT.reportColumns));return {...MAP_LAYOUT.exhibition,z0:12-rows*8};}
export function revisitPosition(index){return [18.8,12-index*6];}
export function mapDestination(id,artifactIds=[]){
 if(id.startsWith('revisit-')){const index=artifactIds.indexOf(id.slice(8));return index<0?null:{position:revisitPosition(index),inside:false};}
 if(id in MAP_LAYOUT.destinations)return {position:MAP_LAYOUT.destinations[id],inside:!['entrance','publish'].includes(id)};
 const comparisonIndex=['compare-peony','compare-yuan','compare-inlay'].indexOf(id);
 if(comparisonIndex>=0)return {position:comparisonPositions[comparisonIndex],inside:true};
 const collectionIndex=['pillow','stool','incense','maebyeong','ewer'].indexOf(id);
 return collectionIndex<0?null:{position:collectionPositions[collectionIndex],inside:true};
}

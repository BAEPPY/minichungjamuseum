import {artifacts} from './artifacts.js';
import {comparisonIds} from './comparison-artifacts.js';
import {courseSourceCredits} from './course-sources.js';
export const COURSE_VERSION='three-vases-five-celadons-v1';
export function courseRecord(notes,comparison){return {comparison:{observations:Object.fromEntries(comparisonIds.map(id=>[id,String(notes[id]?.features||'').trim()])),excellence:String(comparison.excellence||'').trim(),evidence:String(comparison.evidence||'').trim()},features:Object.fromEntries(artifacts.map(a=>[a.id,String(notes[a.id]?.features||'').trim()])),sourceCredits:courseSourceCredits()};}
export function comparisonComplete(progress,notes,comparison){const visited=new Set(progress.comparisonVisited||[]);return comparisonIds.every(id=>visited.has(id)&&String(notes[id]?.features||'').trim())&&Boolean(String(comparison.excellence||'').trim()&&String(comparison.evidence||'').trim());}
export function galleryComplete(progress,notes){const visited=new Set(progress.visited||[]);return artifacts.every(a=>visited.has(a.id)&&String(notes[a.id]?.features||'').trim());}

import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonComplete,galleryComplete,courseRecord} from '../src/course.js';
const compareIds=['compare-peony','compare-yuan','compare-inlay'];
const galleryIds=['pillow','stool','incense','maebyeong','ewer'];
const notes=()=>Object.fromEntries([...compareIds,...galleryIds].map(id=>[id,{features:` ${id}에서 관찰한 특징 `,photos:[]}]))
const comparison={excellence:' 문양을 섬세하게 표현했다 ',evidence:' 검고 흰 학과 구름 무늬가 보인다 '};
test('comparison gate requires every real observation and written claim plus evidence',()=>{
 const records=notes(),state={comparisonVisited:[...compareIds]};
 assert.equal(comparisonComplete(state,records,comparison),true);
 assert.equal(comparisonComplete({comparisonVisited:compareIds.slice(1)},records,comparison),false);
 assert.equal(comparisonComplete(state,records,{...comparison,evidence:' '}),false);
 records['compare-peony'].features='';
 assert.equal(comparisonComplete(state,records,comparison),false);
});
test('five-work exploration requires independent visits and a feature for every work',()=>{
 const records=notes(),state={visited:[...galleryIds]};
 assert.equal(galleryComplete(state,records),true);
 assert.equal(galleryComplete({visited:[...compareIds,...galleryIds.slice(1)]},records),false);
 records.stool.features=' ';
 assert.equal(galleryComplete(state,records),false);
});
test('one course report preserves both activities and derives current trimmed observations',()=>{
 const records=notes(),course=courseRecord(records,comparison);
 assert.deepEqual(Object.keys(course.comparison.observations),compareIds);
 assert.deepEqual(Object.keys(course.features),galleryIds);
 assert.equal(course.comparison.excellence,comparison.excellence.trim());
 assert.equal(course.features.stool,records.stool.features.trim());
 records['compare-yuan'].features='수정한 관찰';
 assert.equal(courseRecord(records,comparison).comparison.observations['compare-yuan'],'수정한 관찰');
 assert.notEqual(course.comparison.observations['compare-yuan'],'수정한 관찰');
});

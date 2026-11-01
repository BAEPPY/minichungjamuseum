import test from 'node:test';
import assert from 'node:assert/strict';
import {courseRecord} from '../src/course.js';
import {courseSourceCredits,enrichReportSourceCredits,reportsForExport} from '../src/course-sources.js';
const sourceUrl='https://sketchfab.com/3d-models/vase-yuan-dynasty-1271-1368-a50b38792b264f18af523dc935dae606';
const licenseUrl='https://creativecommons.org/licenses/by-nc-sa/4.0/';
function report(){return {id:'class-report',type:'report',createdAt:'2026-11-01T00:00:00.000Z',photos:['data:image/jpeg;base64,/9j/2Q=='],course:courseRecord({'compare-yuan':{features:'고리가 달린 동물 손잡이'}},{excellence:'상감 무늬가 섬세하다',evidence:'검고 흰 학과 구름을 보았다'})};}
function assertCredit(credit){
 assert.equal(credit.collection,'Art Gallery of Hamilton (AGH)');
 assert.equal(credit.accession,'1976.19.M');
 assert.match(credit.digitization,/Serena Zena Mak Walk, 2023/);
 assert.match(credit.digitization,/Sari-Sari Xchange/);
 assert.equal(credit.sourceUrl,sourceUrl);
 assert.equal(credit.license,'CC BY-NC-SA 4.0');
 assert.equal(credit.licenseUrl,licenseUrl);
 assert.match(credit.modifications,/8K.*4K JPEG/);
}
test('new client course records carry complete credits through detached JSON',()=>{
 const detached=JSON.parse(JSON.stringify(report()));
 assert.equal(detached.course.sourceCredits.length,1);
 assertCredit(detached.course.sourceCredits[0]);
});
test('actual export preparation enriches old course records and leaves no-course legacy reports unchanged',()=>{
 const old=report();delete old.course.sourceCredits;
 const legacy={id:'old-report',type:'report',title:'예전 관찰',features:'기존 기록',photos:['data:image/jpeg;base64,/9j/2Q==']};
 const before=JSON.stringify(old),legacyBefore=JSON.stringify(legacy);
 const exported=JSON.parse(JSON.stringify(reportsForExport([old,legacy,{id:'private-model',type:'native-model',blob:'not-a-report'}])));
 assert.equal(exported.length,2);assertCredit(exported[0].course.sourceCredits[0]);
 assert.equal(exported[0].id,old.id);assert.equal(exported[0].createdAt,old.createdAt);
 assert.deepEqual(exported[0].course.comparison,old.course.comparison);
 assert.equal(JSON.stringify(old),before,'export enrichment must not rewrite existing records');
 assert.equal(JSON.stringify(legacy),legacyBefore);assert.deepEqual(exported[1],legacy);
});
test('canonical enrichment replaces arbitrary credit links and does not share mutable credit objects',()=>{
 const tainted=report();tainted.course.sourceCredits=[{sourceUrl:'https://untrusted.example/phish',licenseUrl:'javascript:alert(1)'}];
 const enriched=enrichReportSourceCredits(tainted);assertCredit(enriched.course.sourceCredits[0]);
 assert.doesNotMatch(JSON.stringify(enriched),/untrusted|javascript:/);
 enriched.course.sourceCredits[0].sourceUrl='https://changed.example/';
 assertCredit(courseSourceCredits()[0]);
 assert.equal(enrichReportSourceCredits(null),null);
});

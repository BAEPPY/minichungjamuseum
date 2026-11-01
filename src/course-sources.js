// Canonical credits travel with a course report, including detached JSON and
// shared records. No student-supplied URL is used for these source links.
const yuanCredit=Object.freeze({
 id:'agh-yuan-vase',
 title:'기본 비교 자료: 원나라 시대 청자 병 · Vase (Yuan Dynasty, 1271–1368)',
 artist:'Unidentified, Chinese',
 collection:'Art Gallery of Hamilton (AGH)',
 accession:'1976.19.M',
 gift:'Gift of Herman H. Levy, 1976',
 digitization:'Serena Zena Mak Walk, 2023 · Sari-Sari Xchange: Building Asian Diasporic Community Through Emergent Media',
 sourceUrl:'https://sketchfab.com/3d-models/vase-yuan-dynasty-1271-1368-a50b38792b264f18af523dc935dae606',
 license:'CC BY-NC-SA 4.0',
 licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/',
 modifications:'웹용으로 원본 8K 사진 질감을 4K JPEG(품질 90, 4:4:4)로 축소했습니다. 형상·UV·원본 KHR_materials_unlit 재질은 변경하지 않았습니다.'
});
export function courseSourceCredits(){return [{...yuanCredit}];}
export function enrichReportSourceCredits(report){
 const course=report?.course;
 if(!course||typeof course!=='object'||Array.isArray(course))return report;
 return {...report,course:{...course,sourceCredits:courseSourceCredits()}};
}
export function reportsForExport(records){return records.filter(report=>report?.type==='report').map(enrichReportSourceCredits);}

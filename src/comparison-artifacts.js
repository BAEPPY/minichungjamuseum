import {artifacts} from './artifacts.js';

// Comparison exhibits have their own observation IDs. Seeing the inlay vase
// here does not silently finish its later five-work gallery activity.
export const comparisonArtifacts=[
 {id:'compare-peony',comparison:true,name:'청자 음인각 모란무늬 매병',shortName:'일본 · 모란무늬 매병',kind:'일본 · 세토',era:'가마쿠라 시대',shape:'vase',color:0x84957e,referenceTint:false,photoView:'/models/japan-peony/manifest.json',photoPoster:'/models/japan-peony/2_4.jpg',mapPreview:'/art/previews/japan-peony-cutout.png',referenceUrl:'https://www.museum.go.kr/MUSEUM/contents/M0502000000.do?relicId=1646&schM=view&searchId=search',sourceViewerUrl:'https://www.museum.go.kr/relic3D/3D_V2/PS01001001007/011590/viewer.html',sourceDescription:'국립중앙박물관 소장 · 신안11590 · 일본 세토 회유도기 · 공식 뷰어 원본 다각도 사진 54장 (3D 메시 아님)',captureDescription:'다각도 원본 사진 · 일본 세토 · 청자 음인각 모란무늬 매병 / 국립중앙박물관',use:'작은 입과 넓은 어깨를 가진 매병이에요.',clue:'모란무늬가 표면에 어떻게 새겨져 있는지, 입과 어깨의 모양을 살펴보세요.',info:'국립중앙박물관의 이 자료는 고려청자가 아니라 일본 세토에서 만든 가마쿠라 시대의 회유도기예요. 높이는 26.2cm이며, 모란무늬를 새긴 방법과 그릇의 모양을 다른 두 작품과 비교해 보세요.'},
 {id:'compare-yuan',comparison:true,name:'원나라 시대 청자 병',shortName:'중국 · 원나라 청자 병',kind:'중국 · 용천요',era:'원나라, 1271–1368',shape:'vase',color:0x839b7e,model:'/models/yuan-celadon-vase.glb',referenceTint:false,referenceUrl:'https://sketchfab.com/3d-models/vase-yuan-dynasty-1271-1368-a50b38792b264f18af523dc935dae606',licenseUrl:'https://creativecommons.org/licenses/by-nc-sa/4.0/',licenseLabel:'CC BY-NC-SA 4.0',sourceDescription:'사진 질감 3D · Art Gallery of Hamilton · 1976.19.M / Serena Zena Mak Walk·Sari-Sari Xchange, 2023 / CC BY-NC-SA 4.0',captureDescription:'AGH · 원나라 청자 병 · CC BY-NC-SA 4.0',use:'액체 등을 담는 병이에요.',clue:'세로로 도드라진 몸통과 동물 모양 손잡이, 고리를 찾아보세요.',info:'작가 미상의 중국 원나라 시대 작품으로, 용천요의 청자 유약을 입힌 석기예요. 세로로 도드라진 몸통과 고리가 달린 상상 속 동물 모양 손잡이는 금속 그릇에서 영향을 받은 형태예요. Herman H. Levy가 1976년에 기증했어요.'},
 {...artifacts.find(a=>a.id==='maebyeong'),id:'compare-inlay',comparison:true,shortName:'고려 · 상감 운학문 매병',kind:'한국',clue:'학과 구름의 검고 흰 무늬, 작은 입과 넓은 어깨를 다른 두 작품과 비교해 보세요.'}
];
export const comparisonPositions=[[-7,-.5],[-4,-5],[-8,-8.5]];
export const comparisonIds=comparisonArtifacts.map(a=>a.id);
export const allObservationArtifacts=[...comparisonArtifacts,...artifacts];

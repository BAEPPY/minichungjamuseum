export const artifacts = [
 {id:'maebyeong',name:'청자 매병',kind:'병',tag:'곡선의 아름다움',era:'고려',color:0x78b5a0,shape:'vase',model:'/models/celadon-maebyeong-v2.glb',referenceTint:false,sourceDescription:'사진 참고 재현 모델 · 제공 GLB의 재질·질감 유지',captureDescription:'사진 참고 재현 모델 · 제공 GLB 원본 질감',position:[-4,-2.6],use:'꽃을 꽂거나 액체를 담는 데 사용한 것으로 알려져 있어요.',clue:'어깨와 허리의 굵기, 입구의 크기를 살펴보세요.',info:'작은 입과 풍만한 어깨, 아래로 갈수록 좁아지는 곡선이 특징이에요.'},
 {id:'ewer',name:'청자 주전자',kind:'주전자',tag:'생활 속의 청자',era:'고려',color:0x87bbaa,shape:'ewer',position:[0,-2.6],use:'물이나 술 같은 액체를 담아 따르는 데 썼어요.',clue:'주둥이와 손잡이가 어느 쪽에 있는지 관찰해 보세요.',info:'몸통과 주둥이, 손잡이를 따로 만들고 연결하는 기술이 필요했어요.'},
 {id:'incense',name:'청자 투각 칠보무늬 향로',kind:'향로',tag:'향을 피우는 그릇',era:'고려',color:0x669c8c,shape:'incense',model:'/models/celadon-incense.glb',referenceTint:true,sourceDescription:'실제 스캔 형상 · 청자색은 참고 표현 / 국립중앙박물관 소장, 사용자 제공 PLY',captureDescription:'실제 스캔 형상',position:[4,-2.6],use:'향을 피우는 데 사용했어요.',clue:'뚜껑에 뚫린 무늬와 향로를 받치는 부분을 자세히 관찰해 보세요.',info:'사용자가 제공한 PLY 스캔의 두 부분과 형상 정보를 합친 모델입니다. PLY 원본 색상은 거의 흰색이며 청자색은 참고 표현입니다. 투각은 무늬를 뚫어 표현하는 방법이에요. 향을 피우는 기능과 장식의 아름다움을 함께 살펴보세요.'},
 {id:'pillow',name:'청자 베개',kind:'베개',tag:'뜻밖의 쓰임',era:'고려',color:0x76a999,shape:'pillow',photoView:'/models/celadon-pillow/manifest.json',photoPoster:'/models/celadon-pillow/C05.jpg',sourceDescription:'다각도 사진 자료 · 제공 SWF에서 추출한 54장의 사진',captureDescription:'다각도 사진 관찰 · 사용자 제공 SWF 원본 이미지',position:[-2,1.5],use:'누울 때 머리를 받치는 베개로 사용했어요.',clue:'머리가 닿을 윗면이 어떻게 생겼는지 관찰해 보세요.',info:'고려 사람들은 그릇뿐 아니라 베개 같은 생활용품도 청자로 만들었어요.'},
 {id:'stool',name:'청자 의자',kind:'의자',tag:'다양한 생활 도구',era:'고려',color:0x639b86,shape:'stool',position:[2,1.5],use:'앉는 데 사용하는 의자예요.',clue:'위아래의 넓이와 몸통의 모양을 비교해 보세요.',info:'커다란 기물을 빚고 굽는 데에도 높은 기술이 필요했음을 생각해 볼 수 있어요.'}
];
export const fields = [
 ['use','어디에 쓰였을까?','쓰임','모양을 보고 짐작한 쓰임과 설명을 비교해 보세요.'],
 ['features','무엇이 보이나요?','관찰한 사실','색, 모양, 무늬 중 직접 눈으로 확인한 것을 써 보세요.'],
 ['excellence','어떤 점이 뛰어날까?','근거와 생각','나는 ___이 뛰어나다고 생각한다. 왜냐하면 ___이 보이기 때문이다.'],
 ['life','고려 사람들은 어떻게 살았을까?','생활 추론','이 청자가 ___에 쓰인 것으로 보아, 고려 사람들은 ___했을 것 같다.']
];

export function modelSource(artifact,referenceEnabled=true){
 if(artifact.photoView)return artifact.sourceDescription||'사용자 제공 다각도 사진 자료';
 if(!artifact.model)return '체험용 예시 모델 · 실제 유물의 복제품이 아니에요.';
 if(artifact.referenceTint&&!referenceEnabled)return '실제 PLY 스캔의 원본 색상 · 대부분 흰색으로 기록되어 있어요.';
 return artifact.sourceDescription||'사용자 제공 3D 모델 · 원본 재질 유지';
}
export function captureSource(artifact,referenceEnabled=true){
 if(artifact.photoView)return artifact.captureDescription||'사용자 제공 다각도 사진 자료';
 if(!artifact.model)return '체험용 예시 모델 · 실제 유물 복제품 아님';
 if(artifact.referenceTint)return referenceEnabled?'실제 스캔 형상 · 청자색 참고 표현 (원본 색상 아님)':'실제 스캔 형상 · PLY 원본 색상';
 return artifact.captureDescription||'사용자 제공 3D 모델 · 원본 재질 유지';
}

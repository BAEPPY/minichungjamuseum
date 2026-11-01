export function createPendingModelView(el,artifact){
 const root=document.createElement('div');root.className='pending-model-view';
 root.style.cssText='height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;color:#48624a;background:#e8eddf';
 const icon=document.createElement('span');icon.textContent='◇';icon.style.cssText='font-size:72px;color:#849e85';
 const title=document.createElement('strong');title.textContent='원본 3D 자료를 준비하고 있어요';
 const text=document.createElement('p');text.textContent='선생님이 설정에서 이 작품의 GLB 파일을 등록하면 여기서 직접 돌려 보고 촬영할 수 있어요.';text.style.cssText='max-width:320px;font-size:13px;line-height:1.8';
 root.append(icon,title,text);el.replaceChildren(root);
 return {ready:Promise.resolve(),pending:true,supportsCapture:false,zoom(){},reset(){},setReferenceColor(){},capture(){throw Error('원본 3D 자료를 먼저 등록해 주세요.');},dispose(){root.remove();}};
}

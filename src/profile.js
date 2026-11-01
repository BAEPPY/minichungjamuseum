import './profile.css';

const OUTFITS = [
  {value:'#e8cf91',name:'크림'},
  {value:'#7f9f82',name:'세이지'},
  {value:'#a79cc3',name:'라벤더'}
];
const HAIRSTYLES = [
  {value:'short',name:'짧은 머리'},
  {value:'bob',name:'단정한 단발'}
];
const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('ko', {granularity:'grapheme'}) : null;
const countCharacters = value => segmenter ? [...segmenter.segment(value)].length : Array.from(value).length;
const normalizeNickname = value => value.normalize('NFC').trim();
let pendingProfile = null;

/**
 * Ask for a local explorer profile. Persistence belongs to the caller.
 * A required first visit cannot be dismissed; an optional edit resolves null on cancel.
 */
export function requestProfile({initial={},allowCancel=false}={}) {
  if(pendingProfile) return pendingProfile;
  pendingProfile = new Promise(resolve => {
    let settled = false, touched = false;
    let selectedColor = OUTFITS.some(item=>item.value===initial.avatarColor) ? initial.avatarColor : OUTFITS[0].value;
    let selectedHair = HAIRSTYLES.some(item=>item.value===initial.avatarHair) ? initial.avatarHair : HAIRSTYLES[0].value;
    const previewImages = new Map();
    const dialog = document.createElement('dialog');
    dialog.id = 'profileDialog';
    dialog.className = 'profile-dialog';
    dialog.setAttribute('aria-labelledby','profileTitle');
    dialog.setAttribute('aria-describedby','profileIntroduction');
    dialog.innerHTML = `
      <form id="profileForm" novalidate>
        <div class="profile-header">
          <span class="profile-mark" aria-hidden="true">靑</span>
          <span>우리들의 청자박물관</span>
          ${allowCancel?'<button id="profileCancel" class="profile-close" type="button" aria-label="프로필 변경 취소">×</button>':''}
        </div>
        <div class="profile-body">
          <div class="profile-welcome">
            <span class="profile-eyebrow">${allowCancel?'MY EXPLORER':'WELCOME, EXPLORER'}</span>
            <h1 id="profileTitle">${allowCancel?'나의 탐험가':'어떤 이름으로<br>탐험할까요?'}</h1>
            <p id="profileIntroduction">이름을 정하고, 청자의 이야기를 만나러 가요.</p>
          </div>
          <div class="profile-editor">
            <div class="profile-character-panel" aria-label="선택한 탐험가 모습">
              <div class="profile-character-shadow" aria-hidden="true"></div>
              <div id="profileAvatarPreview" class="profile-character" data-hair="short" aria-hidden="true">
                <canvas class="profile-sprite" width="208" height="264"></canvas>
                <span class="profile-fallback-character"><i class="profile-hair"></i><i class="profile-face"></i><i class="profile-shirt"></i><i class="profile-legs"></i></span>
              </div>
              <strong id="profilePreviewName">나의 탐험가</strong>
              <span class="profile-color-caption"><i id="profileOutfitSwatch"></i><span id="profileOutfitName">크림 탐험복</span></span>
            </div>
            <div class="profile-fields">
              <label class="profile-name-label" for="profileNickname"><span>닉네임</span><small id="profileNicknameCount">0/12</small></label>
              <input id="profileNickname" name="nickname" type="text" autocomplete="nickname" spellcheck="false" placeholder="2~12자로 입력해 주세요" aria-describedby="profileNicknameHelp profileNicknameError" autofocus>
              <p id="profileNicknameHelp" class="profile-input-help">친구들에게 보여 줄 별명을 써 주세요.</p>
              <p id="profileNicknameError" class="profile-input-error" role="status" aria-live="polite" hidden></p>
              <fieldset class="profile-choice-field"><legend>탐험복 색</legend><div class="profile-outfit-options" role="radiogroup" aria-label="탐험복 색 선택">
                ${OUTFITS.map(item=>`<button type="button" class="profile-outfit-option" data-profile-color="${item.value}" role="radio" aria-label="${item.name} 탐험복" aria-checked="false"><i style="background:${item.value}"></i><span>${item.name}</span><b aria-hidden="true">✓</b></button>`).join('')}
              </div></fieldset>
              <fieldset class="profile-choice-field"><legend>머리 모양</legend><div class="profile-hair-options" role="radiogroup" aria-label="머리 모양 선택">
                ${HAIRSTYLES.map(item=>`<button type="button" data-profile-hair="${item.value}" role="radio" aria-checked="false">${item.name}<span aria-hidden="true">✓</span></button>`).join('')}
              </div></fieldset>
            </div>
          </div>
          <button id="profileEnter" class="profile-enter" type="submit" disabled>${allowCancel?'이 모습으로 돌아가기':'입장하기'} <span aria-hidden="true">→</span></button>
        </div>
      </form>`;
    document.body.append(dialog);
    const find = selector => dialog.querySelector(selector);
    const all = selector => [...dialog.querySelectorAll(selector)];
    const input = find('#profileNickname');
    input.value = initial.avatarName && initial.avatarName!=='나의 탐험가' ? initial.avatarName : '';

    const drawPreview = item => {
      const canvas = find('.profile-sprite');
      const ctx = canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx) return false;
      if(!item.bounds){
        // The atlas cell contains transparent padding. Trim only that padding at
        // draw time, leaving the generated source image unchanged.
        const cellWidth = Math.floor(item.image.naturalWidth/4);
        const cellHeight = Math.floor(item.image.naturalHeight/3);
        const cell = document.createElement('canvas');
        cell.width=cellWidth;cell.height=cellHeight;
        const cellContext=cell.getContext('2d',{willReadFrequently:true});
        if(!cellContext) return false;
        cellContext.drawImage(item.image,0,0,cellWidth,cellHeight,0,0,cellWidth,cellHeight);
        const pixels=cellContext.getImageData(0,0,cellWidth,cellHeight).data;
        let left=cellWidth,top=cellHeight,right=-1,bottom=-1;
        for(let y=0;y<cellHeight;y++)for(let x=0;x<cellWidth;x++)if(pixels[(y*cellWidth+x)*4+3]>10){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
        if(right<left||bottom<top) return false;
        item.bounds={left,top,width:right-left+1,height:bottom-top+1};
      }
      const b=item.bounds;
      item.frames??=new Map();
      if(!item.frames.has(selectedColor)){
        const frame=document.createElement('canvas');
        frame.width=b.width;frame.height=b.height;
        const frameContext=frame.getContext('2d',{willReadFrequently:true});
        if(!frameContext) return false;
        frameContext.drawImage(item.image,b.left,b.top,b.width,b.height,0,0,b.width,b.height);
        if(selectedColor!==OUTFITS[0].value){
          const data=frameContext.getImageData(0,0,b.width,b.height);
          const rgb=selectedColor.slice(1).match(/.{2}/g).map(value=>parseInt(value,16));
          // Match the in-world coat mask. Keep authored face, hair, outlines and
          // trousers; replace only warm torso colors while retaining shading.
          for(let y=Math.floor(b.height*.5);y<b.height*.79;y++)for(let x=0;x<b.width;x++){
            const i=(y*b.width+x)*4,R=data.data[i],G=data.data[i+1],B=data.data[i+2];
            if(data.data[i+3]>10&&R>110&&G>85&&R>B*1.22&&G>B*1.05){
              const luminance=(R+G+B)/3/175;
              for(let channel=0;channel<3;channel++)data.data[i+channel]=Math.min(255,Math.max(0,rgb[channel]*luminance));
            }
          }
          frameContext.putImageData(data,0,0);
        }
        item.frames.set(selectedColor,frame);
      }
      const scale=Math.min((canvas.width-24)/b.width,(canvas.height-12)/b.height);
      const width=b.width*scale,height=b.height*scale;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(item.frames.get(selectedColor),(canvas.width-width)/2,canvas.height-height-6,width,height);
      return true;
    };
    const updatePreview = () => {
      const preview = find('#profileAvatarPreview');
      const path = `/art/sprites/avatar-${selectedHair}.png`;
      if(preview.dataset.sprite===path&&preview.dataset.color===selectedColor) return;
      preview.dataset.sprite = path;
      preview.dataset.color = selectedColor;
      const existing = previewImages.get(path);
      preview.classList.toggle('has-sprite',existing?.loaded===true&&drawPreview(existing));
      if(existing) return;
      const image = new Image();
      const item = {image,loaded:false};
      previewImages.set(path,item);
      image.onload = () => {
        item.loaded = true;
        if(!settled && preview.dataset.sprite===path) preview.classList.toggle('has-sprite',drawPreview(item));
      };
      image.onerror = () => {
        if(!settled && preview.dataset.sprite===path) preview.classList.remove('has-sprite');
      };
      image.src = path;
    };
    const update = () => {
      const nickname = normalizeNickname(input.value);
      const count = countCharacters(nickname);
      const valid = count>=2 && count<=12;
      find('#profileNicknameCount').textContent = `${count}/12`;
      find('#profileNicknameCount').classList.toggle('over-limit',count>12);
      find('#profilePreviewName').textContent = nickname || '나의 탐험가';
      find('#profileEnter').disabled = !valid;
      input.setAttribute('aria-invalid',String(touched&&!valid));
      const error = touched&&!valid ? count===0?'닉네임을 입력해 주세요.':'닉네임은 2~12자로 입력해 주세요.' : '';
      find('#profileNicknameError').textContent = error;
      find('#profileNicknameError').hidden = !error;
      dialog.style.setProperty('--profile-outfit-color',selectedColor);
      find('#profileAvatarPreview').dataset.hair = selectedHair;
      updatePreview();
      find('#profileOutfitSwatch').style.background = selectedColor;
      find('#profileOutfitName').textContent = `${OUTFITS.find(item=>item.value===selectedColor).name} 탐험복`;
      for(const button of all('[data-profile-color]')) {
        const selected = button.dataset.profileColor===selectedColor;
        button.setAttribute('aria-checked',String(selected));
        button.tabIndex = selected?0:-1;
      }
      for(const button of all('[data-profile-hair]')) {
        const selected = button.dataset.profileHair===selectedHair;
        button.setAttribute('aria-checked',String(selected));
        button.tabIndex = selected?0:-1;
      }
      return {nickname,valid};
    };
    const finish = value => {
      if(settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      pendingProfile = null;
      resolve(value);
    };
    const bindChoices = (selector,key,setValue) => {
      const buttons = all(selector);
      for(const button of buttons) {
        button.addEventListener('click',()=>{setValue(button.dataset[key]);update();});
        button.addEventListener('keydown',event=>{
          if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
          event.preventDefault();
          const index = buttons.indexOf(button);
          const next = event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(['ArrowLeft','ArrowUp'].includes(event.key)?buttons.length-1:1))%buttons.length;
          buttons[next].click();buttons[next].focus();
        });
      }
    };
    bindChoices('[data-profile-color]','profileColor',value=>selectedColor=value);
    bindChoices('[data-profile-hair]','profileHair',value=>selectedHair=value);
    input.addEventListener('input',update);
    input.addEventListener('blur',()=>{touched=true;update();});
    find('#profileForm').addEventListener('submit',event=>{
      event.preventDefault();touched=true;
      const {nickname,valid}=update();
      if(!valid){input.focus();return;}
      finish({avatarName:nickname,avatarColor:selectedColor,avatarHair:selectedHair});
    });
    dialog.addEventListener('cancel',event=>{
      event.preventDefault();
      if(allowCancel) finish(null);
    });
    find('#profileCancel')?.addEventListener('click',()=>finish(null));
    // Preview and in-world character share the same limited outfit palette.
    update();dialog.showModal();
    input.focus({preventScroll:true});
  });
  return pendingProfile;
}

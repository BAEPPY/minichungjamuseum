import {test,expect} from '@playwright/test';

async function previewPixels(page){
 return page.locator('.profile-sprite').evaluate(canvas=>{
  const context=canvas.getContext('2d');
  const hash=(y,height)=>{
   const pixels=context.getImageData(0,y,canvas.width,height).data;
   let value=2166136261;
   for(const pixel of pixels)value=Math.imul(value^pixel,16777619);
   return value>>>0;
  };
  return {all:hash(0,canvas.height),head:hash(0,100),feet:hash(230,canvas.height-230)};
 });
}

async function isolatedProfile(page,options={}){
 await page.route('**/profile-test.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>'}));
 await page.goto('/profile-test.html');
 await page.evaluate(async options=>{
  const {requestProfile}=await import('/src/profile.js');
  window.__profileResult={done:false};
  requestProfile(options).then(result=>{window.__profileResult={done:true,result};});
 },options);
 await expect(page.locator('#profileDialog')).toBeVisible();
}

test('nickname entrance is required, has no agreement line and only minimal avatar choices',async({page})=>{
 await isolatedProfile(page);
 await expect(page.locator('#profileEnter')).toBeDisabled();
 await expect(page.locator('#profileCancel')).toHaveCount(0);
 await expect(page.locator('#profileDialog')).not.toContainText(/이용약관|개인정보처리방침|14세|동의/);
 await expect(page.locator('[data-profile-color]')).toHaveCount(3);
 await expect(page.locator('[data-profile-hair]')).toHaveCount(2);
 await page.keyboard.press('Escape');
 await expect(page.locator('#profileDialog')).toBeVisible();
 expect(await page.evaluate(()=>window.__profileResult.done)).toBe(false);
 await page.locator('#profileNickname').fill('   ');
 await expect(page.locator('#profileEnter')).toBeDisabled();
 await page.locator('#profileNickname').fill('가');
 await expect(page.locator('#profileEnter')).toBeDisabled();
 await page.locator('#profileNickname').fill('가'.repeat(13));
 await expect(page.locator('#profileNicknameCount')).toHaveText('13/12');
 await expect(page.locator('#profileEnter')).toBeDisabled();
 await page.locator('#profileNickname').fill('  청자탐험가  ');
 await expect(page.locator('#profileNicknameCount')).toHaveText('5/12');
 await expect(page.locator('#profileAvatarPreview')).toHaveClass(/has-sprite/);
 const creamPreview=await previewPixels(page);
 await page.locator('[data-profile-color="#7f9f82"]').click();
 await expect.poll(async()=>(await previewPixels(page)).all).not.toBe(creamPreview.all);
 const sagePreview=await previewPixels(page);
 expect(sagePreview.head).toBe(creamPreview.head);
 expect(sagePreview.feet).toBe(creamPreview.feet);
 await page.locator('[data-profile-hair="bob"]').click();
 await expect(page.locator('[data-profile-color="#7f9f82"]')).toHaveAttribute('aria-checked','true');
 await expect(page.locator('#profileAvatarPreview')).toHaveAttribute('data-hair','bob');
 await expect(page.locator('#profileAvatarPreview')).toHaveClass(/has-sprite/);
 await page.screenshot({path:'/workspace/profile-desktop.png'});
 await page.locator('#profileEnter').click();
 await expect(page.locator('#profileDialog')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__profileResult)).toEqual({done:true,result:{avatarName:'청자탐험가',avatarColor:'#7f9f82',avatarHair:'bob'}});
});

test('nickname length counts graphemes and optional editing can be canceled',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await isolatedProfile(page,{initial:{avatarName:'기록탐험가',avatarColor:'#a79cc3',avatarHair:'short'},allowCancel:true});
 await expect(page.locator('#profileNickname')).toHaveValue('기록탐험가');
 await expect(page.locator('[data-profile-color="#a79cc3"]')).toHaveAttribute('aria-checked','true');
 await page.locator('#profileNickname').fill('🌿'.repeat(12));
 await expect(page.locator('#profileNicknameCount')).toHaveText('12/12');
 await expect(page.locator('#profileEnter')).toBeEnabled();
 await page.locator('#profileNickname').fill('🌿'.repeat(13));
 await expect(page.locator('#profileEnter')).toBeDisabled();
 await page.locator('#profileNickname').fill('나의청자');
 await page.screenshot({path:'/workspace/profile-mobile.png'});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.keyboard.press('Escape');
 await expect(page.locator('#profileDialog')).toHaveCount(0);
 expect(await page.evaluate(()=>window.__profileResult)).toEqual({done:true,result:null});
});

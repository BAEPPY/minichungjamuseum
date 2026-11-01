import {readFile} from 'node:fs/promises';
// Deliberately synthetic 2-second H.264/AAC clip for end-to-end lesson plumbing.
// It is outside public/ and never replaces the uploaded production lesson.
export async function installNativeVideoFixture(page){
 const body=await readFile(new URL('../fixtures/native-video-test.mp4',import.meta.url));
 await page.route('**/videos/celadon-inlay.mp4',route=>route.fulfill({status:200,contentType:'video/mp4',body}));
}
export async function playNativeVideo(page){await page.locator('#videoHost video').evaluate(video=>video.play());}
export async function waitForNativeVideoEnd(page){await page.waitForFunction(()=>document.querySelector('#videoHost .video-lesson')?.dataset.state==='completed',{},{timeout:10000});}

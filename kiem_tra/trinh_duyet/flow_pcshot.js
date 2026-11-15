// Chụp màn hình trang Công việc (bước 109): mở đường dẫn ?r=... (mặc định #/viec) rồi đứng yên. Dùng kèm dung=1.
export default async ({ sleep }) => {
  const $ = (s) => document.querySelector(s);
  for (let i = 0; i < 600 && !$('#root .page-head, #root h1'); i++) await sleep(100);
  await sleep(1500);
  location.hash = new URLSearchParams(location.search).get('r') || '#/viec';
  for (let i = 0; i < 300 && !$('#pc-body'); i++) await sleep(100);
  await sleep(1200); window.scrollTo(0, 0);
  await new Promise(() => {});
};

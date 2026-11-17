// Bước 105: chỉ Chủ thấy và dùng nút Xóa phiếu xuất chưa nhận.
export default async ({sleep,out})=>{
 const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)]; const res=[];
 const wait=async(s)=>{for(let i=0;i<240&&!$(s);i++)await sleep(100);if(!$(s))throw new Error('Không thấy '+s);};
 try{
  await wait('#root'); const {rpc}=await import('../js/sb.js'); const role=new URLSearchParams(location.search).get('role')||'chu';
  const day=new Date(Date.now()+7*3600e3).toISOString().slice(0,10); const doc='PX105-'+role.toUpperCase();
  const id=await rpc('app_nh_create',{p:{branch_id:1,doc_no:doc,ship_at:day+' 08:00',total:10000,lines:[{code:'T105',name:'Món thử',unit:'Cái',qty:1,price:10000,amount:10000}]}});
  location.hash='#/hang-hoa/phieu-xuat';await wait('.px-row');await sleep(500);
  const row=$$('.px-row').find(x=>x.textContent.includes(doc)); if(!row)throw new Error('Không thấy phiếu thử '+doc);
  if(role==='chu'){
   if(!$('.px-del',row))throw new Error('Chủ không thấy nút Xóa phiếu xuất');
   window.confirm=()=>true;$('.px-del',row).click();await sleep(800);
   if($$('.px-row').some(x=>x.textContent.includes(doc)))throw new Error('Chủ bấm Xóa nhưng phiếu vẫn còn');
   res.push('Chủ thấy nút và xóa được phiếu chưa nhận');
  }else{
   if($('.px-del',row))throw new Error('Kế toán vẫn thấy nút Xóa phiếu xuất');
   let denied=false;try{await rpc('app_nh_delete',{p_id:id});}catch(e){denied=String(e.message).includes('Chỉ Chủ');}
   if(!denied)throw new Error('Kế toán gọi API xóa không bị chặn');
   res.push('Kế toán không thấy nút và gọi API bị chặn');
  }
  if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1)throw new Error('Giao diện tràn ngang');
 }catch(e){res.push('FAIL: '+e.stack);}
 out.push({route:'xóa phiếu xuất 105',title:res.join(' | '),errs:res.filter(x=>x.startsWith('FAIL:'))});
};

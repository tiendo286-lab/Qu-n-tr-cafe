// Bước 105 + 108: chỉ Chủ thấy và dùng nút Xóa phiếu xuất — cả phiếu chưa nhận lẫn phiếu ĐÃ NHẬN.
export default async ({sleep,out})=>{
 const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)]; const res=[];
 const wait=async(s)=>{for(let i=0;i<240&&!$(s);i++)await sleep(100);if(!$(s))throw new Error('Không thấy '+s);};
 try{
  await wait('#root'); const {rpc,sb}=await import('../js/sb.js'); const role=new URLSearchParams(location.search).get('role')||'chu';
  const day=new Date(Date.now()+7*3600e3).toISOString().slice(0,10); const doc='PX105-'+role.toUpperCase(); const doc2='PX108-'+role.toUpperCase();
  const mk=(d)=>rpc('app_nh_create',{p:{branch_id:1,doc_no:d,ship_at:day+' 08:00',total:10000,lines:[{code:'T105',name:'Món thử',unit:'Cái',qty:1,price:10000,amount:10000}]}});
  const id=await mk(doc); const id2=await mk(doc2);
  await sb.from('delivery_invoices').update({state:'da_nhan',received_at:day+' 09:00',received_date:day}).eq('id',id2);   // giả lập: nhân viên đã nhận xong
  location.hash='#/hang-hoa/phieu-xuat';await wait('.px-row');await sleep(500);
  const find=(d)=>$$('.px-row').find(x=>x.textContent.includes(d));
  const row=find(doc), row2=find(doc2); if(!row||!row2)throw new Error('Không thấy phiếu thử '+doc+' / '+doc2);
  if(role==='chu'){
   if(!$('.px-del',row))throw new Error('Chủ không thấy nút Xóa phiếu chưa nhận');
   if(!$('.px-del',row2))throw new Error('Chủ không thấy nút Xóa phiếu ĐÃ NHẬN');
   let ask='';window.confirm=(m)=>{ask=m;return true;};
   $('.px-del',row2).click();await sleep(800);
   if(!ask.includes('ĐÃ CÓ NHÂN VIÊN NHẬN HÀNG'))throw new Error('Phiếu đã nhận: câu hỏi xác nhận thiếu cảnh báo — '+ask);
   if(find(doc2))throw new Error('Chủ bấm Xóa phiếu đã nhận nhưng phiếu vẫn còn');
   res.push('Chủ xóa được phiếu ĐÃ NHẬN (có cảnh báo mất số liệu nhận hàng)');
   $('.px-del',find(doc)).click();await sleep(800);
   if(ask.includes('ĐÃ CÓ NHÂN VIÊN'))throw new Error('Phiếu chưa nhận lại hiện cảnh báo đã nhận');
   if(find(doc))throw new Error('Chủ bấm Xóa nhưng phiếu vẫn còn');
   res.push('Chủ xóa được phiếu chưa nhận');
  }else{
   if($('.px-del',row)||$('.px-del',row2))throw new Error('Kế toán vẫn thấy nút Xóa phiếu xuất');
   let denied=false;try{await rpc('app_nh_delete',{p_id:id2});}catch(e){denied=String(e.message).includes('Chỉ Chủ');}
   if(!denied)throw new Error('Kế toán gọi API xóa không bị chặn');
   res.push('Kế toán không thấy nút và gọi API bị chặn');
  }
  if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1)throw new Error('Giao diện tràn ngang');
 }catch(e){res.push('FAIL: '+e.stack);}
 out.push({route:'xóa phiếu xuất 105/108',title:res.join(' | '),errs:res.filter(x=>x.startsWith('FAIL:'))});
};

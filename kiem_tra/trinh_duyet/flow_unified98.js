// UI only, synthetic data. Server semantics tested separately in chot_ca_chung_98.sql.
export default async ({sleep,out}) => {
 const $=(q)=>document.querySelector(q), $$=(q)=>[...document.querySelectorAll(q)];
 const check=(ok,message)=>{if(!ok)throw new Error(message); results.push(message);};
 const wait=async(sel)=>{for(let i=0;i<180&&!$(sel);i++)await sleep(100);if(!$(sel))throw new Error('Không thấy '+sel);};
 const set=(el,val)=>{el.value=val;el.dispatchEvent(new Event('input',{bubbles:true}));};
 const results=[]; let failure=null;
 try {
  await wait('#root h1, #root h2, #root .card, #root nav'); $$('dialog[open]').forEach(d=>d.close());
  const {rpc}=await import('../js/sb.js');
  const day=new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
  const ov=await rpc('app_ca_overview',{p_date:day}); const o=ov.find(x=>x.branch_code==='LLB')||ov[0];
  const id=await rpc('app_ca_open',{p_branch:o.branch_id,p_date:day,p_shift:o.shift});
  for(const k of ['tien','nhan_su']) await rpc('app_ca_part_claim',{p_id:id,p_part:k,p_force:false});
  const e=(await rpc('app_ca_employees'))[0];
  await rpc('app_ca_save',{p_id:id,p:{rev_start:day+' 06:45',rev_end:day+' 12:35',ipos_opening:1000000,total_revenue:1000000,pos_cash:700000,pos_transfer:300000,pos_debt:0,pos_diff:0,cash_counted:1700000,reported_transfer:300000,cups:40,moves:[],debts:[],goods:[],handover:[],staff:[{employee_id:e.id,source:'lich',worked:true,time_in:'06:45',time_out:'12:35'}]}});
  await rpc('app_ca_photo_add',{p_id:id,p_path:'r'+id+'/ipos/test.jpg',p_kind:'ipos'});
  location.hash='#/ca/phieu?id='+id;await wait('#cm-next');await sleep(300);
  check($$('.sc-steps button').length===4,'4 bước Nhân viên · Bàn giao · Tiền · Kiểm tra');
  $('[data-shift-step="2"]').click();await wait('#cm-open');
  check($('#cm-open').value===day+'T06:45','Thời gian doanh thu hiện ngày và giờ');
  $('#cm-exchange').click();await sleep(100);
  set($('[data-mv="0"][data-k="amount"]'),'500000');set($('[data-mv="0"][data-k="note"]'),'Khách mẫu đổi tiền');
  set($('.cm-num[data-f="cash_counted"]'),'1200000');$('[data-sign="-1"]').click();await sleep(100);set($('.cm-num[data-f="pos_diff"]'),'500000');set($('#cm-hot'),'800000');
  check($$('.sc-exchange').length===1,'Một phiếu đổi tiền duy nhất');
  set($('#cm-close'),day+'T05:00');$('#cm-next').click();await sleep(100);check($('#cm-err').textContent.includes('sau bắt đầu'),'Chặn kết thúc trước bắt đầu');
  set($('#cm-close'),day+'T12:35');
  check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'Không tràn ngang '+document.documentElement.clientWidth+'px');
  if(new URLSearchParams(location.search).get('role')==='chu') {
   set($('#cm-hot'),'799000');
   const choice=$('[data-gap-action="chuyen_khoan"]'); check(!!choice,'Hiện cách xử lý khi có lệch');
   choice.value='chia'; choice.dispatchEvent(new Event('change',{bubbles:true}));
   set($('#cm-hot'),'800000');check(!$('[data-gap-action="chuyen_khoan"]'),'Bỏ lựa chọn cũ khi tiền đã khớp');
  }
  const halt=new URLSearchParams(location.search).get('dung');
  if(halt==='tien'){out.push({route:'unified98',title:results.join(' | '),errs:[]});document.body.insertAdjacentHTML('beforeend','<pre id="ketqua">'+results.join('\n')+'</pre>');return;}
  $('#cm-next').click();await wait('.cm-review-row');check($('[data-shift-step="3"]').classList.contains('on'),'Bước Kiểm tra tách riêng trước khi gửi');
  check(document.body.textContent.includes('Số nhân viên đã gửi được giữ nguyên'),'Nhắc giữ nguyên số nhân viên đã gửi');
  $('#cm-next').click();await wait('.pc-head');await sleep(400);
  const saved=await rpc('app_ca_get',{p_id:id});
  check(saved.status==='hoan_thanh','Gửi thành công');check($$('#moves .sc-exchange').length===1,'Phiếu gốc hiển thị một khoản đổi tiền');check(saved.moves.filter(m=>m.exchange_key).length===2,'Máy chủ giả lưu đủ hai bút toán');
  if(new URLSearchParams(location.search).get('role')==='chu') {
   check(saved.recon_status==='hoan_thanh','Quản lý tự chốt hoàn thành đối soát');
   location.hash='#/quan-ly/doi-soat/ca?id='+id+'&buoc=4';await wait('#ds-parts .sc-steps');await sleep(500);
   check($$('#moves .sc-exchange').length===1,'Đối soát tải lại một phiếu đổi tiền');check($('#ds-parts .sc-steps').getBoundingClientRect().width >= $('#ds-parts').getBoundingClientRect().width-2,'Thanh bước dùng đủ chiều rộng');
   check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'Đối soát không tràn ngang');
   check($$('#rev_start').length===1&&$$('#cash_counted').length===1&&$$('#reported_transfer').length===1,'Không trùng ô nhập thời gian và tiền');
   for(const item of ['thu_chi','tien_mat','chuyen_khoan']) await rpc('app_ca_item_reopen',{p_id:id,p_item:item,p_reason:'Kiểm thử sửa đổi tiền'});
   const debtId=await rpc('app_cn_debt_save',{p_id:null,p:{branch_id:o.branch_id,grp:'khach',name:'Khách thử sửa',amount:50000,note:'Khoản thử',kind:'bill',date:day}});
   await rpc('app_ca_recon_debt_collect',{p_report:id,p_debt:debtId,p_kind:'tien_mat',p_amount:50000,p_reason:'Kiểm thử khách trả'});
   location.hash='#/__tam';await sleep(200);location.hash='#/quan-ly/doi-soat/ca?id='+id+'&buoc=4';await wait('#moves .sc-exchange .mv-amt');await sleep(400);
   // bước 121: phần tiền mặc định Chỉ xem — bấm Mở để sửa, sửa xong bấm Lưu (lý do hỏi trong hộp)
   $('#ds-money-open')?.click();await sleep(1500);await wait('#moves .sc-exchange .mv-amt');
   set($('#moves .sc-exchange .mv-amt'),'400000');await sleep(300);
   const paid=(await rpc('app_ca_get',{p_id:id})).open_debts.find(x=>x.id===debtId);
   check(!!$(`[data-paid-delete="${paid.id}"]`)&&!$(`[data-paid-row="${paid.id}"] .paid-amount`)?.disabled,'Khách trả nợ cũ sửa ngay trên dòng và có nút Xoá');
   check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'Khách trả nợ cũ không tràn ngang điện thoại');
   $('#ds-money-save')?.click();await sleep(400);const why=$('dialog[open] [name=why]');check(!!why,'Có lý do sửa bản đối soát');if(why)why.value='Điều chỉnh phiếu đổi tiền thử';$('dialog[open] form')?.requestSubmit();await sleep(1800);
   const changed=await rpc('app_ca_recon',{p_id:id}); const pair=(changed.data?.moves||changed.moves||[]).filter(x=>x.exchange_key);
   check(pair.length===2&&pair.some(x=>x.amount===-400000)&&pair.some(x=>x.amount===400000),'Sửa một ô đổi tiền lưu cả hai vế');
   check((await rpc('app_ca_get',{p_id:id})).moves.some(x=>x.exchange_key&&x.amount===-500000),'Bản đối soát giữ nguyên phiếu gốc');
   await rpc('app_ca_recon_debt_update',{p_report:id,p_debt:paid.id,p_kind:'chuyen_khoan',p_amount:paid.amount,p_reason:'Kiểm thử sửa khách trả'});
   check((await rpc('app_ca_get',{p_id:id})).open_debts.find(x=>x.id===paid.id)?.collect_kind==='chuyen_khoan','Sửa được cách khách trả nợ');
   await rpc('app_ca_recon_debt_uncollect',{p_report:id,p_debt:paid.id,p_reason:'Kiểm thử xoá khách trả'});
   check(!(await rpc('app_ca_get',{p_id:id})).open_debts.find(x=>x.id===paid.id)?.closed_at,'Xoá đưa khách trở lại còn nợ');

  } else check(saved.recon_status!=='hoan_thanh','Nhân viên vẫn chờ quản lý');
 }catch(e){failure=e.stack;results.push('FAIL: '+e.stack);}
 const status=document.createElement('p');status.id='unified98-status';status.textContent=failure || window.__ERR.length ? 'KIỂM TRA THẤT BẠI: '+(failure || window.__ERR.join(';')) : 'ĐẠT '+results.length+' kiểm tra giao diện chốt ca / đối soát';document.body.appendChild(status);
 out.push({route:'unified98',title:results.join(' | '),errs:[...window.__ERR,...(failure?[failure]:[])]});
};

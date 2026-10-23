(function(){
  'use strict';
  var root=document.getElementById('view-lpo-details');
  var host=root&&root.querySelector('.dash-content');
  if(!host||!window.lpoData)return;
  var selectedPo=null;
  var editingPo=null;
  var statuses={};
  var savedOrders={};
  try{statuses=JSON.parse(localStorage.getItem('crop-lpo-status-v1')||'{}')||{};}catch(e){}
  try{savedOrders=JSON.parse(localStorage.getItem('crop-lpo-edits-v1')||'{}')||{};}catch(e){}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function rowFor(po){return Array.from(document.querySelectorAll('#lpo-list-tbody tr')).find(function(row){return row.querySelector('.grl-lpo-link')?.textContent.trim()===po;});}
  function statusFor(po,row){return statuses[po]||(row&&row.cells[6].querySelector('.grl-status-pill')?.textContent.trim())||'Pending (Sent)';}
  function normalizedStatus(value){return value==='Pending (Sent)'?'Sent':value;}
  Object.keys(savedOrders).forEach(function(po){if(!window.lpoData[po])return;Object.assign(window.lpoData[po],savedOrders[po]);var row=rowFor(po);if(row){row.cells[2].textContent=window.lpoData[po].supplier;row.cells[3].textContent=window.lpoData[po].branch;row.cells[4].textContent=window.lpoData[po].items.length+(window.lpoData[po].items.length===1?' item':' items');if(savedOrders[po].expected)row.cells[5].textContent=savedOrders[po].expected;}});
  Object.keys(statuses).forEach(function(po){var row=rowFor(po),pill=row&&row.cells[6].querySelector('.grl-status-pill');if(pill&&['Confirmed','Cancelled'].includes(statuses[po])){pill.textContent=statuses[po];pill.className='grl-status-pill '+(statuses[po]==='Confirmed'?'matched':'discrepancy');}});
  function icon(name){return '<img src="assets/figma-lpo/'+name+'.svg" alt="" width="'+(name==='edit'?'10.5':'16')+'" height="'+(name==='edit'?'10.5':'16')+'">';}
  function detail(label,value){return '<div class="lpo-fg-detail-row"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>';}
  host.className='dash-content lpo-figma-view';
  host.innerHTML='<div class="lpo-fg-header"><div><div class="lpo-fg-title-line"><h1 id="lpo-title">Purchase Order</h1><span id="lpo-fg-status" class="lpo-fg-status"></span></div><p id="lpo-subtitle"></p></div><div class="lpo-fg-header-actions"><button type="button" class="lpo-fg-back" onclick="showView(\'lpo-list\')">Back</button><button type="button" class="lpo-fg-edit" id="lpo-fg-edit" onclick="editLpoFromDetails()">'+icon('edit')+'Edit LPO</button></div></div>'+
    '<div class="lpo-fg-columns"><div class="lpo-fg-left"><section class="lpo-fg-card lpo-fg-supplier"><h2>Supplier Information</h2><div class="lpo-fg-supplier-row"><div class="lpo-fg-avatar" id="lpo-fg-initials"></div><div><strong id="lpo-fg-supplier-name"></strong><small>Verified Supplier · Nigeria</small></div></div></section><section class="lpo-fg-card lpo-fg-items"><div class="lpo-fg-items-head"><h2>Order Items</h2><p id="lpo-fg-item-count"></p></div><div class="lpo-fg-table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Qty</th></tr></thead><tbody id="lpo-fg-items-body"></tbody></table></div></section><section class="lpo-fg-card lpo-fg-notes"><h2>Notes to Supplier</h2><p id="lpo-fg-notes"></p></section></div><div class="lpo-fg-right"><section class="lpo-fg-card lpo-fg-order"><h2>Order Details</h2><div id="lpo-fg-details"></div></section><section class="lpo-fg-card lpo-fg-actions"><h2>Actions</h2><button type="button" class="lpo-fg-action pdf" onclick="window.print()">'+icon('download')+'Download as PDF</button><button type="button" class="lpo-fg-action email" onclick="emailLpoToSupplier()">'+icon('email')+'Send to Supplier via Email</button><button type="button" class="lpo-fg-action confirm" id="lpo-fg-confirm" onclick="setLpoDetailStatus(\'Confirmed\')">'+icon('confirm')+'Mark as Confirmed</button><button type="button" class="lpo-fg-action cancel" id="lpo-fg-cancel" onclick="setLpoDetailStatus(\'Cancelled\')">'+icon('cancel')+'Mark as Cancelled</button></section></div></div>';
  var nav=root.querySelectorAll('.dash-nav .subitem');nav.forEach(function(button){button.classList.toggle('active',button.textContent.trim()==='Purchase Orders (LPO)');});
  function render(po){
    var data=window.lpoData[po],row=rowFor(po);if(!data)return;
    selectedPo=po;
    var status=normalizedStatus(statusFor(po,row));
    root.querySelector('#lpo-title').textContent=po;
    root.querySelector('#lpo-subtitle').textContent='Purchase Order · '+data.supplier+' · Created '+(row?row.cells[1].textContent.trim():'—');
    var badge=root.querySelector('#lpo-fg-status');badge.textContent=status;badge.className='lpo-fg-status '+status.toLowerCase();
    root.querySelector('#lpo-fg-edit').hidden=status!=='Sent';
    root.querySelector('#lpo-fg-supplier-name').textContent=data.supplier;
    root.querySelector('#lpo-fg-initials').textContent=data.supplier.split(/\s+/).slice(0,2).map(function(s){return s[0];}).join('').toUpperCase();
    root.querySelector('#lpo-fg-item-count').textContent=data.items.length+' '+(data.items.length===1?'product':'products')+' ordered';
    root.querySelector('#lpo-fg-items-body').innerHTML=data.items.map(function(item,index){return '<tr><td>'+esc(item.name)+'</td><td class="lpo-fg-sku">'+esc(item.sku||'—')+'</td><td class="lpo-fg-qty">'+Number(item.qtyPurchased).toLocaleString('en-NG')+'<span>'+esc(item.unit)+'</span></td></tr>';}).join('');
    root.querySelector('#lpo-fg-notes').textContent=data.notes||'No notes to supplier added.';
    root.querySelector('#lpo-fg-details').innerHTML=detail('LPO Reference',po)+detail('Date Created',row?row.cells[1].textContent.trim():'—')+detail('Expected Delivery',row?row.cells[5].textContent.trim():'—')+detail('Delivery Branch',data.branch)+detail('Payment Terms',data.paymentTerms||'Net 30')+detail('Currency','NGN (₦)');
    root.querySelector('#lpo-fg-confirm').disabled=status!=='Sent';
    root.querySelector('#lpo-fg-cancel').disabled=status!=='Sent';
    showView('lpo-details');
  }
  window.openLpoDetails=render;
  window.setLpoDetailStatus=function(status){
    if(!selectedPo||normalizedStatus(statusFor(selectedPo,rowFor(selectedPo)))!=='Sent'||!['Confirmed','Cancelled'].includes(status))return;
    statuses[selectedPo]=status;
    try{localStorage.setItem('crop-lpo-status-v1',JSON.stringify(statuses));}catch(e){}
    var row=rowFor(selectedPo),pill=row&&row.cells[6].querySelector('.grl-status-pill');
    if(pill){pill.textContent=status;pill.className='grl-status-pill '+(status==='Confirmed'?'matched':'discrepancy');}
    window.openLpoDetails(selectedPo);
  };
  window.emailLpoToSupplier=function(){if(!selectedPo)return;var data=window.lpoData[selectedPo];window.location.href='mailto:?subject='+encodeURIComponent('Purchase Order '+selectedPo+' — '+data.supplier)+'&body='+encodeURIComponent('Please review purchase order '+selectedPo+'.');};
  var originalOpenLpoCreate=window.openLpoCreate;
  window.openLpoCreate=function(){editingPo=null;root.ownerDocument.querySelector('#view-lpo-create h1').textContent='Create Purchase Order (LPO)';root.ownerDocument.querySelector('#view-lpo-create .lpoc-submit-btn').textContent='Submit & Send to Supplier';return originalOpenLpoCreate();};
  var originalSubmitLpoCreate=window.submitLpoCreate;
  window.submitLpoCreate=function(){
    if(!editingPo)return originalSubmitLpoCreate();
    var po=editingPo,data=window.lpoData[po],row=rowFor(po);
    data.supplier=document.getElementById('lpoc-supplier').value||data.supplier;
    data.branch=document.getElementById('lpoc-branch').value||data.branch;
    data.notes=document.getElementById('lpoc-notes').value.trim();
    var items=Array.from(document.querySelectorAll('#lpoc-items-list .lpoc-item-row')).map(function(itemRow){var name=itemRow.querySelector('.lpoc-product-select').dataset.product;if(!name)return null;var old=data.items.find(function(it){return it.name===name;});return Object.assign({},old||{name:name,unit:'units',unitCost:0,qtySold:0,unitPrice:0},{qtyPurchased:Math.max(1,parseInt(itemRow.querySelector('.lpoc-qty-input').value,10)||1)});}).filter(Boolean);
    if(items.length)data.items=items;
    if(row){row.cells[2].textContent=data.supplier;row.cells[3].textContent=data.branch;row.cells[4].textContent=data.items.length+(data.items.length===1?' item':' items');var expected=document.getElementById('lpoc-expected-date').value;if(expected)row.cells[5].textContent=new Date(expected+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
    savedOrders[po]={supplier:data.supplier,branch:data.branch,notes:data.notes,items:data.items,expected:row?row.cells[5].textContent.trim():''};
    try{localStorage.setItem('crop-lpo-edits-v1',JSON.stringify(savedOrders));}catch(e){}
    editingPo=null;window.lpocPendingRef=null;showView('lpo-list');
  };
  window.editLpoFromDetails=function(){if(!selectedPo)return;window.openLpoCreate();editingPo=selectedPo;window.lpocPendingRef=selectedPo;document.querySelector('#view-lpo-create h1').textContent='Edit Purchase Order (LPO)';document.querySelector('#view-lpo-create .lpoc-submit-btn').textContent='Save Changes';var data=window.lpoData[selectedPo],poRow=rowFor(selectedPo),supplier=document.getElementById('lpoc-supplier'),branch=document.getElementById('lpoc-branch');[supplier,branch].forEach(function(select){var value=select===supplier?data.supplier:data.branch;if(!Array.from(select.options).some(function(option){return option.value===value;})){var option=document.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);}select.value=value;});var date=poRow&&new Date(poRow.cells[5].textContent.trim());if(date&&!isNaN(date.getTime()))document.getElementById('lpoc-expected-date').value=date.toISOString().slice(0,10);document.getElementById('lpoc-notes').value=data.notes||'';data.items.forEach(function(item){window.addLpocItemRow();var row=document.querySelector('#lpoc-items-list .lpoc-item-row:last-child');var select=row.querySelector('.lpoc-product-select');select.dataset.product=item.name;select.textContent=item.name;row.querySelector('.lpoc-qty-input').value=item.qtyPurchased;});};
})();

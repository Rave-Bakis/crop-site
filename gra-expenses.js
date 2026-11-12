(function () {
  'use strict';
  var key = 'crop-gra-expenses-v1', data = {gras:{},expenses:[]}, saved = null, storageError = '';
  try {
    saved = localStorage.getItem(key);
    if (saved) {
      var parsed=JSON.parse(saved);
      if(!parsed.gras || !Array.isArray(parsed.expenses))throw new Error('Invalid expense records');
      data=parsed;
    }
  } catch(error) { storageError='GRA expense records could not be loaded. Restore browser storage before saving.'; }
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function money(v){ return window.cropMarket.format(v,2); }
  function round(v){return Math.round((Number(v)+Number.EPSILON)*100)/100;}
  function number(v){return Number(String(v||'').replace(/[^\d.-]/g,''))||0;}
  function ref(v){return String(v||'').trim().replace(/^LPO-/,'PO-');}
  function today(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function day(v){if(!v||v==='—')return '';if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);var d=new Date(v);return isNaN(d.getTime())?'':d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  function displayDate(v){return v?new Date(v+'T12:00:00').toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'Not recorded';}
  function save(next){
    if(storageError)return storageError;
    try{if(localStorage.getItem(key)!==saved)return 'GRA expense records changed in another tab. Reload before saving.';var serialized=JSON.stringify(next);localStorage.setItem(key,serialized);saved=serialized;data=next;return '';}
    catch(error){return 'Unable to save the expense. Browser storage is full or unavailable. No expense has been recorded.';}
  }
  function gras(){
    var records={},source=window.getSupplierProcurementSnapshot?window.getSupplierProcurementSnapshot():{receivedPurchaseOrders:{}};
    Object.entries(source.receivedPurchaseOrders).forEach(function(entry){var po=entry[0],order=window.lpoData[po];if(!order)return;var items=(order.items||[]).map(function(it){return {name:it.name,sku:it.sku||'',unit:it.unit||'units',qtyPurchased:Number(it.qtyPurchased)||0,qtyOrdered:Number(it.qtyPurchased)||0,unitCost:Number(it.unitCost)||0};});records[entry[1]]={id:entry[1],po:po,supplier:order.supplier,branch:order.branch||'',date:'',items:items,receivedValue:round(items.reduce(function(s,it){return s+it.qtyPurchased*it.unitCost;},0)),status:'Matched'};});
    return Object.values(Object.assign(records,data.gras));
  }
  window.getGraProcurementSnapshot=function(){return clone({gras:gras(),expenses:data.expenses});};
  function fields(root){var result={};root.querySelectorAll('.grav-field').forEach(function(f){var label=f.querySelector('.lbl'),value=f.querySelector('.val');if(label&&value)result[label.textContent.trim()]=value.textContent.trim();});return result;}
  function context(root){
    if(!root || !['view-gra-processing-view','view-gra-processing-partial'].includes(root.id))return null;
    var f=fields(root),id=f['GRA Reference'],po=ref(f['LPO Reference']);
    if(!id || !po)return null;
    var existing=gras().find(function(g){return g.id===id&&ref(g.po)===po;});
    if(existing)return existing;
    var order=window.lpoData[po];
    var items=Array.from(root.querySelectorAll('.grav-table tbody tr')).map(function(row){var name=row.querySelector('.gra-item-name'),qty=String(row.cells[1]?.textContent||'').split('/'),known=order?.items.find(function(it){return it.name===name?.textContent.trim();});return {name:name?.textContent.trim()||row.cells[0]?.textContent.trim()||'',qtyPurchased:number(qty[0]),qtyOrdered:number(qty[1]||qty[0]),unitCost:cropMarket.read(row.cells[2]),unit:known?.unit||'units'};});
    var total=root.querySelector('[id$="recvtotal"]');
    return {id:id,po:po,supplier:f.Supplier||'',branch:f['Delivery Branch']||'',date:day(f['Actual Receipt Date']),status:root.id==='view-gra-processing-partial'?'Partially Matched':'Matched',items:items,receivedValue:total?cropMarket.read(total):round(items.reduce(function(s,it){return s+it.qtyPurchased*it.unitCost;},0))};
  }
  function expenseRows(list){return '<div class="ge-table-wrap"><table class="gra-table grav-table"><thead><tr><th>Date</th><th>Category / Vendor</th><th>Description</th><th>Payment Method</th><th class="right">Amount</th><th>Receipt</th></tr></thead><tbody>'+list.map(function(e){return '<tr><td>'+displayDate(e.date)+'</td><td>'+esc(e.category)+'<small>'+esc(e.vendor)+'</small></td><td class="ge-description">'+esc(e.description)+'</td><td>'+esc(e.paymentMethod)+'</td><td class="right">'+money(e.amount)+'</td><td>'+(e.receipt?'<button type="button" class="ge-link" data-id="'+esc(e.id)+'" onclick="downloadGraExpenseReceipt(this.dataset.id)">Download Receipt</button><small>'+esc(e.receipt.name)+'</small>':'—')+'</td></tr>';}).join('')+'</tbody></table></div>';}
  function decorate(root){
    var g=context(root);if(!g)return;
    var actions=root.querySelector('.gra-hero [onclick*="openRecordInvoiceFromGra"]')?.parentElement;
    if(actions&&!actions.querySelector('.ge-record-button')){var button=document.createElement('button');button.type='button';button.className='grav-btn-primary ge-record-button';button.textContent='Record Expenses';button.dataset.view=root.id;button.onclick=function(){openGraExpenseModal(this.dataset.view);};actions.appendChild(button);}
    root.querySelectorAll('.ge-history-card').forEach(function(el){el.remove();});
    var left=root.querySelector('.grav-grid > div:first-child');if(!left)return;
    var list=data.expenses.filter(function(e){return e.gra===g.id;}),card=document.createElement('div');card.className='grav-card ge-history-card';
    card.innerHTML='<div class="ge-history-heading"><h3>Procurement Expenses</h3><strong>'+money(list.reduce(function(sum,e){return sum+e.amount;},0))+'</strong></div><p class="ge-sub">Expenses linked to '+esc(g.id)+' · '+esc(g.po)+'</p>'+(list.length?expenseRows(list):'<p class="ge-empty">No expenses recorded for this GRA.</p>');left.appendChild(card);
  }
  function announce(){document.querySelectorAll('#view-gra-processing-view,#view-gra-processing-partial').forEach(decorate);window.dispatchEvent(new CustomEvent('crop:gra-updated'));}
  var overlay=document.createElement('div');overlay.id='gra-expense-overlay';overlay.className='modal-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','ge-title');document.body.appendChild(overlay);
  var returnFocus,submission=0;
  window.closeGraExpenseModal=function(){submission++;overlay.classList.remove('open');if(returnFocus&&returnFocus.isConnected)returnFocus.focus();};
  overlay.onclick=function(event){if(event.target===overlay)closeGraExpenseModal();};
  function get(id){return document.getElementById(id).value.trim();}
  window.openGraExpenseModal=function(viewId){
    var root=document.getElementById(viewId||document.querySelector('.view.active')?.id),g=context(root);
    if(!g){alert('Expenses can only be recorded after a GRA has been processed.');return;}
    returnFocus=document.activeElement;submission++;
    overlay.innerHTML='<div class="ge-modal"><header class="ge-head"><div><h2 id="ge-title">Add New Expense</h2><p>Record a new financial transaction.</p></div><button type="button" class="ge-close" aria-label="Close expense modal" onclick="closeGraExpenseModal()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header><form id="ge-form"><div class="ge-body"><div class="ge-link-context">Linked to <strong>'+esc(g.id)+'</strong><span>·</span>LPO <strong>'+esc(g.po)+'</strong><span>·</span>'+esc(g.supplier)+'</div><div class="ge-grid"><label for="ge-date">Date<input type="date" id="ge-date" required value="'+today()+'" max="'+today()+'"></label><label for="ge-category">Category<select id="ge-category" required><option value="">Select</option><option>Transportation</option><option>Loading / Unloading</option><option>Logistics / Delivery</option><option>Storage</option><option>Packaging</option><option>Fuel</option><option>Other</option></select></label><label for="ge-vendor">Vendor<input id="ge-vendor" required placeholder="e.g. Amazon, Bolt, local supplier"></label><label for="ge-amount">Amount (NGN)<input type="number" id="ge-amount" required min="0.01" step="0.01" placeholder="0.00"></label><label for="ge-method">Payment Method<select id="ge-method" required><option value="">Select</option><option>Bank Transfer</option><option>Cash</option><option>POS / Card</option><option>Cheque</option><option>Mobile Money</option><option>Other</option></select></label></div><label class="ge-wide" for="ge-description">Description<textarea id="ge-description" required rows="4" placeholder="Briefly explain the purpose of this expense..."></textarea></label><div class="ge-wide"><label for="ge-receipt">Receipt Attachment</label><label class="ge-dropzone" for="ge-receipt"><span class="ge-upload-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 17H6a4 4 0 0 1-1-7.9 7 7 0 0 1 13.5-1A4.5 4.5 0 0 1 19 17h-3"/><path d="M12 21V10m-4 4 4-4 4 4"/></svg></span><strong>Click to upload a receipt</strong><span>PDF, JPG, PNG · Max 5MB · Optional</span><input type="file" id="ge-receipt" accept=".pdf,.jpg,.jpeg,.png" aria-describedby="ge-file-status"></label><div id="ge-file-status" class="ge-file-status" role="status">No receipt attached.</div><button type="button" class="ge-link" id="ge-remove-file" hidden>Remove attachment</button></div><p id="ge-error" class="ge-error" role="alert"></p></div><footer class="ge-footer"><button type="button" class="ge-cancel" onclick="closeGraExpenseModal()">Cancel</button><button type="submit" id="ge-submit" class="ge-submit">Submit</button></footer></form></div>';
    var fileInput=document.getElementById('ge-receipt'),fileStatus=document.getElementById('ge-file-status'),remove=document.getElementById('ge-remove-file');
    fileInput.onchange=function(){var file=fileInput.files[0],error=file?fileError(file):'';fileStatus.textContent=file?(error||file.name+' · '+(file.size/1024).toFixed(1)+' KB'):'No receipt attached.';fileStatus.classList.toggle('error',!!error);remove.hidden=!file;};
    remove.onclick=function(){fileInput.value='';fileInput.onchange();};
    var busy=false;
    document.getElementById('ge-form').onsubmit=async function(event){
      event.preventDefault();if(busy)return;
      var date=get('ge-date'),category=get('ge-category'),vendor=get('ge-vendor'),amount=cropMarket.parse(get('ge-amount')),method=get('ge-method'),description=get('ge-description'),error='';
      if(!date||date>today()||!category||!vendor||!method||!description)error='Complete the date, category, vendor, payment method and description.';
      else if(!cropMarket.validInput(get('ge-amount'))||!Number.isFinite(amount)||amount<0.01||!Number.isSafeInteger(Math.round(amount*100))||Math.abs(amount*100-Math.round(amount*100))>0.000001)error='Enter an amount above zero with at most two decimal places.';
      if(error){document.getElementById('ge-error').textContent=error;return;}
      var button=document.getElementById('ge-submit'),token=++submission,file=fileInput.files[0],actor=root.querySelector('.dash-user-name')?.textContent.trim()||'Admin';
      busy=true;button.disabled=true;button.textContent='Saving…';document.getElementById('ge-error').textContent='';
      try{
        var receipt=file?await readReceipt(file):null;
        if(token!==submission||!button.isConnected||!overlay.classList.contains('open'))return;
        var expense={id:'EXP-'+new Date().getFullYear()+'-'+crypto.randomUUID().slice(0,8).toUpperCase(),gra:g.id,po:ref(g.po),supplier:g.supplier,branch:g.branch,date:date,category:category,vendor:vendor,amount:round(amount),paymentMethod:method,description:description,receipt:receipt,recordedBy:actor,recordedAt:new Date().toISOString()};
        var next=clone(data);next.gras[g.id]=clone(g);next.expenses.push(expense);
        var failure=save(next);if(failure)throw new Error(failure);
        closeGraExpenseModal();announce();
      }catch(error){if(token===submission&&button.isConnected)document.getElementById('ge-error').textContent=error.message||'Unable to record this expense.';}
      finally{busy=false;button.disabled=false;button.textContent='Submit';}
    };
    overlay.classList.add('open');overlay.querySelector('button').focus();
  };
  function fileError(file){if(file.size===0)return 'The receipt is empty.';if(file.size>5*1024*1024)return 'Receipt exceeds 5MB. Choose a smaller file.';if(!/\.(pdf|jpe?g|png)$/i.test(file.name)||(file.type&&!['application/pdf','image/jpeg','image/png'].includes(file.type)))return 'Only PDF, JPG and PNG receipts are supported.';return '';}
  function readReceipt(file){return new Promise(function(resolve,reject){var error=fileError(file);if(error){reject(new Error(error));return;}var reader=new FileReader();reader.onerror=function(){reject(new Error('The receipt could not be read. Please choose it again.'));};reader.onload=function(){var encoded=String(reader.result).split(',')[1],head=atob(encoded.slice(0,16)),ext=file.name.split('.').pop().toLowerCase(),pdf=head.slice(0,5)==='%PDF-',png=head.slice(0,8)==='\x89PNG\r\n\x1a\n',jpg=head.charCodeAt(0)===255&&head.charCodeAt(1)===216&&head.charCodeAt(2)===255;if(!((ext==='pdf'&&pdf)||(ext==='png'&&png)||(['jpg','jpeg'].includes(ext)&&jpg))){reject(new Error('The receipt content does not match PDF, JPG or PNG.'));return;}var type=pdf?'application/pdf':png?'image/png':'image/jpeg';resolve({name:file.name,type:type,size:file.size,data:'data:'+type+';base64,'+encoded});};reader.readAsDataURL(file);});}
  window.downloadGraExpenseReceipt=function(id){var expense=data.expenses.find(function(e){return e.id===id;}),receipt=expense&&expense.receipt;if(!receipt||!/^data:(application\/pdf|image\/jpeg|image\/png);base64,[A-Za-z0-9+/=]+$/.test(receipt.data)){alert('No receipt is attached to this expense.');return;}try{var raw=atob(receipt.data.split(',')[1]),bytes=Uint8Array.from(raw,function(c){return c.charCodeAt(0);}),url=URL.createObjectURL(new Blob([bytes],{type:receipt.data.slice(5,receipt.data.indexOf(';'))})),a=document.createElement('a');a.href=url;a.download=receipt.name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}catch(error){alert('The receipt could not be downloaded.');}};
  function applyProcessed(root,g){
    root.querySelector('.gra-hero h1').textContent='GRA — '+g.po;
    root.querySelector('.gra-subtitle').textContent='Reviewing Goods Received Advice for '+g.supplier+'.';
    var map={'GRA Reference':g.id,'LPO Reference':g.po,'Supplier':g.supplier,'Delivery Branch':g.branch||'Not recorded','Actual Receipt Date':displayDate(g.date)};
    root.querySelectorAll('.grav-field').forEach(function(f){var label=f.querySelector('.lbl')?.textContent.trim();if(map[label])f.querySelector('.val').textContent=map[label];});
    root.querySelector('.grav-table tbody').innerHTML=g.items.map(function(it){return '<tr><td><div class="gra-item-name">'+esc(it.name)+'</div><div class="gra-item-sku">'+esc(it.unit||'units')+'</div></td><td class="center">'+it.qtyPurchased+' / '+(it.qtyOrdered==null?it.qtyPurchased:it.qtyOrdered)+'</td><td class="right">'+money(it.unitCost)+'</td><td class="center">'+(it.qtyPurchased===it.qtyOrdered?'✓':'Partial')+'</td></tr>';}).join('');
    var expected=round(g.items.reduce(function(s,it){return s+(it.qtyOrdered==null?it.qtyPurchased:it.qtyOrdered)*it.unitCost;},0));
    root.querySelector('[id$="recvtotal"]').textContent=money(g.receivedValue);root.querySelector('[id$="exptotal"]').textContent=money(expected);root.querySelector('[id$="variance"]').textContent=money(round(g.receivedValue-expected));decorate(root);
  }
  window.openProcessedGra=function(id){var g=gras().find(function(g){return g.id===id;});if(!g)return;var view=g.status==='Partially Matched'?'gra-processing-partial':'gra-processing-view';showView(view);applyProcessed(document.getElementById('view-'+view),g);};
  function renderProcessedRows(){var body=document.querySelector('#view-gra-processing .grl-table tbody');if(!body)return;body.querySelectorAll('.ge-processed-row').forEach(function(row){row.remove();});Object.values(data.gras).forEach(function(g){if(Array.from(body.querySelectorAll('.sret-gra-row [data-po]')).some(function(el){return el.dataset.po===g.po;}))return;var row=document.createElement('tr');row.className='ge-processed-row';row.innerHTML='<td class="grl-gra-id">'+esc(g.id)+'</td><td>'+esc(g.supplier)+'</td><td>'+esc(g.po)+'</td><td>'+displayDate(g.date)+'</td><td><span class="grl-status-pill '+(g.status==='Matched'?'matched':'partial')+'">'+esc(g.status)+'</span></td><td>See supplier invoices</td><td>'+esc(g.recordedBy||'Procurement')+'</td><td><button type="button" class="ge-link" data-id="'+esc(g.id)+'" onclick="openProcessedGra(this.dataset.id)">View GRA</button></td>';body.prepend(row);});}
  var originalOpenSupplierGra=window.openSupplierReturnGra;
  window.openSupplierReturnGra=function(po){var result=originalOpenSupplierGra.apply(this,arguments),g=Object.values(data.gras).find(function(g){return ref(g.po)===ref(po);});if(g){var target=g.status==='Partially Matched'?'gra-processing-partial':'gra-processing-view';if(!document.getElementById('view-'+target).classList.contains('active'))showView(target);applyProcessed(document.getElementById('view-'+target),g);}return result;};
  var originalConfirm=window.confirmGraExpiryDates;
  window.confirmGraExpiryDates=function(){
    var pending=document.getElementById('view-gra-processing-detail'),heading=pending.querySelector('.gra-hero h1').textContent,po=ref(heading.match(/(?:LPO|PO)-[\w-]+/)?.[0]),order=window.lpoData[po],supplier=pending.querySelector('.gra-ref-chip')?.textContent.trim()||order?.supplier||'';
    var items=Array.from(document.querySelectorAll('#gpd-items-table tbody tr')).map(function(row){var name=row.querySelector('.gra-item-name').childNodes[0].textContent.trim(),inputs=row.querySelectorAll('.gra-received-input'),known=order?.items.find(function(it){return it.name===name;});return {name:name,sku:row.querySelector('.gra-item-sku')?.textContent.replace(/^SKU:\s*/,'').trim()||'',unit:known?.unit||'units',qtyPurchased:Number(inputs[0].value),qtyOrdered:Number(row.querySelector('.gra-ordered-qty').textContent),unitCost:cropMarket.read(inputs[1])};});
    if(!po||!items.length||items.some(function(it){return !Number.isFinite(it.qtyPurchased)||it.qtyPurchased<0||!Number.isFinite(it.unitCost)||it.unitCost<0;})){alert('Check the received quantities and unit costs before confirming the GRA.');return;}
    var id='GRA-'+po,g={id:id,po:po,supplier:supplier,branch:order?.branch||'',date:today(),items:items,receivedValue:round(items.reduce(function(s,it){return s+it.qtyPurchased*it.unitCost;},0)),status:items.some(function(it){return it.qtyPurchased!==it.qtyOrdered;})?'Partially Matched':'Matched',recordedAt:new Date().toISOString(),recordedBy:pending.querySelector('.dash-user-name')?.textContent.trim()||'Admin'};
    var next=clone(data);next.gras[id]=g;var error=save(next);if(error){alert(error);return;}
    var result=originalConfirm.apply(this,arguments),active=document.querySelector('.view.active');
    if(active&&['view-gra-processing-view','view-gra-processing-partial'].includes(active.id))applyProcessed(active,g);
    renderProcessedRows();window.dispatchEvent(new CustomEvent('crop:gra-updated'));return result;
  };
  var previousShowView=window.showView;
  window.showView=function(name){var result=previousShowView.apply(this,arguments);if(name==='gra-processing-view'||name==='gra-processing-partial')decorate(document.getElementById('view-'+name));if(name==='gra-processing')renderProcessedRows();return result;};
  window.addEventListener('storage',function(event){if(event.key!==key)return;try{var next=JSON.parse(event.newValue||'null');if(next&&next.gras&&Array.isArray(next.expenses)){data=next;saved=event.newValue;announce();}}catch(error){}});
  document.addEventListener('keydown',function(event){if(!overlay.classList.contains('open'))return;if(event.key==='Escape'){closeGraExpenseModal();return;}if(event.key==='Tab'){var controls=Array.from(overlay.querySelectorAll('button,input,select,textarea')).filter(function(el){return !el.disabled&&!el.hidden;}),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
})();

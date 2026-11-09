(function () {
  'use strict';
  // This static prototype has no authentication service or server database.
  // Persist each change before reporting success; invoice customer details are snapshots.
  var key = 'crop-credit-sales-v1';
  var state = { customers: [], invoices: [] };
  var storageError = '';
  try {
    var saved = localStorage.getItem(key);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (!Array.isArray(parsed.customers) || !Array.isArray(parsed.invoices)) throw new Error('Invalid records');
      state = parsed;
    }
  } catch (e) { storageError = 'Saved credit records could not be read. Please restore browser storage before saving changes.'; }
  var invoiceView = document.getElementById('view-generate-invoice');
  if (!invoiceView) return;
  var selectedInvoice = null, customerSource = 'sales', returnFocus;
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function uid(prefix) { return prefix + '-' + crypto.randomUUID(); }
  function money(n) { return '₦' + Number(n).toLocaleString('en-NG', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
  function date(v) { return v ? new Date(v + 'T12:00:00').toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}) : '—'; }
  function validDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) && new Date(v+'T12:00:00Z').toISOString().slice(0,10) === v; }
  function commit(next) {
    if (storageError) { alert(storageError); return false; }
    try {
      // Refuse stale writes from another open tab rather than overwrite its changes.
      var existing = localStorage.getItem(key);
      if (existing && JSON.stringify(JSON.parse(existing)) !== JSON.stringify(state)) { alert('Credit records changed in another tab. Reload this page before saving.'); return false; }
      localStorage.setItem(key, JSON.stringify(next)); state = next; return true;
    } catch (e) { alert('Unable to save. Browser storage may be full or unavailable. Your changes have not been recorded.'); return false; }
  }
  function canRecordPayment() { return /^(super admin|admin|business owner|owner)$/i.test(invoiceView.querySelector('.dash-user-role').textContent.trim()); }
  // Read older single-payment invoices without rewriting their saved audit record.
  function payments(i) { return Array.isArray(i.payments) ? i.payments : i.payment ? [i.payment] : []; }
  function paidAmount(i) { return round(payments(i).reduce(function(sum,p){return sum + Number(p.amount);},0)); }
  function balance(i) { return round(Math.max(0, i.total - paidAmount(i))); }
  function overdue(i) { return balance(i) > 0 && i.dueDate < today(); }
  function status(i) { return balance(i) === 0 ? 'Paid' : paidAmount(i) > 0 ? 'Partially Paid' : overdue(i) ? 'Overdue' : 'Unpaid'; }
  function badge(i) {
    var s = status(i);
    var style=s==='Paid'?'matched':s==='Partially Paid'?'partial':s==='Overdue'?'discrepancy':'pending';
    return '<span class="grl-status-pill '+style+'">'+s+'</span>' + (s === 'Partially Paid' && overdue(i) ? ' <span class="grl-status-pill discrepancy">Overdue</span>' : '');
  }
  function field(label,id,type,value,required) { return '<div class="gis-field"><label for="'+id+'">'+label+(required?' *':'')+'</label><input id="'+id+'" type="'+type+'" value="'+esc(value || '')+'" '+(required?'required':'')+'></div>'; }
  function val(id) { return document.getElementById(id).value.trim(); }
  function notify(message) { document.getElementById('gis-action-status-text').textContent=message; document.getElementById('gis-action-status').classList.add('show'); }

  // The existing selectable POS customers are also available to the invoice selector.
  var seeds = Array.from(document.querySelectorAll('#pos-swipe-chips .pos-swipe-chip')).map(function(chip,index) {
    var name=chip.querySelector('.pos-swipe-chip-name').textContent, contact=chip.querySelector('.pos-swipe-chip-sub').textContent;
    return {id:'existing-user-'+index,type:'user',name:name,phone:contact.includes('@')?'':contact,email:contact.includes('@')?contact:'',address:''};
  });
  function customers() { return seeds.concat(state.customers); }
  function customerOptions() { return '<option value="">Select a customer</option>' + customers().map(function(c) { return '<option value="'+esc(c.id)+'">'+esc(c.name)+' — '+(c.type==='store'?'Store':'User')+'</option>'; }).join(''); }
  var bill = document.getElementById('gis-cust-name').closest('.gis-card');
  bill.innerHTML = '<div class="ci-heading"><h3>Bill To</h3><button type="button" class="gis-add-item-btn" onclick="openAddCustomerModal(\'invoice\')">+ New Customer</button></div><div class="gis-field"><label for="ci-customer">Customer *</label><select id="ci-customer" onchange="ciSelectCustomer()">'+customerOptions()+'</select></div><div class="gis-field ci-billing-email"><label for="ci-billing-email">Customer Email</label><input type="email" id="ci-billing-email" readonly placeholder="Select a customer to see their email"></div><div id="ci-customer-summary" class="ci-muted" style="margin-top:12px">Select a saved customer or create a new profile here.</div>';
  var details = invoiceView.querySelector('.gis-main-col');
  details.insertAdjacentHTML('beforeend','<div class="gis-card"><h3>Credit Terms &amp; Notes</h3><p class="ci-muted">This invoice will be recorded as an unpaid credit order until payment is confirmed.</p><div class="gis-field"><label for="ci-notes">Payment terms / order notes</label><textarea id="ci-notes" rows="3" placeholder="Agreed payment terms, delivery details or purchase reference"></textarea></div></div>');
  var actions=invoiceView.querySelector('.gis-side-col .gis-card');
  actions.querySelector('h4').insertAdjacentHTML('afterend','<button type="button" class="gis-action-btn primary" id="ci-generate" onclick="ciGenerate()">Generate Credit Invoice</button><button type="button" class="gis-action-btn" onclick="ciOpenRegister()">View Credit Invoices</button><p class="ci-muted" id="ci-saved-message" role="status">Generate once to save this credit order.</p>');
  actions.querySelector('[onclick="gisAction(\'pdf\')"]').textContent='Print / Save PDF';
  actions.querySelector('[onclick="gisAction(\'email\')"]').textContent='Draft Email';
  actions.querySelector('[onclick="gisAction(\'email\')"]').insertAdjacentHTML('afterend','<button type="button" class="gis-action-btn" onclick="gisAction(\'whatsapp\')">Send via WhatsApp</button>');
  var heading=invoiceView.querySelector('h1');
  heading.insertAdjacentHTML('afterend','<p class="ci-muted">Sell on credit and track each customer’s payment.</p>');
  function nextNumber() { var n=248; state.invoices.forEach(function(i){var m=/^INV-(\d+)$/.exec(i.number);if(m)n=Math.max(n,Number(m[1])+1);});return 'INV-'+String(n).padStart(4,'0'); }
  document.getElementById('gis-inv-number').value=nextNumber();
  document.getElementById('gis-inv-date').value=today();
  document.getElementById('gis-due-date').value=today();
  window.ciSelectCustomer=function(){
    var c=customers().find(function(c){return c.id===val('ci-customer');});
    var email=document.getElementById('ci-billing-email');
    email.value=c ? c.email || '' : '';
    email.placeholder=c ? 'No email saved for this customer' : 'Select a customer to see their email';
    document.getElementById('ci-customer-summary').textContent=c?[c.type==='store'?'Store profile':'User profile',c.contactName,c.phone,c.email,c.address,c.type==='store'?'Default credit term: '+c.creditDays+' days':''].filter(Boolean).join(' · '):'Select a saved customer or create a new profile here.';
    if(c && c.type==='store') { var d=new Date((val('gis-inv-date')||today())+'T12:00:00');d.setDate(d.getDate()+Number(c.creditDays||0));document.getElementById('gis-due-date').value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  };
  function refreshCustomers(id){ document.getElementById('ci-customer').innerHTML=customerOptions();document.getElementById('ci-customer').value=id||'';ciSelectCustomer();renderPosCustomers(); }

  // Keep preview amounts identical to the persisted invoice, including kobo.
  window.gisLineTotal=function(row){var total=round((Number(row.querySelector('.gis-qty').value)||0)*(Number(row.querySelector('.gis-price').value)||0));row.querySelector('.gis-line-total').textContent=money(total);return total;};
  window.gisRecalcTotals=function(){var subtotal=round(Array.from(document.querySelectorAll('#gis-items-body .gis-item-row')).reduce(function(sum,row){return sum+gisLineTotal(row);},0)),vat=round(subtotal*0.075);document.getElementById('gis-subtotal').textContent=money(subtotal);document.getElementById('gis-vat').textContent=money(vat);document.getElementById('gis-total').textContent=money(round(subtotal+vat));};
  gisRecalcTotals();

  var overlay=document.getElementById('addcust-modal-overlay');
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','ci-profile-title');
  var modal=overlay.querySelector('.addcust-modal');
  window.openAddCustomerModal=function(source){customerSource=source==='invoice'?'invoice':'sales';if(!overlay.classList.contains('open'))returnFocus=document.activeElement;modal.innerHTML='<h2 id="ci-profile-title">Create Customer Profile</h2><p class="sub">What kind of customer are you adding?</p><div class="ci-profile-options"><button type="button" onclick="ciCustomerForm(\'store\')"><strong>Store Profile</strong><span>Smaller stores buying goods on credit. Save business, contact and payment terms.</span></button><button type="button" onclick="ciCustomerForm(\'user\')"><strong>User Profile</strong><span>An individual customer. Save their personal and contact details.</span></button></div><button type="button" class="addcust-btn-cancel" onclick="closeAddCustomerModal()">Cancel</button>';overlay.classList.add('open');modal.querySelector('button').focus();};
  window.closeAddCustomerModal=function(){overlay.classList.remove('open');if(returnFocus)returnFocus.focus();};
  window.ciCustomerForm=function(type){
    var store=type==='store';
    modal.innerHTML='<h2 id="ci-profile-title">'+(store?'New Store Profile':'New User Profile')+'</h2><p class="sub">'+(store?'Business details for a store that buys on credit.':'Personal details for an individual customer.')+'</p><form class="addcust-form" id="ci-customer-form"><div class="gis-grid-2">'+field(store?'Store / business name':'Full name','ci-name','text','',true)+(store?field('Owner / contact person','ci-contact','text','',true):'')+field('Phone number','ci-phone','tel','',true)+field('Email address','ci-email','email','',false)+'</div>'+field(store?'Store address':'Address','ci-address','text','',store)+(store?'<div class="gis-grid-2">'+field('Business registration number (optional)','ci-registration','text','',false)+field('Default payment term (days)','ci-credit-days','number','30',true)+'</div>':'')+'<button type="submit" class="addcust-btn-primary">Create '+(store?'Store':'User')+' Profile</button><button type="button" class="addcust-btn-cancel" onclick="openAddCustomerModal(\''+customerSource+'\')">Back</button></form>';
    if(store){document.getElementById('ci-credit-days').min='0';document.getElementById('ci-credit-days').max='365';document.getElementById('ci-credit-days').step='1';}
    document.getElementById('ci-customer-form').onsubmit=function(event){event.preventDefault();
      if(!val('ci-name') || !val('ci-phone') || (store && (!val('ci-contact') || !val('ci-address')))){alert('Please complete all required customer details.');return;}
      var days=store?Number(val('ci-credit-days')):0;
      if(!Number.isInteger(days)||days<0||days>365){alert('Payment terms must be between 0 and 365 days.');return;}
      var c={id:uid('CUS'),type:type,name:val('ci-name'),phone:val('ci-phone'),email:val('ci-email'),address:val('ci-address'),contactName:store?val('ci-contact'):'',registration:store?val('ci-registration'):'',creditDays:days,createdAt:new Date().toISOString()};
      var duplicate=customers().find(function(x){return x.name.toLowerCase()===c.name.toLowerCase() && x.phone.replace(/\D/g,'')===c.phone.replace(/\D/g,'');});
      if(duplicate){alert('This customer profile already exists. Select the saved customer.');return;}
      if(!commit({customers:state.customers.concat([c]),invoices:state.invoices}))return;
      refreshCustomers(customerSource==='invoice'?c.id:val('ci-customer'));
      if(customerSource==='sales')pickPos(c);
      closeAddCustomerModal();
    };document.getElementById('ci-name').focus();
  };
  function pickPos(c){
    document.getElementById('pos-walkin-avatar').textContent=c.name.split(/\s+/).slice(0,2).map(function(n){return n[0];}).join('').toUpperCase();
    document.getElementById('pos-walkin-name').textContent=c.name;
    document.getElementById('pos-walkin-phone').textContent=[c.phone||c.email,c.type==='store'?'Store · '+c.creditDays+' day credit terms':'User'].join(' · ');
    document.getElementById('pos-loyalty-row').style.display=c.type==='store'?'none':'';
  }
  function renderPosCustomers(){var chips=document.getElementById('pos-swipe-chips'),search=document.querySelector('#pos-cust-walkin-panel .pos-cust-search input'),q=search.value.trim().toLowerCase();chips.replaceChildren();customers().filter(function(c){return [c.name,c.phone,c.email,c.contactName].join(' ').toLowerCase().includes(q);}).forEach(function(c){var b=document.createElement('button');b.type='button';b.className='pos-swipe-chip ci-customer-chip';b.innerHTML='<div><div class="pos-swipe-chip-name">'+esc(c.name)+'</div><div class="pos-swipe-chip-sub">'+esc(c.type==='store'?'Store · '+c.phone:c.phone||c.email)+'</div></div>';b.onclick=function(){pickPos(c);};chips.appendChild(b);});if(!chips.children.length)chips.innerHTML='<p class="ci-muted">No matching customers. Create a customer profile above.</p>';}
  document.querySelector('#pos-cust-walkin-panel .pos-cust-search input').addEventListener('input',renderPosCustomers);
  renderPosCustomers();

  window.ciGenerate=function(){
    if(selectedInvoice){notify('This invoice is already saved. Open it in Credit Invoices or start a new invoice.');return selectedInvoice;}
    var c=customers().find(function(c){return c.id===val('ci-customer');});
    if(!c){alert('Select a customer or create a customer profile first.');return null;}
    var issued=val('gis-inv-date'),due=val('gis-due-date');
    if(!validDate(issued)||!validDate(due)||due<issued){alert('Enter valid invoice and due dates. The due date cannot be before the invoice date.');return null;}
    var items=Array.from(document.querySelectorAll('#gis-items-body .gis-item-row')).map(function(row){var desc=row.querySelector('.gis-desc-input');return {description:desc?desc.value.trim():'',quantity:Number(row.querySelector('.gis-qty').value),unitPrice:Number(row.querySelector('.gis-price').value)};});
    if(!items.length||items.some(function(i){return !i.description||!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isFinite(i.unitPrice)||i.unitPrice<=0||!Number.isFinite(i.quantity*i.unitPrice);})){alert('Add a description, a quantity above zero and a unit price above zero for every invoice item.');return null;}
    items.forEach(function(i){i.total=round(i.quantity*i.unitPrice);});
    var subtotal=round(items.reduce(function(sum,i){return sum+i.total;},0)),vat=round(subtotal*0.075);
    if(!Number.isSafeInteger(Math.round((subtotal+vat)*100))){alert('Invoice amount is too large. Please check the quantities and prices.');return null;}
    var i={id:uid('CR'),number:nextNumber(),customerId:c.id,customer:JSON.parse(JSON.stringify(c)),date:issued,dueDate:due,items:items,subtotal:subtotal,vat:vat,total:round(subtotal+vat),notes:val('ci-notes'),bank:{name:val('gis-bank-name'),accountNumber:val('gis-account-number'),accountName:val('gis-account-name')},createdAt:new Date().toISOString(),payments:[]};
    if(!commit({customers:state.customers,invoices:state.invoices.concat([i])}))return null;
    selectedInvoice=i;
    document.getElementById('gis-inv-number').value=i.number;
    // A saved invoice is immutable; subsequent output actions reuse the same record.
    invoiceView.querySelectorAll('.gis-main-col input,.gis-main-col select,.gis-main-col textarea,.gis-main-col button').forEach(function(el){el.disabled=true;});
    document.getElementById('ci-generate').disabled=true;
    document.getElementById('ci-saved-message').innerHTML='<strong>'+esc(i.number)+'</strong> saved as an unpaid credit order. Due '+date(i.dueDate)+'. <button type="button" class="ci-link" onclick="ciNewInvoice()">Start New Invoice</button>';
    notify('Credit invoice saved. Outstanding: '+money(i.total));renderRegister();return i;
  };
  window.ciNewInvoice=function(){selectedInvoice=null;invoiceView.querySelectorAll('.gis-main-col input,.gis-main-col select,.gis-main-col textarea,.gis-main-col button').forEach(function(el){el.disabled=false;});document.getElementById('ci-generate').disabled=false;document.getElementById('gis-inv-number').value=nextNumber();document.getElementById('gis-inv-date').value=today();document.getElementById('gis-due-date').value=today();['gis-bank-name','gis-account-number','gis-account-name','ci-notes'].forEach(function(id){document.getElementById(id).value='';});document.getElementById('ci-customer').value='';ciSelectCustomer();var body=document.getElementById('gis-items-body');body.innerHTML='';gisAddItem();document.getElementById('ci-saved-message').textContent='Generate once to save this credit order.';document.getElementById('gis-action-status').classList.remove('show');showView('generate-invoice');};

  var register=document.createElement('div');register.id='view-credit-invoices';register.className='view';
  var shell=document.createElement('div');shell.className='dash-shell';shell.appendChild(invoiceView.querySelector('.dash-sidebar').cloneNode(true));
  var main=document.createElement('div');main.className='dash-main';main.appendChild(invoiceView.querySelector('.dash-topbar').cloneNode(true));
  var content=document.createElement('div');content.className='ci-content';main.appendChild(content);shell.appendChild(main);register.appendChild(shell);document.body.appendChild(register);
  document.querySelectorAll('.dash-sidebar').forEach(function(sidebar){var nav=Array.from(sidebar.querySelectorAll('.subitem')).find(function(b){return b.textContent.trim()==='Generate Invoice';});if(nav){var b=document.createElement('button');b.type='button';b.className='subitem ci-nav';b.textContent='Credit Invoices';b.onclick=function(){ciOpenRegister();};nav.insertAdjacentElement('afterend',b);}});
  window.ciOpenRegister=function(){showView('credit-invoices');register.querySelectorAll('.subitem').forEach(function(b){b.classList.toggle('active',b.classList.contains('ci-nav'));});renderRegister();};
  var paymentOverlay=document.createElement('div');
  paymentOverlay.id='ci-payment-overlay';paymentOverlay.className='modal-overlay';
  paymentOverlay.setAttribute('role','dialog');paymentOverlay.setAttribute('aria-modal','true');paymentOverlay.setAttribute('aria-labelledby','ci-payment-title');
  paymentOverlay.onclick=function(event){if(event.target===paymentOverlay)ciClosePaymentModal();};
  document.body.appendChild(paymentOverlay);
  var paymentReturnFocus;
  window.ciOpenPaymentModal=function(){if(!document.getElementById('ci-payment-form'))return;paymentReturnFocus=document.activeElement;paymentOverlay.classList.add('open');paymentOverlay.querySelector('button').focus();};
  window.ciClosePaymentModal=function(){paymentOverlay.classList.remove('open');if(paymentReturnFocus&&paymentReturnFocus.isConnected)paymentReturnFocus.focus();};
  function kpi(label,value,index,highlight){
    var icon=document.querySelectorAll('#view-supplier-invoices .grl-kpi-icon')[index];
    return '<div class="grl-kpi-card '+(highlight?'highlight':'')+'">'+(icon?icon.outerHTML:'')+'<div class="grl-kpi-lbl">'+label+'</div><div class="grl-kpi-val">'+value+'</div></div>';
  }
  function renderRegister(){
    content.innerHTML='<div class="gra-hero ci-list-hero"><div><h1>Credit Invoices</h1><p class="gra-subtitle">Track customer credit orders and payments.</p></div><button type="button" class="grl-download-btn" onclick="showView(\'generate-invoice\')">+ Generate Invoice</button></div><div class="grl-kpi-grid">'+kpi('Total Invoices',state.invoices.length,0)+kpi('Outstanding Balance',money(state.invoices.reduce(function(sum,i){return sum+balance(i);},0)),1)+kpi('Overdue Balance',money(state.invoices.filter(overdue).reduce(function(sum,i){return sum+balance(i);},0)),2)+kpi('Total Payment Received',money(state.invoices.reduce(function(sum,i){return sum+paidAmount(i);},0)),3,true)+'</div><div class="sh-filters"><div class="sh-search-wrap"><svg viewBox="0 0 18 18" fill="none" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M13 13l4 4"/></svg><input class="sh-search-input" id="ci-search" aria-label="Search invoices" placeholder="Search by invoice or customer..." oninput="ciFilterInvoices()"></div><select class="sh-branch-select" id="ci-customer-filter" aria-label="Filter by customer" onchange="ciFilterInvoices()"><option value="">All Customers</option>'+Array.from(new Map(state.invoices.map(function(i){return [i.customerId,i.customer];})).entries()).map(function(entry){return '<option value="'+esc(entry[0])+'">'+esc(entry[1].name)+'</option>';}).join('')+'</select><select class="sh-branch-select" id="ci-status" aria-label="Filter by payment status" onchange="ciFilterInvoices()"><option value="">All Status</option><option>Unpaid</option><option>Partially Paid</option><option>Overdue</option><option>Paid</option></select><button type="button" class="grl-download-btn" onclick="ciDownloadReport()">Download Report</button></div><div class="sh-table-wrap"><div class="ci-table-wrap"><table class="grl-table"><thead><tr><th>Invoice Number</th><th>Date</th><th>Customer</th><th class="right">Amount</th><th class="right">Paid</th><th class="right">Balance Due</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody id="ci-invoice-rows"></tbody></table></div><div class="ci-register-footer" id="ci-register-count" role="status"></div></div>';
    ciFilterInvoices();
  }
  function filteredInvoices(){var q=val('ci-search').toLowerCase(),s=val('ci-status'),customer=val('ci-customer-filter');return state.invoices.slice().reverse().filter(function(i){return (!customer||i.customerId===customer)&&(!s||(s==='Overdue'?overdue(i):status(i)===s))&&(!q||[i.number,i.customer.name,i.customer.phone].join(' ').toLowerCase().includes(q));});}
  window.ciFilterInvoices=function(){
    var rows=filteredInvoices();
    document.getElementById('ci-invoice-rows').innerHTML=rows.length?rows.map(function(i){return '<tr><td><button type="button" class="ci-link grl-lpo-link" data-id="'+esc(i.id)+'" onclick="ciOpenInvoice(this.dataset.id)">'+esc(i.number)+'</button></td><td>'+date(i.date)+'</td><td>'+esc(i.customer.name)+'<small class="ci-table-sub">'+esc(i.customer.type==='store'?'Store':'User')+'</small></td><td class="right">'+money(i.total)+'</td><td class="right">'+money(paidAmount(i))+'</td><td class="right">'+money(balance(i))+'</td><td class="'+(overdue(i)?'ci-overdue-date':'')+'">'+date(i.dueDate)+'</td><td>'+badge(i)+'</td><td><button type="button" class="grl-action-btn view" aria-label="View '+esc(i.number)+'" title="View Invoice" data-id="'+esc(i.id)+'" onclick="ciOpenInvoice(this.dataset.id)"><svg viewBox="0 0 16 16" fill="none" stroke-width="1.4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2.2"/></svg></button></td></tr>';}).join(''):'<tr><td colspan="9" class="ci-empty">'+(state.invoices.length?'No invoices match these filters.':'No credit invoices yet. Generate an invoice to start tracking payment.')+'</td></tr>';
    document.getElementById('ci-register-count').textContent='Showing '+rows.length+' of '+state.invoices.length+' invoices';
  };
  window.ciDownloadReport=function(){
    var rows=[['Invoice','Date','Customer','Amount','Paid','Balance Due','Due Date','Status']].concat(filteredInvoices().map(function(i){return [i.number,i.date,i.customer.name,i.total,paidAmount(i),balance(i),i.dueDate,status(i)];}));
    var csv=rows.map(function(row){return row.map(function(value){var text=String(value);if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');
    var url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})),link=document.createElement('a');link.href=url;link.download='credit-invoices-'+today()+'.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
  };
  function invoiceMarkup(i){return '<div class="ci-heading"><div><h2>'+esc(i.number)+'</h2><p class="ci-muted">Credit Order · Issued '+date(i.date)+' · Due '+date(i.dueDate)+'</p></div>'+badge(i)+'</div><div class="gis-grid-2"><div><h3>Bill To</h3><p>'+esc(i.customer.name)+'<br>'+[i.customer.contactName,i.customer.phone,i.customer.email,i.customer.address].filter(Boolean).map(esc).join('<br>')+'</p></div><div><h3>Payment Account</h3><p>'+[i.bank.name,i.bank.accountName,i.bank.accountNumber].filter(Boolean).map(esc).join('<br>')+'</p></div></div><div class="ci-table-wrap"><table class="ci-table"><thead><tr><th>Description</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>'+i.items.map(function(it){return '<tr><td>'+esc(it.description)+'</td><td>'+it.quantity+'</td><td>'+money(it.unitPrice)+'</td><td>'+money(it.total)+'</td></tr>';}).join('')+'</tbody></table></div><div class="ci-summary"><p>Subtotal <strong>'+money(i.subtotal)+'</strong></p><p>VAT (7.5%) <strong>'+money(i.vat)+'</strong></p><p>Total <strong>'+money(i.total)+'</strong></p><p>Amount Paid <strong>'+money(paidAmount(i))+'</strong></p><p>Balance Due <strong>'+money(balance(i))+'</strong></p></div>'+(i.notes?'<h3>Credit Terms &amp; Notes</h3><p class="ci-notes">'+esc(i.notes)+'</p>':'')+paymentHistory(i);}
  function receiptFileError(file){
    if(file.size===0)return 'The receipt file is empty. Choose a PDF, JPG or PNG file.';
    if(file.size>5*1024*1024)return 'Receipt exceeds 5MB. Choose a smaller file.';
    if(!/\.(pdf|jpe?g|png)$/i.test(file.name)|| (file.type && !['application/pdf','image/jpeg','image/png'].includes(file.type)))return 'Only PDF, JPG and PNG receipts are supported.';
    return '';
  }
  function readReceipt(file){
    return new Promise(function(resolve,reject){
      var error=receiptFileError(file);if(error){reject(new Error(error));return;}
      var reader=new FileReader();reader.onerror=function(){reject(new Error('The receipt could not be read. Please choose the file again.'));};
      reader.onload=function(){
        var data=String(reader.result),encoded=data.slice(data.indexOf(',')+1),head=atob(encoded.slice(0,16)),ext=file.name.split('.').pop().toLowerCase();
        var pdf=head.slice(0,5)==='%PDF-',png=head.slice(0,8)==='\x89PNG\r\n\x1a\n',jpg=head.charCodeAt(0)===255&&head.charCodeAt(1)===216&&head.charCodeAt(2)===255;
        if(!((ext==='pdf'&&pdf)||(ext==='png'&&png)||(['jpg','jpeg'].includes(ext)&&jpg))){reject(new Error('The receipt content does not match a PDF, JPG or PNG file.'));return;}
        var type=pdf?'application/pdf':png?'image/png':'image/jpeg';
        resolve({name:file.name,type:type,size:file.size,data:'data:'+type+';base64,'+encoded});
      };reader.readAsDataURL(file);
    });
  }
  window.ciDownloadReceipt=function(invoiceId,index){
    var invoice=state.invoices.find(function(i){return i.id===invoiceId;}),payment=invoice&&payments(invoice)[Number(index)],receipt=payment&&payment.receipt;
    if(!receipt||!/^data:(application\/pdf|image\/jpeg|image\/png);base64,[A-Za-z0-9+/=]+$/.test(receipt.data)){alert('This payment has no downloadable receipt.');return;}
    try {
      var raw=atob(receipt.data.split(',')[1]),bytes=Uint8Array.from(raw,function(c){return c.charCodeAt(0);});
      var type=receipt.data.slice(5,receipt.data.indexOf(';')),url=URL.createObjectURL(new Blob([bytes],{type:type})),link=document.createElement('a');
      link.href=url;link.download=receipt.name;document.body.appendChild(link);link.click();link.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
    } catch(error){alert('The saved receipt could not be downloaded.');}
  };
  function paymentHistory(i) {
    var entries=payments(i);
    if(!entries.length)return '';
    return '<h3>Payment History</h3><div class="ci-table-wrap"><table class="gra-table grav-table"><thead><tr><th>Payment Date</th><th>Amount</th><th>Method</th><th>Reference / Notes</th><th>Recorded By</th><th>Receipt</th></tr></thead><tbody>'+entries.map(function(p,index){return '<tr><td>'+date(p.date)+'</td><td>'+money(p.amount)+'</td><td>'+esc(p.method)+'</td><td>'+esc(p.reference||'—')+(p.notes?'<small class="ci-notes">'+esc(p.notes)+'</small>':'')+'</td><td>'+esc(p.recordedBy)+'<small>'+esc(new Date(p.recordedAt).toLocaleString('en-NG'))+'</small></td><td>'+(p.receipt?'<button type="button" class="ci-link ci-receipt-action" data-id="'+esc(i.id)+'" data-index="'+index+'" onclick="ciDownloadReceipt(this.dataset.id,this.dataset.index)">Download Receipt</button><small>'+esc(p.receipt.name)+'</small>':'—')+'</td></tr>';}).join('')+'</tbody></table></div>';
  }
  function detailRow(label,value){return '<div class="grav-row"><span>'+label+'</span><span class="v">'+value+'</span></div>';}
  function invoiceDetail(i){
    var initials=i.customer.name.split(/\s+/).slice(0,2).map(function(n){return n[0]||'';}).join('').toUpperCase();
    var progress=Math.min(100,Math.round(paidAmount(i)/i.total*100));
    var entries=payments(i);
    return '<div class="gra-hero"><div><div class="gra-title-row"><h1>'+esc(i.number)+'</h1>'+badge(i)+'</div><p class="gra-subtitle">'+esc(i.customer.name)+' · Issued '+date(i.date)+' · Due '+date(i.dueDate)+'</p></div><div class="ci-detail-actions"><button type="button" class="grav-btn-outline" onclick="ciOpenRegister()">Back</button><button type="button" class="grav-btn-outline" data-id="'+esc(i.id)+'" onclick="ciPrintInvoice(this.dataset.id)">Print / Save PDF</button>'+(balance(i)>0&&canRecordPayment()?'<button type="button" class="grav-btn-primary" onclick="ciOpenPaymentModal()">'+(paidAmount(i)>0?'Record Payment':'Mark as Paid')+'</button>':'')+'</div></div><div class="grav-grid ci-document"><div class="ci-detail-main"><div class="grav-card"><div class="ci-heading"><div><div class="ci-eyebrow">Invoice</div><h2>'+esc(i.number)+'</h2></div><div class="grav-supplier-avatar">'+esc(initials)+'</div></div><div class="grav-field-grid"><div>'+detailRow('Issue Date',date(i.date))+detailRow('Due Date',date(i.dueDate))+detailRow('Order Type','Credit Order')+'</div><div><strong>'+esc(i.customer.name)+'</strong><div class="ci-contact-details">'+[i.customer.contactName,i.customer.phone,i.customer.email,i.customer.address].filter(Boolean).map(esc).join('<br>')+'</div></div></div></div><div class="grav-card"><h3>Invoice Items</h3><div class="ci-table-wrap"><table class="gra-table grav-table"><thead><tr><th>#</th><th>Description</th><th class="right">Qty</th><th class="right">Unit Price</th><th class="right">Total</th></tr></thead><tbody>'+i.items.map(function(it,index){return '<tr><td>'+(index+1)+'</td><td>'+esc(it.description)+'</td><td class="right">'+it.quantity+'</td><td class="right">'+money(it.unitPrice)+'</td><td class="right">'+money(it.total)+'</td></tr>';}).join('')+'</tbody></table></div><div class="ri-totals" style="margin-top:20px">'+[['Subtotal',i.subtotal],['VAT (7.5%)',i.vat],['Invoice Total',i.total],['Amount Paid',paidAmount(i)],['Balance Due',balance(i)]].map(function(row,index){return '<div class="ri-totals-row '+(index===2?'total':'')+'"><span class="lbl">'+row[0]+'</span><span class="val">'+money(row[1])+'</span></div>';}).join('')+'</div></div><div class="grav-card">'+(entries.length?paymentHistory(i):'<h3>Payment History</h3><div class="inv-empty-txt">No payments recorded for this invoice yet.</div>')+'</div><div class="grav-card"><h3>Credit Terms &amp; Notes</h3>'+(i.notes?'<div class="grav-notes-box"><p class="ci-notes">'+esc(i.notes)+'</p></div>':'<div class="inv-empty-txt">No additional credit terms or notes.</div>')+'</div></div><div class="ci-detail-side"><div class="grav-card"><h3>Payment Summary</h3>'+detailRow('Invoice Total',money(i.total))+detailRow('Amount Paid',money(paidAmount(i)))+detailRow('Balance Due',money(balance(i)))+detailRow('Due Date',date(i.dueDate))+detailRow('Status',badge(i))+'<div class="inv-progress-track" role="progressbar" aria-label="Payment progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+progress+'"><div class="inv-progress-fill" style="width:'+progress+'%"></div></div><div class="inv-progress-caption">Payment Progress · '+money(paidAmount(i))+' of '+money(i.total)+' paid</div></div><div class="grav-card"><h3>Receiving Account</h3><div class="inv-sub">Account details included on this credit invoice</div>'+detailRow('Bank Name',esc(i.bank.name||'—'))+detailRow('Account Name',esc(i.bank.accountName||'—'))+detailRow('Account Number',esc(i.bank.accountNumber||'—'))+'<div class="inv-ref-lbl">Payment Reference</div><div class="inv-ref-box"><span>'+esc(i.number)+'</span></div></div><div class="grav-card"><h3>Activity</h3><div class="inv-activity"><div class="inv-activity-item"><div class="inv-activity-txt">Credit invoice generated</div><div class="inv-activity-meta">'+esc(new Date(i.createdAt).toLocaleString('en-NG'))+'</div></div>'+entries.map(function(p){return '<div class="inv-activity-item done"><div class="inv-activity-txt">Payment of '+money(p.amount)+' recorded</div><div class="inv-activity-meta">'+esc(p.recordedBy)+' · '+date(p.date)+'</div></div>';}).join('')+'</div></div></div></div>';
  }
  window.ciOpenInvoice=function(id){
    var i=state.invoices.find(function(i){return i.id===id;});
    if(!i)return;
    showView('credit-invoices');
    content.innerHTML=invoiceDetail(i);
    paymentOverlay.classList.remove('open');
    paymentOverlay.innerHTML=balance(i)===0?'':'<div class="recpay-modal"><div class="recpay-head"><div><h2 id="ci-payment-title">Record Payment</h2><p>'+esc(i.number)+' · '+esc(i.customer.name)+'</p></div><button type="button" class="recpay-close" aria-label="Close payment dialog" onclick="ciClosePaymentModal()">×</button></div><div class="recpay-body"><div class="recpay-sum-grid"><div class="recpay-sum-card total"><div class="recpay-sum-lbl">Invoice Total</div><div class="recpay-sum-val">'+money(i.total)+'</div></div><div class="recpay-sum-card balance"><div class="recpay-sum-lbl">Balance Due</div><div class="recpay-sum-val">'+money(balance(i))+'</div></div></div><form id="ci-payment-form"><div class="np-field"><label class="recpay-lbl" for="ci-payment-type">Payment Type *</label><select class="np-select" id="ci-payment-type" required><option value="full">Full payment (remaining balance)</option><option value="half" '+(balance(i)<0.02?'disabled':'')+'>Half payment (50% of remaining balance)</option><option value="partial">Partial payment (enter amount)</option></select></div>'+field('Amount received (₦)','ci-paid-amount','number',balance(i).toFixed(2),true)+'<p id="ci-payment-preview" class="ci-muted" role="status"></p><div class="recpay-row2">'+field('Payment date','ci-paid-date','date',today(),true)+'<div class="gis-field"><label for="ci-paid-method">Payment method *</label><select id="ci-paid-method" required><option value="">Select method</option><option>Bank Transfer</option><option>Cash</option><option>POS / Card</option><option>Other</option></select></div></div>'+field('Payment reference / receipt','ci-paid-reference','text','',false)+'<div class="np-field"><label class="recpay-lbl" for="ci-payment-proof">Upload Payment Proof</label><label class="bulkup-dropzone" for="ci-payment-proof"><svg viewBox="0 0 20 25" fill="none" stroke-width="1.3"><path d="M10 1v18M4 8l6-7 6 7"/><path d="M1 21h18v3H1z"/></svg><span class="txt">Attach transfer receipt, bank debit alert, or remittance advice</span><span class="hint">PDF, JPG, PNG · Max 5MB · Optional</span><input type="file" id="ci-payment-proof" accept=".pdf,.jpg,.jpeg,.png" class="bulkup-file-input" aria-describedby="ci-proof-status"></label><div id="ci-proof-status" class="ci-proof-status" role="status">No receipt attached.</div><button type="button" class="ci-link" id="ci-remove-proof" hidden>Remove attachment</button></div><div class="np-field"><label class="recpay-lbl" for="ci-payment-notes">Notes</label><textarea id="ci-payment-notes" class="np-textarea" placeholder="Any additional payment notes..."></textarea></div><p class="ci-check"><label><input id="ci-confirm-paid" type="checkbox" required> I confirm the amount entered has been received.</label></p><div class="acceptord-actions ci-payment-actions"><button type="button" class="acceptord-btn-cancel" onclick="ciClosePaymentModal()">Cancel</button><button type="submit" id="ci-record-payment" class="acceptord-btn-confirm">Record Full Payment</button></div></form></div></div>';
    if(balance(i)===0)return;
    if(!canRecordPayment()){document.getElementById('ci-payment-form').innerHTML='<p class="ci-muted">Only the business owner or an admin can record payment.</p>';return;}
    paymentOverlay.querySelectorAll('.gis-field').forEach(function(el){el.className='np-field';});
    paymentOverlay.querySelectorAll('label:not(.ci-check label):not(.bulkup-dropzone)').forEach(function(el){el.classList.add('recpay-lbl');});
    paymentOverlay.querySelectorAll('input:not([type="checkbox"]):not([type="file"])').forEach(function(el){el.classList.add('np-input');});
    paymentOverlay.querySelectorAll('select').forEach(function(el){el.classList.add('np-select');});
    var proofInput=document.getElementById('ci-payment-proof'),proofStatus=document.getElementById('ci-proof-status'),removeProof=document.getElementById('ci-remove-proof');
    proofInput.onchange=function(){
      var file=proofInput.files[0],error=file?receiptFileError(file):'';
      proofStatus.textContent=file?(error||file.name+' · '+(file.size/1024).toFixed(1)+' KB'):'No receipt attached.';
      proofStatus.classList.toggle('error',!!error);removeProof.hidden=!file;
    };
    removeProof.onclick=function(){proofInput.value='';proofInput.onchange();};
    var typeSelect=document.getElementById('ci-payment-type');
    typeSelect.hidden=true;
    var segments=document.createElement('div');segments.className='recpay-seg';
    ['full','half','partial'].forEach(function(kind,index){var button=document.createElement('button');button.type='button';button.className='recpay-seg-btn'+(kind==='full'?' active':'');button.textContent=['Full Payment','Half Payment','Partial Payment'][index];button.dataset.type=kind;button.disabled=kind==='half'&&balance(i)<0.02;button.setAttribute('aria-pressed',String(kind==='full'));button.onclick=function(){typeSelect.value=kind;typeSelect.onchange();};segments.appendChild(button);});
    typeSelect.insertAdjacentElement('afterend',segments);
    var amountInput=document.getElementById('ci-paid-amount'),typeInput=document.getElementById('ci-payment-type');
    amountInput.min='0.01';amountInput.max=balance(i).toFixed(2);amountInput.step='0.01';
    function updatePaymentPreview(reset){
      var kind=typeInput.value;
      paymentOverlay.querySelectorAll('.recpay-seg-btn').forEach(function(button){button.classList.toggle('active',button.dataset.type===kind);button.setAttribute('aria-pressed',String(button.dataset.type===kind));});
      amountInput.readOnly=kind!=='partial';
      amountInput.classList.toggle('readonly',amountInput.readOnly);
      if(kind==='full')amountInput.value=balance(i).toFixed(2);
      else if(kind==='half')amountInput.value=(Math.floor(Math.round(balance(i)*100)/2)/100).toFixed(2);
      else if(reset)amountInput.value='';
      var amount=Number(amountInput.value);
      document.getElementById('ci-payment-preview').textContent=Number.isFinite(amount)&&amount>0&&amount<=balance(i)?'Balance after this payment: '+money(round(balance(i)-amount)):'Enter an amount above zero, up to '+money(balance(i))+'.';
      document.getElementById('ci-record-payment').textContent=kind==='full'?'Record Full Payment':kind==='half'?'Record Half Payment':'Record Partial Payment';
      document.getElementById('ci-confirm-paid').checked=false;
    }
    typeInput.onchange=function(){updatePaymentPreview(true);};
    amountInput.oninput=function(){updatePaymentPreview(false);};
    updatePaymentPreview(false);
    document.getElementById('ci-paid-date').min=i.date;
    document.getElementById('ci-paid-date').max=today();
    var paymentSaving=false;
    document.getElementById('ci-payment-form').onsubmit=async function(event){
      event.preventDefault();
      if(paymentSaving)return;
      if(!canRecordPayment()){alert('Only the business owner or an admin can record payment.');return;}
      var current=state.invoices.find(function(x){return x.id===id;});
      if(!current||balance(current)===0)return;
      var paidDate=val('ci-paid-date'),method=val('ci-paid-method'),kind=typeInput.value,amount=Number(amountInput.value),remaining=balance(current);
      if(!validDate(paidDate)||paidDate<current.date||paidDate>today()||!method||!document.getElementById('ci-confirm-paid').checked){alert('Confirm receipt and enter a valid payment date and method.');return;}
      var amountInKobo=amount*100;
      if(!['full','half','partial'].includes(kind)||!Number.isFinite(amount)||amount<0.01||amount>remaining||Math.abs(amountInKobo-Math.round(amountInKobo))>0.000001){alert('Enter an amount above zero, no more than the outstanding balance, with at most two decimal places.');return;}
      amount=round(amount);
      if((kind==='full'&&amount!==remaining)||(kind==='half'&&amount!==Math.floor(Math.round(remaining*100)/2)/100)){alert('The amount does not match the selected payment type. Please select the payment type again.');return;}
      var file=proofInput.files[0],reference=val('ci-paid-reference'),notes=val('ci-payment-notes');
      var actor=invoiceView.querySelector('.dash-user-name');
      var recordedBy=actor?actor.textContent.trim():'Admin';
      var submit=document.getElementById('ci-record-payment'),originalLabel=submit.textContent;
      paymentSaving=true;submit.disabled=true;submit.textContent='Saving Payment…';
      try {
        var receipt=file?await readReceipt(file):null;
        if(!submit.isConnected||state.invoices.find(function(x){return x.id===id;})!==current)throw new Error('The invoice changed while reading the receipt. Reopen it before recording payment.');
        if(!canRecordPayment())throw new Error('Only the business owner or an admin can record payment.');
        var payment={id:uid('PAY'),type:kind,date:paidDate,method:method,reference:reference,amount:amount,notes:notes,receipt:receipt,recordedAt:new Date().toISOString(),recordedBy:recordedBy};
        var updated=Object.assign({},current,{payments:payments(current).concat([payment])});
        delete updated.payment;
        if(commit({customers:state.customers,invoices:state.invoices.map(function(x){return x.id===id?updated:x;})})){if(selectedInvoice&&selectedInvoice.id===id)selectedInvoice=updated;ciOpenInvoice(id);}
      } catch(error) {
        proofStatus.textContent=error.message||'The receipt could not be read. Please choose the file again.';
        proofStatus.classList.add('error');
      } finally {paymentSaving=false;submit.disabled=false;submit.textContent=originalLabel;}
    };
  };
  window.ciPrintInvoice=function(id){var i=state.invoices.find(function(i){return i.id===id;});if(!i)return;var print=document.getElementById('ci-print');if(!print){print=document.createElement('div');print.id='ci-print';document.body.appendChild(print);}print.innerHTML='<h1>Hawkeye Foods</h1>'+invoiceMarkup(i);window.print();};
  window.gisAction=function(type){var i=selectedInvoice||ciGenerate();if(!i)return;if(type==='pdf'||type==='print'){ciPrintInvoice(i.id);return;}if(type==='whatsapp'){var message='Invoice '+i.number+' — Hawkeye Foods\nBill to: '+i.customer.name+'\nIssued: '+date(i.date)+'\nPayment due: '+date(i.dueDate)+'\n\n'+i.items.map(function(x){return x.description+' × '+x.quantity+' — '+money(x.total);}).join('\n')+'\n\nSubtotal: '+money(i.subtotal)+'\nVAT (7.5%): '+money(i.vat)+'\nTotal: '+money(i.total)+'\nAmount paid: '+money(paidAmount(i))+'\nBalance due: '+money(balance(i))+'\n\n'+[i.bank.name,i.bank.accountName,i.bank.accountNumber,i.notes].filter(Boolean).join('\n');window.open('https://wa.me/?text='+encodeURIComponent(message),'_blank','noopener,noreferrer');notify('Continue in WhatsApp to choose the recipient and send the invoice details.');return;}if(type==='email'){if(!i.customer.email){notify('No email address is saved for this customer. Print or save the invoice as PDF to share.');return;}var body='Dear '+i.customer.name+',\n\nInvoice '+i.number+'\nInvoice date: '+date(i.date)+'\nPayment due: '+date(i.dueDate)+'\n\n'+i.items.map(function(x){return x.description+' × '+x.quantity+' — '+money(x.total);}).join('\n')+'\n\nSubtotal: '+money(i.subtotal)+'\nVAT: '+money(i.vat)+'\nTotal: '+money(i.total)+'\n\n'+[i.bank.name,i.bank.accountName,i.bank.accountNumber,i.notes].filter(Boolean).join('\n');window.location.href='mailto:'+encodeURIComponent(i.customer.email)+'?subject='+encodeURIComponent('Invoice '+i.number)+'&body='+encodeURIComponent(body);notify('Email draft opened in your mail app. Attach a saved PDF if needed.');}};
  document.addEventListener('keydown',function(event){
    if(!paymentOverlay.classList.contains('open'))return;
    if(event.key==='Escape'){ciClosePaymentModal();return;}
    if(event.key!=='Tab')return;
    var controls=Array.from(paymentOverlay.querySelectorAll('button,input,select,textarea')).filter(function(el){return !el.disabled&&!el.hidden;});
    var first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  });
  document.addEventListener('keydown',function(event){if(!overlay.classList.contains('open'))return;if(event.key==='Escape')closeAddCustomerModal();if(event.key==='Tab'){var list=Array.from(modal.querySelectorAll('button,input,select,textarea')).filter(function(el){return !el.disabled;});var first=list[0],last=list[list.length-1];if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}});
  if(storageError)notify(storageError);
})();

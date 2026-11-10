(function () {
  'use strict';
  var base = document.getElementById('view-suppliers');
  if (!base || !window.lpoData) return;
  var ledgerKey = 'crop-procurement-ledger-v1';
  var ledger = { orders: {}, invoices: {}, costs: {} }, storageError = '';
  try {
    var saved = localStorage.getItem(ledgerKey);
    if (saved) {
      var parsed = JSON.parse(saved);
      if (!parsed.orders || !parsed.invoices || !parsed.costs) throw new Error('Invalid procurement ledger');
      ledger = parsed;
    }
  } catch (error) { storageError = 'Procurement history could not be loaded. Existing records are still available below; new history cannot be saved until storage is restored.'; }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function round(v) { return Math.round((Number(v) + Number.EPSILON) * 100) / 100; }
  function amount(v) { return Number(String(v || '').replace(/[^\d.-]/g, '')) || 0; }
  function money(v) { return '₦' + Number(v || 0).toLocaleString('en-NG', {minimumFractionDigits:2, maximumFractionDigits:2}); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
  function day(v) {
    if (!v || v === '—') return '';
    if (v === 'Today') return today();
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10);
    var d = new Date(v); return isNaN(d.getTime()) ? '' : d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function date(v) { return v ? new Date(day(v) + 'T12:00:00').toLocaleDateString('en-NG', {day:'numeric',month:'short',year:'numeric'}) : 'Not recorded'; }
  function ref(v) { return String(v || '').trim().replace(/^LPO-/, 'PO-'); }
  function persist() {
    if (storageError) return false;
    try { if(localStorage.getItem(ledgerKey)!==saved){storageError='Procurement records changed in another tab. Reload before saving new history.';return false;}var serialized=JSON.stringify(ledger);localStorage.setItem(ledgerKey, serialized);saved=serialized;return true; }
    catch (error) { storageError = 'Browser storage is unavailable or full. New procurement history has not been saved. Keep this page open until storage is restored.'; return false; }
  }
  function source() { return window.getSupplierProcurementSnapshot ? window.getSupplierProcurementSnapshot() : {invoices:[],returns:[],receivedPurchaseOrders:{}}; }
  function poRow(id) { return Array.from(document.querySelectorAll('#lpo-list-tbody tr')).find(function (r) { return r.querySelector('.grl-lpo-link') && r.querySelector('.grl-lpo-link').textContent.trim() === id; }); }
  function orderInfo(id, data) {
    var row = poRow(id), old = ledger.orders[id];
    return {id:id, supplier:data.supplier, branch:data.branch || '', date:row ? day(row.cells[1].textContent.trim()) : (old && old.date || day(data.date)), status:row ? row.cells[6].querySelector('.grl-status-pill').textContent.trim() : (old && old.status || 'Pending (Sent)'), expected:row ? row.cells[5].textContent.trim() : '', items:clone(data.items || []), notes:data.notes || ''};
  }
  function linesForRef(reference) {
    var id = ref(reference), po = window.lpoData[id];
    if (po) return clone(po.items || []);
    var entry = window.lpoInvoiceData && (window.lpoInvoiceData[reference] || window.lpoInvoiceData[id] || window.lpoInvoiceData[id.replace(/^PO-/, 'LPO-')]);
    return entry ? entry.items.map(function (it) { return {name:it.name,qtyPurchased:it.qty,unitCost:it.cost,unit:it.unit || 'units'}; }) : [];
  }
  var staticInvoices = {};
  Array.from(document.querySelectorAll('#si-table-tbody tr:not(.sret-invoice-row)')).forEach(function (row) {
    if (row.cells.length < 8) return;
    var i = {id:row.cells[0].textContent.trim(), date:day(row.cells[1].textContent.trim()), supplier:row.cells[2].textContent.trim(), po:ref(row.cells[3].textContent.trim()), total:amount(row.cells[4].textContent), paid:amount(row.cells[5].textContent), dueDate:day(row.cells[6].textContent.trim()), items:linesForRef(row.cells[3].textContent.trim())};
    staticInvoices[i.id] = i;
  });
  // Restore purchase orders created through this session's existing LPO form.
  Object.keys(ledger.orders).forEach(function (id) {
    var saved = ledger.orders[id];
    if (window.lpoData[id]) return;
    window.lpoData[id] = {supplier:saved.supplier,branch:saved.branch,items:clone(saved.items),notes:saved.notes};
    var row = document.createElement('tr');
    row.innerHTML = '<td><span class="grl-lpo-link">'+esc(id)+'</span></td><td>'+date(saved.date)+'</td><td>'+esc(saved.supplier)+'</td><td>'+esc(saved.branch)+'</td><td>'+saved.items.length+' items</td><td>'+esc(saved.expected || '—')+'</td><td><span class="grl-status-pill '+(saved.status==='Confirmed'?'matched':saved.status==='Cancelled'?'discrepancy':'pending')+'">'+esc(saved.status)+'</span></td><td><button type="button" class="pov-link" data-id="'+esc(id)+'" onclick="openLpoDetails(this.dataset.id)">View LPO</button></td>';
    document.getElementById('lpo-list-tbody').prepend(row);
  });
  function allInvoices() {
    var merged = Object.assign({}, staticInvoices, ledger.invoices);
    source().invoices.forEach(function (i) { merged[i.id] = Object.assign({}, merged[i.id] || {}, i, {po:ref(i.po),date:merged[i.id]&&merged[i.id].date||day(i.date),dueDate:day(i.dueDate),items:(merged[i.id] && merged[i.id].items) || linesForRef(i.po)}); });
    return Object.values(merged);
  }
  function buildRecords() {
    var src = source(), invoices = allInvoices(), groups = new Map();
    Object.keys(window.lpoData).forEach(function (id) {
      var po = orderInfo(id, window.lpoData[id]);
      groups.set(ref(id), {id:id,po:id,supplier:po.supplier,branch:po.branch,date:po.date,status:po.status,items:po.items,notes:po.notes,invoices:[],returns:[],received:!!src.receivedPurchaseOrders[id]});
    });
    invoices.forEach(function (i) {
      var key = i.po && i.po !== '—' ? ref(i.po) : 'invoice:'+i.id;
      if (!groups.has(key)) groups.set(key, {id:i.po && i.po!=='—'?i.po:i.id,po:'',supplier:i.supplier,branch:i.branch || '',date:day(i.date),status:'Invoiced',items:i.items || [],notes:i.notes || '',invoices:[],returns:[],received:false});
      groups.get(key).invoices.push(i);
    });
    src.returns.forEach(function (r) { var record = groups.get(ref(r.po)); if (record) record.returns.push(r); });
    var graSource=window.getGraProcurementSnapshot?window.getGraProcurementSnapshot():{gras:[],expenses:[]};
    graSource.gras.forEach(function(g){var key=ref(g.po);if(!groups.has(key))groups.set(key,{id:key,po:window.lpoData[key]?key:'',supplier:g.supplier,branch:g.branch||'',date:g.date,status:'Received',items:g.items||[],notes:'',invoices:[],returns:[],received:true});});
    return Array.from(groups.values()).map(function (r) {
      r.gras=graSource.gras.filter(function(g){return ref(g.po)===ref(r.id);});
      var graIds=new Set(r.gras.map(function(g){return g.id;}));
      r.expenses=graSource.expenses.filter(function(e){return graIds.has(e.gra);});
      r.expenseTotal=round(r.expenses.reduce(function(sum,e){return sum+e.amount;},0));
      r.receivedValue=round(r.gras.reduce(function(sum,g){return sum+Number(g.receivedValue||0);},0));
      r.graCount=r.gras.length;
      r.received=r.received||r.gras.length>0;
      var isCancelled = r.status === 'Cancelled';
      r.committed = !isCancelled && (r.received || r.status === 'Confirmed' || r.invoices.length > 0);
      r.gross = round(!r.po&&r.gras.length ? r.receivedValue : r.invoices.length ? r.invoices.reduce(function (s,i) { return s + Number(i.total || 0); },0) : r.items.reduce(function (s,it) { return s + Number(it.qtyPurchased || 0) * Number(it.unitCost || 0); },0));
      r.returned = round(r.returns.filter(function (ret) { return ret.status === 'Dispatched'; }).reduce(function (s,ret) { return s + Number(ret.total || 0); },0));
      r.net = round(Math.max(0, r.gross - r.returned));
      r.paid = round(r.invoices.reduce(function (s,i) { return s + Number(i.paid || 0); },0));
      var credit = r.returned;
      r.due = 0; r.overdue = 0; r.supplierCredit = 0;
      r.invoices.forEach(function (i) {
        var applied = Math.min(credit, Number(i.total || 0)); credit = round(Math.max(0, credit - applied));
        var revised = round(Number(i.total || 0) - applied), balance = round(Math.max(0, revised - Number(i.paid || 0)));
        r.due += balance;
        r.supplierCredit += Math.max(0, Number(i.paid || 0) - revised);
        if (day(i.dueDate) && day(i.dueDate) < today()) r.overdue += balance;
      });
      r.due=round(r.due); r.overdue=round(r.overdue); r.supplierCredit=round(r.supplierCredit+credit);
      r.paymentStatus = isCancelled ? 'Cancelled' : !r.invoices.length ? 'Awaiting Invoice' : r.due===0 ? 'Paid' : r.paid>0 ? 'Partially Paid' : 'Unpaid';
      r.dueDate = r.invoices.map(function(i){return day(i.dueDate);}).filter(Boolean).sort()[0] || '';
      r.items = r.invoices.some(function(i){return i.items && i.items.length;}) ? r.invoices.flatMap(function(i){return i.items || [];}) : r.items;
      return r;
    });
  }
  function costKey(it) { return (it.sku || it.name.trim().toLowerCase()) + '|' + (it.unit || 'units').trim().toLowerCase(); }
  function snapshotCosts() {
    var changed = false, src=source();
    Object.keys(window.lpoData).forEach(function (id) {
      var po=orderInfo(id,window.lpoData[id]);
      if (po.status!=='Confirmed' && !src.receivedPurchaseOrders[id]) return;
      if (po.status==='Cancelled') return;
      po.items.forEach(function(it,index) { var key='po:'+id+':'+index; if (!ledger.costs[key] && Number(it.unitCost)>0 && po.date) {ledger.costs[key]={id:key,po:id,document:id,date:po.date,supplier:po.supplier,branch:po.branch,product:it.name,key:costKey(it),unit:it.unit || 'units',quantity:Number(it.qtyPurchased)||1,cost:Number(it.unitCost)};changed=true;} });
    });
    allInvoices().forEach(function(i) { (i.items || []).forEach(function(it,index) {var key='invoice:'+i.id+':'+index;if(!ledger.costs[key] && Number(it.unitCost)>0 && day(i.date)){ledger.costs[key]={id:key,po:ref(i.po),document:i.id,date:day(i.date),recordedAt:i.recordedAt||i.createdAt||'',supplier:i.supplier,branch:i.branch || (window.lpoData[ref(i.po)] || {}).branch || '',product:it.name,key:costKey(it),unit:it.unit || 'units',quantity:Number(it.qtyPurchased)||1,cost:Number(it.unitCost)};changed=true;} }); });
    var graData=window.getGraProcurementSnapshot?window.getGraProcurementSnapshot():{gras:[]};
    graData.gras.forEach(function(g){(g.items||[]).forEach(function(it,index){var key='gra:'+g.id+':'+index;if(!ledger.costs[key]&&Number(it.unitCost)>0&&g.date){ledger.costs[key]={id:key,po:ref(g.po),document:g.id,date:g.date,recordedAt:g.recordedAt||'',supplier:g.supplier,branch:g.branch||'',product:it.name,key:costKey(it),unit:it.unit||'units',quantity:Number(it.qtyPurchased)||1,cost:Number(it.unitCost)};changed=true;}});});
    if (changed) persist();
  }
  var view=document.createElement('div'); view.id='view-procurement-overview'; view.className='view';
  var shell=document.createElement('div'); shell.className='dash-shell'; shell.appendChild(base.querySelector('.dash-sidebar').cloneNode(true));
  var main=document.createElement('div'); main.className='dash-main'; main.appendChild(base.querySelector('.dash-topbar').cloneNode(true));
  var host=document.createElement('div'); host.className='pov-content'; main.appendChild(host); shell.appendChild(main); view.appendChild(shell); document.body.appendChild(view);
  document.querySelectorAll('.dash-sidebar').forEach(function(sidebar) {
    var supplier=Array.from(sidebar.querySelectorAll('.subitem')).find(function(b){return b.textContent.trim()==='Suppliers';});
    if(supplier){var nav=document.createElement('button');nav.className='subitem pov-nav';nav.type='button';nav.textContent='Overview';nav.onclick=function(){openProcurementOverview();};supplier.insertAdjacentElement('beforebegin',nav);}
    sidebar.querySelectorAll('.item').forEach(function(b){if(b.getAttribute('onclick')==="showView('suppliers')")b.setAttribute('onclick',"openProcurementOverview()");});
  });
  var filters={search:'',supplier:'',branch:'',status:'',payment:'',from:'',to:'',sort:'newest'}, page=1, pageSize=8, selectedProduct='', costSearch='', costPage=1, costPageSize=5, costDataMode='demo';
  function filtered(records,ignoreDates) {
    return records.filter(function(r){return (!filters.supplier||r.supplier===filters.supplier)&&(!filters.branch||r.branch===filters.branch)&&(!filters.status||r.status===filters.status)&&(!filters.payment||(filters.payment==='Overdue'?r.overdue>0:r.paymentStatus===filters.payment))&&(ignoreDates||!filters.from||(r.date&&r.date>=filters.from))&&(ignoreDates||!filters.to||(r.date&&r.date<=filters.to))&&(!filters.search||[r.id,r.supplier,r.branch].concat(r.items.map(function(i){return i.name;})).join(' ').toLowerCase().includes(filters.search.toLowerCase()));});
  }
  function totals(records) {
    var purchases=records.filter(function(r){return r.committed;});
    function sum(key,list){return round((list || purchases).reduce(function(s,r){return s+r[key];},0));}
    return {received:sum('receivedValue'),expenses:sum('expenseTotal'),graCount:sum('graCount'),purchased:sum('gross'),paid:sum('paid'),owed:sum('due'),returned:sum('returned'),net:sum('net'),overdue:sum('overdue'),supplierCredit:sum('supplierCredit'),awaitingInvoice:sum('net',purchases.filter(function(r){return !r.invoices.length;})),pending:records.filter(function(r){return !r.committed&&r.status!=='Cancelled';}).length,unpriced:purchases.filter(function(r){return !r.invoices.length&&r.items.some(function(it){return !(Number(it.unitCost)>0);});}).length,suppliers:new Set(purchases.map(function(r){return r.supplier;})).size};
  }
  function options(values,first,selected){return '<option value="">'+first+'</option>'+Array.from(new Set(values.filter(Boolean))).sort().map(function(v){return '<option '+(v===selected?'selected':'')+' value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');}
  function icon(index){var el=document.querySelectorAll('#view-supplier-invoices .grl-kpi-icon')[index];return el?el.outerHTML:'';}
  function kpi(label,value,note,index,highlight){return '<div class="grl-kpi-card '+(highlight?'highlight':'')+'">'+icon(index)+'<div class="grl-kpi-lbl">'+label+'</div><div class="grl-kpi-val">'+value+'</div><p class="pov-kpi-note">'+note+'</p></div>';}
  function pill(label){var cls=label==='Paid'||label==='Confirmed'?'matched':label==='Cancelled'||label==='Overdue'?'discrepancy':label==='Partially Paid'?'partial':'pending';return '<span class="grl-status-pill '+cls+'">'+esc(label)+'</span>';}
  function render() {
    snapshotCosts();var records=buildRecords();
    host.innerHTML='<div class="gra-hero pov-hero"><div><div class="pov-eyebrow">Procurement</div><h1>Overview</h1><p class="gra-subtitle">Your purchases, supplier balances and product costs, in one place.</p></div><div class="pov-actions"><button type="button" class="grav-btn-outline" onclick="povExport()">Export Report</button><button type="button" class="grl-download-btn" onclick="openLpoCreate()">+ Purchase Order</button></div></div><div class="pov-filter-card"><div class="pov-filter-top"><div class="sh-search-wrap"><svg viewBox="0 0 18 18" fill="none" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M13 13l4 4"/></svg><input class="sh-search-input" id="pov-search" aria-label="Search procurement" placeholder="Search purchase, supplier or product" value="'+esc(filters.search)+'" oninput="povFilterChanged()"></div><select id="pov-period" aria-label="Date range" class="sh-branch-select" onchange="povPeriodChanged(this.value)"><option value="all">All time</option><option value="today">Today</option><option value="month">This month</option><option value="year">This year</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="custom">Custom dates</option></select><button type="button" class="pov-reset" onclick="povReset()">Reset filters</button></div><div class="pov-filters"><label>Supplier<select id="pov-supplier" onchange="povFilterChanged()">'+options(records.map(function(r){return r.supplier;}),'All suppliers',filters.supplier)+'</select></label><label>Branch<select id="pov-branch" onchange="povFilterChanged()">'+options(records.map(function(r){return r.branch;}),'All branches',filters.branch)+'</select></label><label>Procurement Status<select id="pov-status" onchange="povFilterChanged()">'+options(records.map(function(r){return r.status;}),'All statuses',filters.status)+'</select></label><label>Payment Status<select id="pov-payment" onchange="povFilterChanged()">'+options(['Paid','Unpaid','Partially Paid','Overdue','Awaiting Invoice'],'All payments',filters.payment)+'</select></label><label>From<input type="date" id="pov-from" value="'+esc(filters.from)+'" onchange="povFilterChanged()"></label><label>To<input type="date" id="pov-to" value="'+esc(filters.to)+'" onchange="povFilterChanged()"></label></div><div id="pov-filter-error" role="alert"></div></div><div id="pov-storage-note" class="pov-notice" '+(storageError?'':'hidden')+'>'+esc(storageError)+'</div><div id="pov-kpis" class="grl-kpi-grid"></div><div id="pov-secondary" class="pov-secondary"></div><div class="pov-accounting-note" id="pov-accounting-note">Purchase totals include confirmed / received orders and supplier invoices; invoices replace their linked order value. Cancelled and unconfirmed orders are excluded. Amount owed covers recorded invoices after dispatched returns.</div><section class="grav-card"><div class="pov-section-heading"><div><h3>Goods Received &amp; Procurement Expenses</h3><p class="pov-muted">Goods received come from processed GRAs. Record related expenses directly from a processed GRA.</p></div><button type="button" class="pov-link" onclick="showView(\'gra-processing\')">View GRA Processing</button></div><div id="pov-received-totals"></div></section><div class="pov-analysis-grid"><section class="grav-card pov-cost-card"><div class="pov-section-heading"><div><h3>Product Cost Price History</h3><p class="pov-muted">Compare cost changes over previous purchases and explore each product’s history.</p></div><select id="pov-cost-source" aria-label="Price history data source" onchange="povCostSourceChanged(this.value)"><option value="demo">Sample Products (25)</option><option value="recorded">Recorded Purchases</option></select></div><div id="pov-cost-data-note" class="pov-cost-data-note" role="status"></div><div class="sh-search-wrap pov-cost-search"><svg viewBox="0 0 18 18" fill="none" stroke-width="1.4"><circle cx="8" cy="8" r="6.5"/><path d="M13 13l4 4"/></svg><input class="sh-search-input" id="pov-cost-search" aria-label="Search product price history" placeholder="Search product name, SKU or unit" value="'+esc(costSearch)+'" oninput="povCostSearchChanged(this.value)"></div><div class="pov-table-scroll"><table class="gra-table grav-table pov-cost-list"><thead><tr><th>Product</th><th class="right">Previous Cost</th><th class="right">New Cost</th><th class="right">Change</th><th>Change Date</th><th></th></tr></thead><tbody id="pov-cost-rows"></tbody></table></div><div class="sup-pagination pov-cost-pagination"><span class="sup-pagination-info" id="pov-cost-page-info" role="status"></span><div class="sup-pagination-controls" id="pov-cost-pages"></div></div><div id="pov-cost-detail" class="pov-cost-detail" hidden><div class="pov-section-heading"><h4 id="pov-cost-detail-title"></h4><button type="button" class="pov-link" onclick="povCloseCostDetail()">Close History</button></div><div id="pov-cost-chart"></div></div></section><section class="grav-card"><h3>Supplier Balances</h3><p class="pov-muted">Largest outstanding balances in this selection.</p><div id="pov-suppliers"></div></section></div><section class="pov-register"><div class="pov-section-heading"><div><h3>Procurement Register</h3><p id="pov-table-caption" class="pov-muted"></p></div><label class="pov-sort">Sort by<select id="pov-sort" onchange="povSortChanged(this.value)"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest value</option><option value="balance">Highest balance due</option></select></label></div><div class="pov-table-scroll"><table class="grl-table"><thead><tr><th>Reference / Date</th><th>Supplier / Branch</th><th>Products</th><th class="right">Purchase Value</th><th class="right">Returns</th><th class="right">Paid</th><th class="right">Balance Due</th><th>Status / Payment</th><th>Action</th></tr></thead><tbody id="pov-rows"></tbody></table></div><div class="sup-pagination"><span class="sup-pagination-info" id="pov-page-info" role="status"></span><div class="sup-pagination-controls" id="pov-pages"></div></div></section>';
    document.getElementById('pov-period').value=filters.from||filters.to?'custom':'all';document.getElementById('pov-sort').value=filters.sort;document.getElementById('pov-cost-source').value=costDataMode;
    update();
  }
  function update() {
    var records=filtered(buildRecords()), t=totals(records);
    document.getElementById('pov-accounting-note').textContent='Purchase totals include confirmed / received orders and supplier invoices; invoices replace their linked order value. Cancelled and unconfirmed orders are excluded. Amount owed covers recorded invoices after dispatched returns.'+(t.unpriced?' '+t.unpriced+' confirmed purchase order(s) have missing unit costs; those missing costs are excluded from totals.':'');
    document.getElementById('pov-kpis').innerHTML=kpi('Total Purchase Value',money(t.purchased),'Before supplier returns',0,false)+kpi('Paid to Suppliers',money(t.paid),'Recorded supplier invoice payments',1,false)+kpi('Amount Owed',money(t.owed),'Invoiced balance still due',2,false)+kpi('Supplier Returns',money(t.returned),'Dispatched returns only',3,true);
    document.getElementById('pov-secondary').innerHTML=[['Net Purchase Value',money(t.net)],['Awaiting Invoice',money(t.awaitingInvoice)],['Open Purchase Orders',t.pending],['Active Suppliers',t.suppliers]].map(function(row){return '<div><span>'+row[0]+'</span><strong>'+row[1]+'</strong></div>';}).join('');
    document.getElementById('pov-received-totals').innerHTML='<div class="pov-received-metrics">'+[['Goods Received (GRA)',money(t.received)],['Procurement Expenses',money(t.expenses)],['Goods Received + Expenses',money(round(t.received+t.expenses))],['Processed GRAs',t.graCount]].map(function(row){return '<div><span>'+row[0]+'</span><strong>'+row[1]+'</strong></div>';}).join('')+'</div><p class="pov-muted">Goods Received + Expenses is the processed GRA received value plus the expenses recorded against those GRAs. Supplier payments and returns are reported separately.</p>';
    var bySupplier={};records.filter(function(r){return r.committed;}).forEach(function(r){var x=bySupplier[r.supplier]||(bySupplier[r.supplier]={due:0,paid:0,overdue:0});x.due+=r.due;x.paid+=r.paid;x.overdue+=r.overdue;});
    var supplierRows=Object.entries(bySupplier).sort(function(a,b){return b[1].due-a[1].due;}).slice(0,5),max=Math.max.apply(null,[1].concat(supplierRows.map(function(x){return x[1].due;})));
    document.getElementById('pov-suppliers').innerHTML='<div class="pov-overdue"><span>Overdue balance</span><strong>'+money(t.overdue)+'</strong></div>'+supplierRows.map(function(entry){return '<div class="pov-supplier-row"><div><span>'+esc(entry[0])+'</span><strong>'+money(entry[1].due)+'</strong></div><div class="pov-balance-track"><span style="width:'+(entry[1].due/max*100)+'%"></span></div><small>Paid '+money(entry[1].paid)+(entry[1].overdue?' · Overdue '+money(entry[1].overdue):'')+'</small></div>';}).join('')+(supplierRows.length?'':'<p class="pov-empty">No supplier balances in this selection.</p>')+(t.supplierCredit?'<p class="pov-muted">Supplier credit / overpayment: '+money(t.supplierCredit)+'</p>':'');
    drawCosts();renderTable(records);
    if(storageError){document.getElementById('pov-storage-note').hidden=false;document.getElementById('pov-storage-note').textContent=storageError;}
  }
  function costPoints(records,ignoreDates) {
    var allowed=new Set(records.filter(function(r){return r.committed;}).map(function(r){return ref(r.id);}));
    var ids=new Set(records.filter(function(r){return r.committed;}).flatMap(function(r){return r.gras.some(function(g){return g.date&&g.items.length;})?r.gras.map(function(g){return g.id;}):r.invoices.map(function(i){return i.id;});}));
    var invoicedPos=new Set(allInvoices().map(function(i){return ref(i.po);}).concat(records.filter(function(r){return r.gras.some(function(g){return g.date&&g.items.length;});}).map(function(r){return ref(r.id);})));
    return Object.values(ledger.costs).filter(function(p){return (ids.has(p.document)||(allowed.has(ref(p.po))&&!invoicedPos.has(ref(p.po))))&&(ignoreDates||!filters.from||p.date>=filters.from)&&(ignoreDates||!filters.to||p.date<=filters.to);});
  }
  function historyDateSort(a,b){return a.date.localeCompare(b.date)||(a.recordedAt||'').localeCompare(b.recordedAt||'');}
  function productHistories() {
    // Keep earlier purchases as comparison points when a date range is selected.
    var points=costPoints(filtered(buildRecords(),true),true),grouped={};
    points.forEach(function(p){
      if(!Number.isFinite(p.cost)||p.cost<=0)return;
      var product=grouped[p.key]||(grouped[p.key]={key:p.key,name:p.product,unit:p.unit,documents:{}});
      var documentKey=ref(p.po)||p.document;
      var observation=product.documents[documentKey]||(product.documents[documentKey]={point:p,weightedCost:0,quantity:0});
      var quantity=Number(p.quantity)>0?Number(p.quantity):1;
      observation.weightedCost+=p.cost*quantity;observation.quantity+=quantity;
      if(historyDateSort(p,observation.point)>0)observation.point=p;
    });
    return Object.values(grouped).map(function(product){
      var series=Object.values(product.documents).map(function(o){return Object.assign({},o.point,{cost:round(o.weightedCost/o.quantity)});}).sort(historyDateSort),lastChange=null;
      for(var index=1;index<series.length;index++){
        var current=series[index],previous=series[index-1];
        if(current.cost!==previous.cost&&(!filters.from||current.date>=filters.from)&&(!filters.to||current.date<=filters.to))lastChange={previous:previous,current:current};
      }
      if(!lastChange)return null;
      var change=round(lastChange.current.cost-lastChange.previous.cost);
      return {key:product.key,name:lastChange.current.product,unit:lastChange.current.unit,previous:lastChange.previous.cost,current:lastChange.current.cost,change:change,percent:change/lastChange.previous.cost*100,date:lastChange.current.date,document:lastChange.current.document,series:series};
    }).filter(Boolean).sort(function(a,b){return b.date.localeCompare(a.date)||a.name.localeCompare(b.name)||a.unit.localeCompare(b.unit);});
  }
  // Preview data stays in memory and never enters purchase, payment or expense records.
  function demoProductHistories() {
    var products=[
      ['Parboiled Rice 50kg','bag',65000],['Vegetable Oil 5L','bottle',9500],['Granulated Sugar 1kg','bag',1350],
      ['Wheat Flour 50kg','bag',48000],['Semolina 10kg','bag',14000],['Spaghetti 500g','pack',850],
      ['Instant Noodles','carton',7200],['Tomato Paste 400g','tin',1100],['Powdered Milk 900g','tin',10500],
      ['Chocolate Drink 500g','tin',4800],['Laundry Detergent 1kg','pack',2100],['Dishwashing Liquid 750ml','bottle',1600],
      ['Bath Soap 150g','bar',450],['Toilet Tissue 10 Rolls','pack',2800],['Bottled Water 75cl','pack of 12',1800],
      ['Carbonated Drink 50cl','crate of 24',6800],['Orange Juice 1L','carton of 12',18500],['Cream Biscuits','carton',5600],
      ['Tea 100 Bags','box',3400],['Cornflakes 500g','box',3900],['Brown Beans 50kg','bag',82000],
      ['Palm Oil 25L','keg',42000],['Seasoning Cubes 100 Pieces','pack',1250],['Table Salt 1kg','bag',650],
      ['Laundry Bleach 1L','bottle',1200]
    ];
    var dates=['2026-06-05','2026-07-08','2026-08-12','2026-09-16','2026-10-21','2026-11-06'];
    return products.map(function(product,index){
      var key='demo-product-'+String(index+1).padStart(2,'0'),base=product[2];
      var factors=index%3===0?[1,1.04,1.08,1.12,1.15,1.21]:index%3===1?[1,1.06,1.09,1.04,1.01,.96]:[1,.97,1.02,1.08,1.04,1.13];
      var series=dates.map(function(date,i){return {key:key,product:product[0],unit:product[1],cost:round(base*factors[i]),date:date,recordedAt:date+'T10:00:00Z',document:'DEMO-PO-'+String(index+1).padStart(2,'0')+'-'+String(i+1).padStart(2,'0'),supplier:'Sample Wholesaler '+String.fromCharCode(65+index%3)+' (fictional)'};});
      var previous=series[series.length-2],current=series[series.length-1],change=round(current.cost-previous.cost);
      return {key:key,name:product[0],unit:product[1],previous:previous.cost,current:current.cost,change:change,percent:change/previous.cost*100,date:current.date,document:current.document,series:series};
    }).sort(function(a,b){return a.name.localeCompare(b.name);});
  }
  window.povCostSourceChanged=function(value){
    costDataMode=value==='recorded'?'recorded':'demo';document.getElementById('pov-cost-source').value=costDataMode;costPage=1;costSearch='';selectedProduct='';
    document.getElementById('pov-cost-search').value='';drawCosts();
  };
  function drawCosts() {
    var query=costSearch.toLowerCase().trim(),products=(costDataMode==='demo'?demoProductHistories():productHistories()).filter(function(p){return !query||[p.name,p.unit,p.key].join(' ').toLowerCase().includes(query);});
    document.getElementById('pov-cost-data-note').textContent=costDataMode==='demo'?'Fictional preview: 25 sample products with six purchases each, from June to November 2026. This preview is independent of the page filters and does not affect procurement totals.':'Live history from recorded purchases. Products with cost changes appear automatically and follow the page filters.';
    document.getElementById('pov-cost-data-note').classList.toggle('is-demo',costDataMode==='demo');
    var pages=Math.max(1,Math.ceil(products.length/costPageSize));costPage=Math.max(1,Math.min(costPage,pages));
    var start=(costPage-1)*costPageSize,visible=products.slice(start,start+costPageSize);
    document.getElementById('pov-cost-rows').innerHTML=visible.length?visible.map(function(p){
      return '<tr><td><button type="button" class="pov-link" data-product="'+esc(p.key)+'" onclick="povProductChanged(this.dataset.product)">'+esc(p.name)+'</button><small>Per '+esc(p.unit)+'</small></td><td class="right">'+money(p.previous)+'</td><td class="right">'+money(p.current)+'</td><td class="right"><strong class="pov-cost-change '+(p.change>0?'pov-up':'pov-down')+'">'+(p.change>0?'+':'')+p.percent.toFixed(1)+'%</strong><small>'+(p.change>0?'+':'')+money(p.change)+'</small></td><td>'+date(p.date)+'<small>'+esc(p.document)+'</small></td><td><button type="button" class="pov-link" data-product="'+esc(p.key)+'" aria-label="View cost history for '+esc(p.name)+' per '+esc(p.unit)+'" onclick="povProductChanged(this.dataset.product)">View History</button></td></tr>';
    }).join(''):'<tr><td colspan="6" class="pov-empty">'+(query?'No products with cost changes match your search.':'No product cost changes found for this selection. Products appear automatically when a later purchase records a different unit cost.')+'</td></tr>';
    document.getElementById('pov-cost-page-info').textContent=products.length?'Showing '+(start+1)+'–'+(start+visible.length)+' of '+products.length+' changed products':'Showing 0 changed products';
    var buttons='<button type="button" class="sup-page-btn" aria-label="Previous price history page" onclick="povCostPage('+(costPage-1)+')" '+(costPage===1?'disabled':'')+'>‹</button>',previousPage=0;
    Array.from(new Set([1,pages,costPage-1,costPage,costPage+1])).filter(function(n){return n>0&&n<=pages;}).sort(function(a,b){return a-b;}).forEach(function(n){if(previousPage&&n-previousPage>1)buttons+='<span class="sup-page-ellipsis">…</span>';buttons+='<button type="button" class="sup-page-btn '+(n===costPage?'active':'')+'" aria-label="Price history page '+n+'" '+(n===costPage?'aria-current="page"':'')+' onclick="povCostPage('+n+')">'+n+'</button>';previousPage=n;});
    document.getElementById('pov-cost-pages').innerHTML=buttons+'<button type="button" class="sup-page-btn" aria-label="Next price history page" onclick="povCostPage('+(costPage+1)+')" '+(costPage===pages?'disabled':'')+'>›</button>';
    var selected=products.find(function(p){return p.key===selectedProduct;}),detail=document.getElementById('pov-cost-detail');
    detail.hidden=!selected;
    if(selected){
      document.getElementById('pov-cost-detail-title').textContent=selected.name+' · per '+selected.unit;
      var series=selected.series.filter(function(p){return costDataMode==='demo'||!filters.to||p.date<=filters.to;});
      if(costDataMode==='recorded'&&filters.from){var baseline=series.filter(function(p){return p.date<filters.from;}).slice(-1);series=baseline.concat(series.filter(function(p){return p.date>=filters.from;}));}
      drawCostChart(series);
    }else{selectedProduct='';document.getElementById('pov-cost-chart').innerHTML='';}
  }
  window.povCostSearchChanged=function(value){costSearch=value;costPage=1;drawCosts();};
  window.povCostPage=function(value){costPage=value;drawCosts();};
  window.povCloseCostDetail=function(){selectedProduct='';drawCosts();};
  function drawCostChart(series) {
    var chart=document.getElementById('pov-cost-chart');
    if(!series.length){chart.innerHTML='';return;}
    var first=series[0],last=series[series.length-1],change=round(last.cost-first.cost),pct=first.cost?change/first.cost*100:0;
    var metrics='<div class="pov-cost-metrics"><div><span>First Recorded</span><strong>'+money(first.cost)+'</strong><small>'+date(first.date)+'</small></div><div><span>Latest Recorded</span><strong>'+money(last.cost)+'</strong><small>'+date(last.date)+'</small></div><div><span>Period Change</span><strong class="'+(change>0?'pov-up':change<0?'pov-down':'')+'">'+(change>0?'+':'')+pct.toFixed(1)+'%</strong><small>'+series.length+' purchase observations</small></div></div>';
    var width=680,height=200,min=Math.min.apply(null,series.map(function(p){return p.cost;})),max=Math.max.apply(null,series.map(function(p){return p.cost;})),range=max-min||max*.1||1;
    min=Math.max(0,min-range*.15);max+=range*.15;
    var start=Date.parse(first.date),end=Date.parse(last.date),xs=series.map(function(p,index){return 58+(end===start?(series.length===1 ? 0.5 : index/(series.length-1)):(Date.parse(p.date)-start)/(end-start))*600;}),ys=series.map(function(p){return 20+(max-p.cost)/(max-min)*145;}),line=xs.map(function(x,index){return x+','+ys[index];}).join(' ');
    var grid=[0,.5,1].map(function(r){var y=20+r*145;return '<line x1="58" x2="658" y1="'+y+'" y2="'+y+'" stroke="#e2e8f0"/><text x="50" y="'+(y+4)+'" text-anchor="end">'+Math.round(max-r*(max-min)).toLocaleString('en-NG')+'</text>';}).join('');
    chart.innerHTML=metrics+'<svg class="pov-line-chart" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Recorded unit cost history for '+esc(first.product)+'">'+grid+'<polyline fill="none" stroke="#2d7dd2" stroke-width="3" points="'+line+'"/>'+series.map(function(p,index){return '<circle cx="'+xs[index]+'" cy="'+ys[index]+'" r="4" fill="#1a3c6e"><title>'+esc(date(p.date)+' · '+p.document+' · '+p.supplier+' · '+money(p.cost))+'</title></circle>';}).join('')+'<text x="58" y="190">'+esc(date(first.date))+'</text><text x="658" y="190" text-anchor="end">'+esc(date(last.date))+'</text></svg><div class="pov-table-scroll"><table class="gra-table grav-table"><thead><tr><th>Date</th><th>Reference</th><th>Supplier</th><th class="right">Unit Cost</th></tr></thead><tbody>'+series.map(function(p){return '<tr><td>'+date(p.date)+'</td><td>'+esc(p.document)+'</td><td>'+esc(p.supplier)+'</td><td class="right">'+money(p.cost)+' / '+esc(p.unit)+'</td></tr>';}).join('')+'</tbody></table></div>';
  }
  function renderTable(records) {
    records.sort(function(a,b){return filters.sort==='oldest'?a.date.localeCompare(b.date):filters.sort==='highest'?b.gross-a.gross:filters.sort==='balance'?b.due-a.due:b.date.localeCompare(a.date)||b.id.localeCompare(a.id);});
    var pages=Math.max(1,Math.ceil(records.length/pageSize));page=Math.min(page,pages);var start=(page-1)*pageSize,rows=records.slice(start,start+pageSize);
    document.getElementById('pov-rows').innerHTML=rows.length?rows.map(function(r){return '<tr><td><button type="button" class="pov-link" data-id="'+esc(r.id)+'" onclick="povViewRecord(this.dataset.id)">'+esc(r.id)+'</button><small>'+date(r.date)+'</small></td><td><strong>'+esc(r.supplier)+'</strong><small>'+esc(r.branch||'Branch not recorded')+'</small></td><td><span class="pov-products">'+esc(r.items.map(function(i){return i.name;}).join(', ')||'Line items not recorded')+'</span><small>'+r.items.length+' product line'+(r.items.length===1?'':'s')+'</small></td><td class="right">'+money(r.gross)+'</td><td class="right">'+money(r.returned)+'</td><td class="right">'+money(r.paid)+'</td><td class="right">'+(r.invoices.length?money(r.due):'—')+'<small>'+(r.invoices.length?'Due '+date(r.dueDate):'Awaiting invoice')+'</small></td><td>'+pill(r.status)+'<small>'+pill(r.paymentStatus)+(r.overdue?' '+pill('Overdue'):'')+'</small></td><td><button type="button" class="grl-action-btn view" aria-label="View procurement '+esc(r.id)+'" data-id="'+esc(r.id)+'" onclick="povViewRecord(this.dataset.id)"><svg viewBox="0 0 16 16" fill="none" stroke-width="1.4"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2.2"/></svg></button></td></tr>';}).join(''):'<tr><td colspan="9" class="pov-empty">No procurements match these filters. Try a wider date range or reset the filters.</td></tr>';
    document.getElementById('pov-table-caption').textContent=records.length+' procurements match your selection · 8 per page';
    document.getElementById('pov-page-info').textContent=records.length?'Showing '+(start+1)+'–'+(start+rows.length)+' of '+records.length+' procurements':'Showing 0 of 0 procurements';
    var buttons='<button type="button" class="sup-page-btn" aria-label="Previous procurement page" onclick="povPage('+(page-1)+')" '+(page===1?'disabled':'')+'>‹</button>';
    var shown=new Set([1,pages,page-1,page,page+1]);var previous=0;
    Array.from(shown).filter(function(n){return n>0&&n<=pages;}).sort(function(a,b){return a-b;}).forEach(function(n){if(previous&&n-previous>1)buttons+='<span class="sup-page-ellipsis">…</span>';buttons+='<button type="button" class="sup-page-btn '+(n===page?'active':'')+'" aria-label="Procurement page '+n+'" '+(n===page?'aria-current="page"':'')+' onclick="povPage('+n+')">'+n+'</button>';previous=n;});
    document.getElementById('pov-pages').innerHTML=buttons+'<button type="button" class="sup-page-btn" aria-label="Next procurement page" onclick="povPage('+(page+1)+')" '+(page===pages?'disabled':'')+'>›</button>';
  }
  window.povFilterChanged=function(){var from=document.getElementById('pov-from').value,to=document.getElementById('pov-to').value;if(from&&to&&from>to){document.getElementById('pov-filter-error').textContent='The end date must be on or after the start date.';return;}document.getElementById('pov-filter-error').textContent='';['search','supplier','branch','status','payment','from','to'].forEach(function(key){filters[key]=document.getElementById('pov-'+key).value;});document.getElementById('pov-period').value=from||to?'custom':'all';page=1;costPage=1;update();};
  window.povPeriodChanged=function(value){var from='',to='';if(value==='custom')return;var now=today(),d=new Date(now+'T12:00:00');if(value==='today'){from=now;to=now;}else if(value==='month'){from=now.slice(0,7)+'-01';to=now;}else if(value==='year'){from=now.slice(0,4)+'-01-01';to=now;}else if(value!=='all'){d.setDate(d.getDate()-Number(value)+1);from=day(d.toDateString());to=now;}document.getElementById('pov-from').value=from;document.getElementById('pov-to').value=to;povFilterChanged();document.getElementById('pov-period').value=value;};
  window.povReset=function(){filters={search:'',supplier:'',branch:'',status:'',payment:'',from:'',to:'',sort:'newest'};page=1;costPage=1;costSearch='';selectedProduct='';render();};
  window.povSortChanged=function(value){filters.sort=value;page=1;renderTable(filtered(buildRecords()));};
  window.povPage=function(n){page=Math.max(1,n);renderTable(filtered(buildRecords()));};
  window.povProductChanged=function(value){selectedProduct=value;drawCosts();};
  window.openProcurementOverview=function(){showView('procurement-overview');};
  window.getProcurementOverviewData=function(){var records=filtered(buildRecords());return clone({records:records,totals:totals(records)});};
  var detailOverlay=document.createElement('div');detailOverlay.id='pov-detail-overlay';detailOverlay.className='modal-overlay';detailOverlay.setAttribute('role','dialog');detailOverlay.setAttribute('aria-modal','true');detailOverlay.setAttribute('aria-labelledby','pov-detail-title');document.body.appendChild(detailOverlay);
  var detailFocus;
  window.povCloseDetail=function(){detailOverlay.classList.remove('open');if(detailFocus&&detailFocus.isConnected)detailFocus.focus();};
  detailOverlay.onclick=function(event){if(event.target===detailOverlay)povCloseDetail();};
  window.povViewRecord=function(id){
    var r=buildRecords().find(function(r){return r.id===id;});if(!r)return;
    detailFocus=document.activeElement;
    detailOverlay.innerHTML='<div class="recpay-modal pov-detail-modal"><div class="recpay-head"><div><h2 id="pov-detail-title">'+esc(r.id)+'</h2><p>'+esc(r.supplier)+' · '+date(r.date)+'</p></div><button type="button" class="recpay-close" aria-label="Close procurement details" onclick="povCloseDetail()">×</button></div><div class="recpay-body"><div class="pov-detail-summary"><div><span>Purchase Value</span><strong>'+money(r.gross)+'</strong></div><div><span>Supplier Returns</span><strong>'+money(r.returned)+'</strong></div><div><span>Amount Paid</span><strong>'+money(r.paid)+'</strong></div><div><span>Balance Due</span><strong>'+money(r.due)+'</strong></div></div><div class="pov-detail-meta"><span>Branch: '+esc(r.branch||'Not recorded')+'</span>'+pill(r.status)+pill(r.paymentStatus)+'</div><div class="pov-table-scroll"><table class="gra-table grav-table"><thead><tr><th>Product</th><th class="right">Quantity</th><th class="right">Unit Cost</th><th class="right">Line Total</th></tr></thead><tbody>'+r.items.map(function(it){return '<tr><td>'+esc(it.name)+'</td><td class="right">'+Number(it.qtyPurchased||0)+' '+esc(it.unit||'units')+'</td><td class="right">'+money(it.unitCost)+'</td><td class="right">'+money(Number(it.qtyPurchased||0)*Number(it.unitCost||0))+'</td></tr>';}).join('')+(r.items.length?'':'<tr><td colspan="4" class="pov-empty">Line-item details were not recorded for this procurement.</td></tr>')+'</tbody></table></div>'+(r.invoices.length?'<div><h3>Supplier Invoices</h3><div class="pov-table-scroll"><table class="gra-table grav-table"><thead><tr><th>Invoice</th><th>Due</th><th class="right">Amount</th><th class="right">Paid</th></tr></thead><tbody>'+r.invoices.map(function(i){return '<tr><td>'+esc(i.id)+'</td><td>'+date(i.dueDate)+'</td><td class="right">'+money(i.total)+'</td><td class="right">'+money(i.paid)+'</td></tr>';}).join('')+'</tbody></table></div></div>':'')+(r.returns.length?'<div><h3>Supplier Returns</h3>'+r.returns.map(function(ret){return '<div class="grav-row"><button type="button" class="pov-link" data-id="'+esc(ret.id)+'" onclick="povCloseDetail();openSupplierReturnDetail(this.dataset.id)">'+esc(ret.id)+'</button><span>'+esc(ret.status)+' · '+money(ret.total)+'</span></div>';}).join('')+'</div>':'')+recordGraDetails(r)+'<p class="pov-muted pov-notes">'+esc(r.notes||'No additional notes.')+'</p>'+(r.po?'<button type="button" class="grav-btn-primary" data-id="'+esc(r.po)+'" onclick="povCloseDetail();openLpoDetails(this.dataset.id)">View Purchase Order</button>':'')+'</div></div>';
    detailOverlay.classList.add('open');detailOverlay.querySelector('button').focus();
  };
  function exportRows(rows,name){var csv=rows.map(function(row){return row.map(function(value){var text=String(value==null?'':value);if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}).join(',');}).join('\r\n');var url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'})),a=document.createElement('a');a.href=url;a.download=name+'-'+today()+'.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  window.povExport=function(){var records=filtered(buildRecords());exportRows([['Reference','Date','Supplier','Branch','Purchase Value','Supplier Returns','Net Purchase Value','Paid to Suppliers','Invoiced Balance Due','Procurement Status','Payment Status']].concat(records.map(function(r){return [r.id,r.date,r.supplier,r.branch,r.gross,r.returned,r.net,r.paid,r.due,r.status,r.paymentStatus];})),'procurement-overview');};
  function captureOrders(){Object.keys(window.lpoData).forEach(function(id){ledger.orders[id]=orderInfo(id,window.lpoData[id]);});persist();snapshotCosts();}
  var originalSubmitOrder=window.submitLpoCreate;
  window.submitLpoCreate=function(){var result=originalSubmitOrder.apply(this,arguments);captureOrders();return result;};
  var originalSetStatus=window.setLpoDetailStatus;
  window.setLpoDetailStatus=function(){var result=originalSetStatus.apply(this,arguments);captureOrders();return result;};
  var originalSubmitInvoice=window.submitRecordInvoice;
  window.submitRecordInvoice=function(){
    var id=document.getElementById('ri-invoice-number').value.trim()||'INV-DFL-00845',reference=ref(document.getElementById('ri-lpo-select').value),supplier=document.getElementById('ri-supplier-select').value;
    var inputDate=document.querySelector('#view-record-invoice input[type="date"]');
    var items=Array.from(document.querySelectorAll('#ri-line-tbody tr')).map(function(row){var qty=row.querySelector('.ri-qty-input'),cost=row.querySelector('.ri-cost-input');if(!qty||!cost)return null;var name=row.cells[1].textContent.trim(),known=linesForRef(reference).find(function(it){return it.name===name;});return {name:name,qtyPurchased:Number(qty.value)||0,unitCost:Number(cost.value)||0,unit:known&&known.unit||'units'};}).filter(Boolean);
    var invoice={id:id,po:reference,supplier:supplier,recordedAt:new Date().toISOString(),date:inputDate&&inputDate.value||today(),dueDate:document.getElementById('ri-due-date').value,total:amount(document.getElementById('ri-total-due').textContent),paid:0,items:items,branch:(window.lpoData[reference]||{}).branch||''};
    var result=originalSubmitInvoice.apply(this,arguments);
    if(!ledger.invoices[id]){ledger.invoices[id]=invoice;persist();snapshotCosts();}
    return result;
  };
  var previousShowView=window.showView;
  window.showView=function(name){var result=previousShowView.apply(this,arguments);if(name==='procurement-overview'){view.querySelectorAll('.subitem').forEach(function(b){b.classList.toggle('active',b.classList.contains('pov-nav'));});render();}return result;};
  window.addEventListener('storage',function(event){if(event.key===ledgerKey){try{var next=JSON.parse(event.newValue||'null');if(next&&next.orders&&next.invoices&&next.costs){ledger=next;saved=event.newValue;if(view.classList.contains('active'))render();}}catch(error){}}});
  document.addEventListener('keydown',function(event){var active=detailOverlay.classList.contains('open')?detailOverlay:null;if(!active)return;if(event.key==='Escape'){povCloseDetail();return;}if(event.key==='Tab'){var controls=Array.from(active.querySelectorAll('button,input,select,textarea,summary')).filter(function(el){return !el.disabled&&!el.hidden;}),first=controls[0],last=controls[controls.length-1];if(event.shiftKey&&document.activeElement===first){last.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first.focus();event.preventDefault();}}});
  function recordGraDetails(r){return '<section><h3>Processed GRAs &amp; Expenses</h3>'+r.gras.map(function(g){return '<div class="grav-row"><button type="button" class="pov-link" data-id="'+esc(g.id)+'" onclick="povCloseDetail();openProcessedGra(this.dataset.id)">'+esc(g.id)+'</button><span>Received '+money(g.receivedValue)+'</span></div>';}).join('')+(r.gras.length?'':'<p class="pov-muted">No processed GRA is linked to this purchase.</p>')+(r.expenses.length?'<div class="pov-table-scroll"><table class="gra-table grav-table"><thead><tr><th>Date / GRA</th><th>Category / Vendor</th><th>Description</th><th class="right">Amount</th><th>Receipt</th></tr></thead><tbody>'+r.expenses.map(function(e){return '<tr><td>'+date(e.date)+'<br>'+esc(e.gra)+'</td><td>'+esc(e.category)+'<br>'+esc(e.vendor)+'</td><td>'+esc(e.description)+'</td><td class="right">'+money(e.amount)+'</td><td>'+(e.receipt?'<button type="button" class="pov-link" data-id="'+esc(e.id)+'" onclick="downloadGraExpenseReceipt(this.dataset.id)">Download Receipt</button>':'—')+'</td></tr>';}).join('')+'</tbody></table></div>':'')+'</section>';}
  window.addEventListener('crop:gra-updated',function(){if(view.classList.contains('active'))render();});
  snapshotCosts();
})();

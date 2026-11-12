(function () {
  'use strict';
  var base = document.getElementById('view-dashboard');
  if (!base) return;
  var categories = ['All topics', 'Getting Started', 'Sales', 'Customers', 'Inventory', 'Procurement', 'Company'];
  var guides = [
    {id:'start', category:'Getting Started', title:'Find your way around C.R.O.P', description:'Get familiar with your workspace and the tools for your daily operations.', steps:['Start on Dashboard for an overview of your business activity.', 'Use the sidebar to open Inventory, Sales, Procurement or Company.', 'Open How to Use C.R.O.P whenever you need a guide. Search by task or choose a topic.']},
    {id:'sale', category:'Sales', title:'Make a sale and review orders', description:'Use the sales window and keep track of the orders you create.', steps:['Open Sales to access the sales window.', 'Select the products and quantities for the customer’s purchase.', 'Review the order details before completing the sale.', 'Open Orders to find an order and review its customer, items and status.']},
    {id:'credit', category:'Sales', title:'Create a credit invoice and track payment', description:'Bill a store on credit, share the invoice and record full or partial payments.', steps:['Open Generate Invoice and select the customer. Check the attached email address or create a customer on that screen.', 'Add the products, quantities and payment due date, then generate the invoice.', 'Use Draft Email or Send via WhatsApp to prepare the invoice for sharing.', 'Find the invoice in Credit Invoices. Open its payment action to record full, half or a custom partial payment and attach a receipt if available.', 'Review the remaining balance and payment history. Credit invoices also appear in Orders as Completed with Pickup delivery.']},
    {id:'customer', category:'Customers', title:'Create a store or user profile', description:'Choose the right customer profile for an individual or a store buying on credit.', steps:['In the sales window, choose Create Customer Profile.', 'Select Store Profile for a smaller store, or User Profile for an individual customer.', 'Complete the relevant contact and profile details, then save.', 'Select the saved customer when preparing their next purchase or credit invoice.']},
    {id:'stock', category:'Inventory', title:'Find products in your inventory', description:'Locate the products you sell and review their information.', steps:['Open Inventory from the sidebar.', 'Search the product list for the item you need.', 'Open the product to review its information before making changes.']},
    {id:'procure', category:'Procurement', title:'Follow a purchase from LPO to payment', description:'Keep purchase orders, goods received, supplier invoices and expenses linked.', steps:['Open Procurement and create or review the purchase order in the LPO section.', 'Process the GRA when the goods arrive, checking the received quantities and product details.', 'From the processed GRA, record the supplier invoice and any related expenses. Attach expense receipts when available.', 'Use Supplier Invoices to record supplier payments and review outstanding balances.', 'Open Overview to filter procurement records, review totals and compare product cost price changes. Choose Recorded Purchases in the cost history card to see your purchase data.']},
    {id:'company', category:'Company', title:'Review stores and workspace settings', description:'Find the company tools that support your day-to-day operations.', steps:['Open Company to review your stores.', 'Open Settings to review the available workspace settings.', 'Check that you are working in the intended workspace before changing business information.']}
  ];
  function safeUrl(value, local) {
    if (typeof value !== 'string' || !value.trim()) return '';
    value = value.trim();
    if (/^https:\/\//i.test(value)) return value;
    if (local && !/^[a-z][a-z\d+.-]*:|^\/\//i.test(value) && !value.includes('\\')) return value;
    return '';
  }
  var videos = (Array.isArray(window.cropHelpResources) ? window.cropHelpResources : []).filter(function (r) {
    return r && r.title && ['file','link'].includes(r.type) && safeUrl(r.src, r.type === 'file');
  });
  var category = 'All topics', query = '', page = 1, pageSize = 6;
  var view = document.createElement('div'); view.id = 'view-crop-help'; view.className = 'view';
  var shell = document.createElement('div'); shell.className = 'dash-shell';
  shell.appendChild(base.querySelector('.dash-sidebar').cloneNode(true));
  var main = document.createElement('div'); main.className = 'dash-main';
  main.appendChild(base.querySelector('.dash-topbar').cloneNode(true));
  var content = document.createElement('div'); content.className = 'help-content';
  content.innerHTML = '<header class="help-heading"><span class="help-eyebrow">C.R.O.P RESOURCE CENTRE</span><h1>How to Use C.R.O.P</h1><p>Practical guides for running your business, one task at a time.</p></header>' +
    '<section class="help-intro" aria-labelledby="help-start-title"><div><span class="help-eyebrow">START HERE</span><h2 id="help-start-title">A little guidance. A smoother day.</h2><p>Learn the essentials, follow a workflow or find help with the task in front of you.</p><button type="button" id="help-start" class="help-primary">Explore the getting started guide <span aria-hidden="true">→</span></button></div><div class="help-intro-note"><span aria-hidden="true">▶</span><strong>Learn at your own pace</strong><p>Follow the written steps and watch available video walkthroughs.</p></div></section>' +
    '<div class="help-tools"><label class="help-search">Search guides and videos<input type="search" id="help-search" placeholder="Try credit invoices, customers or procurement…"></label><label>Topic<select id="help-category"></select></label></div>' +
    '<section class="help-section" aria-labelledby="help-videos-title"><div class="help-section-heading"><div><h2 id="help-videos-title">Video resources</h2><p>Watch a walkthrough of the tools you use.</p></div><span id="help-video-count" class="help-count"></span></div><div id="help-videos" class="help-video-grid"></div><div id="help-video-pages" class="help-pagination"></div></section>' +
    '<section class="help-section" aria-labelledby="help-guides-title"><div class="help-section-heading"><div><h2 id="help-guides-title">Step-by-step guides</h2><p>Open a guide to see the steps.</p></div><span id="help-guide-count" class="help-count"></span></div><div id="help-guides" class="help-guide-grid"></div><p id="help-result-status" class="help-sr" role="status" aria-live="polite"></p></section>';
  main.appendChild(content); shell.appendChild(main); view.appendChild(shell); document.body.appendChild(view);
  var icon = '<svg class="nav-ic" viewBox="0 0 16 16" fill="none" stroke-width="1.5" aria-hidden="true"><rect x="1" y="2" width="14" height="12" rx="2"/><path d="m6 5 5 3-5 3V5Z"/></svg>';
  document.querySelectorAll('.dash-nav').forEach(function (nav) {
    var button = document.createElement('button'); button.type = 'button'; button.className = 'item help-nav'; button.innerHTML = icon + 'How to Use C.R.O.P';
    button.addEventListener('click', function () { window.showView('crop-help'); });
    nav.appendChild(button);
  });
  view.querySelectorAll('.dash-nav .item.active').forEach(function (el) { el.classList.remove('active'); });
  view.querySelector('.help-nav').classList.add('active'); view.querySelector('.help-nav').setAttribute('aria-current','page');
  var dialog = document.createElement('dialog'); dialog.className = 'help-player'; dialog.setAttribute('aria-labelledby','help-player-title');
  dialog.innerHTML = '<div class="help-player-head"><h2 id="help-player-title"></h2><button type="button" aria-label="Close video"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div><div id="help-player-body"></div>';
  document.body.appendChild(dialog);
  function cleanupPlayer() { var video = dialog.querySelector('video'); if (video) { video.pause(); video.removeAttribute('src'); video.load(); } dialog.querySelector('#help-player-body').replaceChildren(); }
  dialog.querySelector('button').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', cleanupPlayer);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) { var r = dialog.getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  function text(tag, value, className) { var el = document.createElement(tag); el.textContent = value; if (className) el.className = className; return el; }
  function matches(r) { return (category === 'All topics' || r.category === category) && [r.title, r.description, r.category].join(' ').toLowerCase().includes(query); }
  function openVideo(resource) {
    dialog.querySelector('h2').textContent = resource.title;
    var body = dialog.querySelector('#help-player-body'); body.replaceChildren();
    var video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.playsInline = true; video.src = safeUrl(resource.src, true);
    if(safeUrl(resource.poster,true)) video.poster = safeUrl(resource.poster,true);
    if (safeUrl(resource.captions,true)) { var track = document.createElement('track'); track.kind = 'captions'; track.srclang = 'en'; track.label = 'English'; track.src = safeUrl(resource.captions,true); video.appendChild(track); }
    var error = text('p','This video could not be loaded. Please try again later.','help-video-error'); error.hidden = true;
    video.addEventListener('error',function () { error.hidden = false; });
    body.append(video, error); if(resource.description) body.appendChild(text('p',resource.description));
    dialog.showModal();
  }
  function render() {
    var found = videos.filter(matches), filteredGuides = guides.filter(matches), totalPages = Math.max(1, Math.ceil(found.length/pageSize));
    page = Math.min(page,totalPages);
    var list = content.querySelector('#help-videos'); list.replaceChildren();
    content.querySelector('#help-video-count').textContent = found.length + ' video' + (found.length === 1 ? '' : 's');
    if (!found.length) {
      var empty = document.createElement('div'); empty.className = 'help-empty';
      empty.append(text('span','▷','help-empty-icon'), text('h3', videos.length ? 'No videos match your search' : 'Video tutorials coming soon'), text('p', videos.length ? 'Try another topic or search term.' : 'Video resources will appear here when they are available. You can use the written guides below in the meantime.'));
      list.appendChild(empty);
    }
    found.slice((page-1)*pageSize,page*pageSize).forEach(function (r) {
      var card = document.createElement('article'); card.className = 'help-video-card';
      var visual = text(r.type === 'link' ? 'a' : 'button','▶','help-video-visual');
      visual.setAttribute('aria-label','Watch '+r.title+(r.type === 'link' ? ' (opens in a new tab)' : ''));
      if(r.type === 'link') { visual.href = safeUrl(r.src,false); visual.target = '_blank'; visual.rel = 'noopener noreferrer'; }
      else { visual.type = 'button'; visual.addEventListener('click',function () { openVideo(r); }); }
      if(safeUrl(r.poster,true)) { visual.textContent = ''; var thumbnail = document.createElement('img'); thumbnail.src = safeUrl(r.poster,true); thumbnail.alt = ''; thumbnail.loading = 'lazy'; visual.appendChild(thumbnail); visual.appendChild(text('span','▶','help-play-icon')); }
      if(r.duration) visual.appendChild(text('span',r.duration,'help-duration'));
      card.append(visual,text('span',r.category || 'Video guide','help-topic'),text('h3',r.title),text('p',r.description || 'Follow this C.R.O.P video walkthrough.'));
      var action = document.createElement(r.type === 'link' ? 'a' : 'button'); action.className = 'help-video-action';
      if(r.type === 'link') { action.href = safeUrl(r.src,false); action.target = '_blank'; action.rel = 'noopener noreferrer'; action.textContent = 'Watch video ↗'; action.setAttribute('aria-label','Watch '+r.title+' (opens in a new tab)'); }
      else { action.type = 'button'; action.textContent = 'Watch video'; action.setAttribute('aria-label','Watch '+r.title); action.addEventListener('click',function () { openVideo(r); }); }
      card.appendChild(action); list.appendChild(card);
    });
    var pager = content.querySelector('#help-video-pages'); pager.replaceChildren();
    if(found.length > pageSize) { var prev = text('button','Previous'), next = text('button','Next'); prev.type = next.type = 'button'; prev.disabled = page === 1; next.disabled = page === totalPages;
      prev.onclick = function () { page--; render(); }; next.onclick = function () { page++; render(); };
      pager.append(prev,text('span','Page '+page+' of '+totalPages),next);
    }
    var grid = content.querySelector('#help-guides'); grid.replaceChildren();
    content.querySelector('#help-guide-count').textContent = filteredGuides.length + ' guide' + (filteredGuides.length === 1 ? '' : 's');
    if(!filteredGuides.length) grid.appendChild(text('p','No guides match your search. Try another topic or search term.','help-empty'));
    filteredGuides.forEach(function (g) { var details = document.createElement('details'); details.className = 'help-guide'; details.id = 'help-guide-'+g.id;
      var summary = document.createElement('summary'); summary.append(text('span',g.category,'help-topic'),text('h3',g.title),text('p',g.description),text('span','Read guide +','help-read'));
      var steps = document.createElement('ol'); g.steps.forEach(function (step) { steps.appendChild(text('li',step)); }); details.append(summary,steps); grid.appendChild(details);
    });
    content.querySelector('#help-result-status').textContent = found.length+' videos and '+filteredGuides.length+' guides found.';
  }
  var select = content.querySelector('#help-category'); categories.concat(videos.map(function (v) { return v.category; }).filter(Boolean)).filter(function (v,i,a) { return a.indexOf(v) === i; }).forEach(function (name) { var option = text('option',name); option.value = name; select.appendChild(option); });
  select.addEventListener('change',function () { category = select.value; page = 1; render(); });
  content.querySelector('#help-search').addEventListener('input',function (e) { query = e.target.value.trim().toLowerCase(); page = 1; render(); });
  content.querySelector('#help-start').addEventListener('click',function () { category = 'Getting Started'; query = ''; page = 1; select.value = category; content.querySelector('#help-search').value = ''; render(); var guide = content.querySelector('#help-guide-start'); guide.open = true; guide.querySelector('summary').focus(); guide.scrollIntoView({behavior:'smooth',block:'center'}); });
  var originalShowView = window.showView;
  window.showView = function (name) { if(dialog.open && name !== 'crop-help') dialog.close(); return originalShowView.apply(this,arguments); };
  render();
}());

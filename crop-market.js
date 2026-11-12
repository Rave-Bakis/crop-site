(function () {
  'use strict';
  // Preview exchange rate, deliberately fixed rather than a live FX quote.
  var rate = 1500, key = 'crop-market-v1', saved, originals = new WeakMap();
  try { saved = JSON.parse(localStorage.getItem(key) || 'null'); } catch (_) {}
  var zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var usZones = /^(America\/(New_York|Detroit|Kentucky\/.*|Indiana\/.*|Chicago|Menominee|North_Dakota\/.*|Denver|Boise|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Metlakatla|Yakutat|Nome|Adak)|Pacific\/Honolulu)$/;
  var country = saved && /^(NG|US)$/.test(saved.country) ? saved.country : zone === 'Africa/Lagos' ? 'NG' : usZones.test(zone) ? 'US' : null;
  var market = window.cropMarket = {
    country: country, currency: country === 'US' ? 'USD' : 'NGN', rate: rate,
    toLocal: function (n) { return Number(n) / (market.country === 'US' ? rate : 1); },
    toBase: function (n) { return Number(n) * (market.country === 'US' ? rate : 1); },
    validInput: function (value) { return /^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(String(value).trim()) && Number(value)>0; },
    format: function (n, digits) {
      return new Intl.NumberFormat(market.country === 'US' ? 'en-US' : 'en-NG', {style:'currency',currency:market.currency,minimumFractionDigits:digits == null ? 2 : digits,maximumFractionDigits:market.country === 'US' ? 2 : digits == null ? 2 : digits}).format(market.toLocal(n));
    },
    // Models retain NGN base amounts. Form entries use the selected market's currency.
    parse: function (value) {
      var text = String(value == null ? '' : value), numeric = text.trim();
      var n = Number(/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(numeric) ? numeric : text.replace(/[^\d.-]/g,'')) || 0;
      return /₦|NGN/.test(text) ? n : /\$|USD/.test(text) ? Math.round(n * rate * 100) / 100 : market.toBase(n);
    },
    input: function (n) { return market.toLocal(n).toFixed(2); },
    read: function (element) {
      if(!element)return 0;
      var value=element.tagName==='INPUT'?element.value:element.textContent, original=originals.get(element);
      if(original && original.local===value)return original.base;
      if(element.hasAttribute('data-base-amount') && market.input(element.dataset.baseAmount)===value)return Number(element.dataset.baseAmount);
      return market.parse(value);
    },
    text: function (value) {
      var text = String(value);
      if (market.country !== 'US') return text;
      return text.replace(/₦\s*(-?[\d,]+(?:\.\d+)?)([KMB])?/gi, function (_, amount, suffix) {
        var multiplier = suffix ? {K:1e3,M:1e6,B:1e9}[suffix.toUpperCase()] : 1;
        return market.format(Number(amount.replace(/,/g,'')) * multiplier);
      }).replace(/₦/g,'$').replace(/\bNGN\b/g,'USD');
    },
    choose: function (code) {
      if (!/^(NG|US)$/.test(code)) return;
      try { localStorage.setItem(key, JSON.stringify({country:code,manual:true})); } catch (_) { alert('Enable browser storage to save your country and currency.'); return; }
      // A reload keeps all legacy renderers and open forms on a single denomination.
      if (code !== market.country) window.location.reload();
    }
  };
  function start() {
    var nav = document.querySelector('.mkt-nav-right');
    if (nav) {
      var control = document.createElement('label'); control.className = 'crop-country';
      control.innerHTML = '<span class="crop-country-flag" aria-hidden="true"></span><span class="crop-country-label">Country</span><select aria-label="Country and currency"><option value="" disabled>Select country</option><option value="NG">NG</option><option value="US">US</option></select>';
      control.querySelector('.crop-country-flag').textContent = country === 'NG' ? '🇳🇬' : country === 'US' ? '🇺🇸' : '🌐';
      var select = control.querySelector('select'); select.value = country || '';
      select.onchange = function () { market.choose(this.value); }; nav.prepend(control);
      control.title = country ? (country === 'NG' ? 'Nigeria · NGN' : 'United States · USD') + ' · Preview rate: ₦1,500 = US$1' : 'Available in Nigeria and the United States. Select your country.';
    }
    var note = document.createElement('p'); note.className = 'crop-fx-note';
    note.textContent = 'Available in Nigeria and the United States. Preview exchange rate: ₦1,500 = US$1.';
    var pricing = document.getElementById('pricing'); if (pricing) pricing.appendChild(note);
    // The landing illustration originally contains USD examples; align them with NG.
    if (market.country !== 'US') {
      var walker = document.createTreeWalker(document.getElementById('view-landing'), NodeFilter.SHOW_TEXT), node;
      while ((node = walker.nextNode())) if (!node.parentElement.closest('script,style,.crop-fx-note,.crop-country')) node.nodeValue = node.nodeValue.replace(/\$([\d,]+(?:\.\d+)?)/g, function (_, value) { return market.format(Number(value.replace(/,/g,'')) * rate, 0); });
    }
    function currencies() {
      ['ob-currency','sys-currency'].forEach(function(id){var el=document.getElementById(id);if(!el)return;el.replaceChildren(new Option(market.currency+' — '+(market.currency==='USD'?'US Dollar':'Nigerian Naira'),market.currency));el.value=market.currency;el.disabled=true;el.title='Determined by your country';});
      var countryInput=document.getElementById('ob-country');if(countryInput){countryInput.innerHTML='<option>Nigeria</option><option>United States</option>';countryInput.value=market.country==='US'?'United States':'Nigeria';countryInput.disabled=true;countryInput.title='Choose your country on the landing page';}
    }
    currencies();
    // Convert the original numeric seed values once. Blank amounts are entered locally.
    if (market.country === 'US') {
      document.querySelectorAll('input[value]').forEach(function(input){
        if(!input.value || /₦|\$/.test(input.value) || !/^[\d,.]+$/.test(input.value))return;
        var label=input.id && document.querySelector('label[for="'+input.id+'"]');
        var context=(label?label.textContent:input.parentElement.previousElementSibling?.textContent||'');
        var cost=input.classList.contains('gra-received-input') && input.closest('tr')?.querySelectorAll('.gra-received-input')[1]===input;
        if(cost || /^(recpay-amount|np-unit-price-edit|loyaltycfg-(earnrate|rate))$/.test(input.id) || /(?:Bundle Price|Stock Cost Price)/i.test(context)) {var base=Number(input.value.replace(/,/g,''));input.value=market.input(base);originals.set(input,{base:base,local:input.value});}
      });
    }
    function localize(node) {
      if (node.nodeType === 3) {
        if (!node.parentElement || node.parentElement.closest('script,style,textarea,option,.crop-fx-note,.crop-country,[contenteditable]')) return;
        var text = market.text(node.nodeValue); if (text !== node.nodeValue) {var before=node.parentElement.textContent,base=market.parse(before);node.nodeValue = text;if(/₦\s*[\d,]/.test(before))originals.set(node.parentElement,{base:base,local:node.parentElement.textContent});}
      } else if (node.nodeType === 1) {
        if (node.matches('script,style,.crop-fx-note,.crop-country')) return;
        ['placeholder','aria-label','title'].forEach(function(attr){if(node.hasAttribute(attr)){var value=node.getAttribute(attr),text=market.text(value);if(text!==value)node.setAttribute(attr,text);}});
        // Legacy cash-entry fields contain a symbol in their initial value.
        if (node.tagName === 'INPUT' && /₦/.test(node.value)) node.value = market.text(node.value);
        Array.from(node.childNodes).forEach(localize);
      }
    }
    localize(document.body);
    var observer = new MutationObserver(function(records){records.forEach(function(record){if(record.type==='characterData')localize(record.target);else if(record.type==='attributes')localize(record.target);else record.addedNodes.forEach(localize);});});
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title']});
    market.refresh = function () { localize(document.body); };
    window.dispatchEvent(new Event('crop-market-ready'));
    // Country-only lookup; no GPS permission, account information, or form data is sent.
    if (!(saved && saved.manual) && typeof fetch === 'function' && location.protocol !== 'file:') {
      var controller = new AbortController(), timer = setTimeout(function(){controller.abort();},3000);
      fetch('https://ipapi.co/country/', {signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'})
        .then(function(response){if(!response.ok)throw Error('Country unavailable');return response.text();})
        .then(function(value){var code=value.trim();if(!/^(NG|US)$/.test(code))return;try{var latest=JSON.parse(localStorage.getItem(key)||'null');if(latest&&latest.manual)return;localStorage.setItem(key,JSON.stringify({country:code,manual:false}));}catch(_){return;}if(code!==country&&document.getElementById('view-landing').classList.contains('active')&&!document.querySelector('input:focus,textarea:focus'))location.reload();})
        .catch(function(){/* Country selector remains available offline or after lookup failure. */})
        .finally(function(){clearTimeout(timer);});
    }
  }
  document.addEventListener('DOMContentLoaded', start);
}());

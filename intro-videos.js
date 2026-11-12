(function () {
  'use strict';
  var resources=window.cropIntroVideos;
  if(!resources)return;
  var dialog=document.createElement('dialog');
  dialog.id='intro-video-player';dialog.className='help-player intro-video-player';
  dialog.setAttribute('aria-labelledby','intro-video-title');
  dialog.innerHTML='<div class="help-player-head"><h2 id="intro-video-title"></h2><button type="button" aria-label="Close video"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div><div id="intro-video-body"></div>';
  document.body.appendChild(dialog);
  var body=dialog.querySelector('#intro-video-body');
  function clearVideo(){var video=body.querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}body.replaceChildren();}
  function openVideo(key){
    var resource=resources[key];if(!resource)return;
    clearVideo();dialog.querySelector('h2').textContent=resource.title;
    var video=document.createElement('video');video.src=resource.src;video.poster=resource.poster;
    video.controls=true;video.autoplay=true;video.playsInline=true;video.preload='metadata';
    video.setAttribute('aria-label',resource.title);
    var error=document.createElement('p');error.hidden=true;error.setAttribute('role','alert');error.textContent='This video could not be loaded. Please close it and try again.';
    video.addEventListener('error',function(){error.hidden=false;});body.append(video,error);
    dialog.showModal();var playback=video.play();if(playback)playback.catch(function(){});
  }
  document.querySelectorAll('[data-intro-video]').forEach(function(button){button.addEventListener('click',function(){openVideo(button.dataset.introVideo);});});
  dialog.querySelector('button').onclick=function(){dialog.close();};
  dialog.addEventListener('close',clearVideo);
  dialog.addEventListener('click',function(event){if(event.target!==dialog)return;var r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  var hero=document.getElementById('hero-get-started');
  if(hero)hero.onclick=function(){var pricing=document.querySelector('#view-landing .mkt-nav-links a[href="#pricing"]');if(pricing)pricing.click();};
  var original=window.showView;
  window.showView=function(){if(dialog.open)dialog.close();return original.apply(this,arguments);};
}());

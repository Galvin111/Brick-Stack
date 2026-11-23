(function(){
var app=document.getElementById('app'), nav=document.getElementById('nav');
var st=null, req=null, tab='queue', form={name:'',skill:'Intermediate',party:'Solo'}, err='', busy=false, loaded={s:false}, seenAt=0;
var LOGO='<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="5" width="26" height="7" rx="3.5" fill="#A93F27"/><rect x="1" y="14" width="26" height="7" rx="3.5" fill="#25201D"/><rect x="1" y="23" width="26" height="7" rx="3.5" fill="#A93F27"/><circle cx="28.5" cy="11" r="4" fill="#D4E64A"/></svg>';
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ini(n){var p=String(n).trim().split(/\s+/);return (p[0][0]+(p[1]?p[1][0]:'')).toUpperCase();}
function first(n){return String(n).trim().split(/\s+/)[0];}
function clock(t){var s=Math.max(0,Math.floor((Date.now()-t)/1000)),m=Math.floor(s/60);s%=60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;}
function P(id){return st&&st.players.filter(function(p){return p.id===id;})[0]||null;}
function nm(id){var p=P(id);return p?p.name:'?';}
function free(){return st.courts.filter(function(c){return !c.game;}).length;}
/* minutes until group number g (1-based) gets a court, from a rough 12 minute game */
function eta(g){var c=st.courts.length||1,w=Math.ceil(Math.max(0,g-free())/c);return w*12;}
function groups(){if(st.preview&&st.preview.length)return st.preview.map(function(g){return g.ids;});var size=st.settings.size||4,out=[];for(var i=0;i<st.queue.length;i+=size)out.push(st.queue.slice(i,i+size));return out;}
function head(){return '<div class="bar"><div class="mark">'+LOGO+'<div>brickstack<small>The Brick Club</small></div></div>'+(req&&P(req.playerId)?'<div class="avatar">'+esc(ini(req.name))+'</div>':'')+'</div>';}

function summary(){
  var open=st&&st.sessionOpen, size=st?st.settings.size||4:4, q=st?st.queue.length:0;
  var wait=st?eta(Math.ceil((q+1)/size)):0;
  return '<div class="dark"><div class="row"><span class="tag'+(open?'':' off')+'">'+(open?'LIVE NOW':'CLOSED')+'</span></div><h2>Open play · The Brick Club</h2><div class="tiles"><div><b>'+(st?st.courts.length:0)+'</b><span>courts</span></div><div><b>'+q+'</b><span>in queue</span></div><div><b>'+(open&&wait?'~'+wait+'m':open?'Now':'-')+'</b><span>wait</span></div></div></div>';
}
function seg(key,opts,cls){return '<div class="seg">'+opts.map(function(o){return '<button type="button" class="'+cls+'" data-set="'+key+'" data-v="'+o+'" aria-pressed="'+(form[key]===o)+'">'+o+'</button>';}).join('')+'</div>';}
function joinCard(note){
  return '<div class="card"><label class="l" for="nm">Your name</label><input id="nm" class="field" type="text" maxlength="30" autocomplete="name" enterkeyhint="done" placeholder="e.g. Juan Dela Cruz" value="'+esc(form.name)+'"><div class="err" role="alert">'+esc(err)+'</div>'+
    '<label class="l">Your skill level <span style="font-weight:400;color:var(--muted)">(rate yourself)</span></label>'+seg('skill',['Beginner','Novice','Intermediate','Advanced','Expert'],'s')+
    '<button class="btn" data-go="join"'+(busy?' disabled':'')+'>Ask to join →</button></div><p class="foot">'+(note||'The organizer approves you before you’re added to the queue.')+'</p>';
}
function viewHome(){
  var h=head();
  if(!st||!st.sessionOpen){
    return h+'<h1 class="big">Open play</h1><p class="sub">Check-ins aren’t open yet. This page updates by itself the moment the organizer opens them.</p>'+summary();
  }
  h+='<h1 class="big">Open play tonight</h1><p class="sub">Ask to join and we’ll call you when a court opens.</p>'+summary();
  if(req&&req.status==='pending'){
    return h+'<div class="card"><h2>Request sent</h2><p class="sub" style="margin-bottom:14px">Hang tight, '+esc(first(req.name))+'. The organizer is checking you in. This page updates by itself once you’re approved.</p><button class="btn out" data-go="leave">Cancel request</button></div>';
  }
  if(req&&req.status==='declined')return h+'<div class="card"><h2>Not added this time</h2><p class="sub" style="margin-bottom:0">The organizer couldn’t add you. Find them at the courts, or ask again below.</p></div>'+joinCard();
  if(req&&req.status==='removed')return h+'<div class="card"><h2>You were removed from the queue</h2><p class="sub" style="margin-bottom:0">Ask again below, or find the organizer.</p></div>'+joinCard();
  return h+joinCard(req&&req.status==='left'?'You left the queue. You can ask to join again.':'');
}
function where(p){
  for(var i=0;i<st.courts.length;i++){var c=st.courts[i];if(c.game&&(c.game.a.indexOf(p.id)>=0||c.game.b.indexOf(p.id)>=0))return c;if(c.hold.indexOf(p.id)>=0)return c;}
  return null;
}
function viewQueue(p){
  var h=head();
  if(p.status==='break')return h+'<div class="card"><h2>You’re out of the queue</h2><p class="sub" style="margin-bottom:14px">You’re still checked in to open play. Tap below when you’re ready and you’ll join the back of the line.</p><button class="btn" data-go="back"'+(req.want==='play'?' disabled>Rejoining…':'>Rejoin queue</button>').replace('Rejoining…','Rejoining…</button>')+'</div>';
  if(p.status==='court'||p.status==='hold'){
    var c=where(p), g=c&&c.game, mine=g?(g.a.indexOf(p.id)>=0?g.a:g.b):[], opp=g?(g.a.indexOf(p.id)>=0?g.b:g.a):[];
    var brk=(req.want==='break'||p.breakNext)?'<p class="foot" style="margin:0 0 12px">You’ll leave the queue after this game.</p>':'';
    return h+brk+'<div class="spot"><small>YOU’RE ON</small><div class="num"><b>'+(c?c.id:'')+'</b><div><strong>Court '+(c?c.id:'')+'</strong>Pick your partners and have fun</div></div>'+(g?'<div class="chips"><span class="you">You</span>'+mine.concat(opp).filter(function(i){return i!==p.id;}).map(function(i){return '<span>'+esc(first(nm(i)))+'</span>';}).join('')+'</div>':'')+'</div>'+((req.want==='break'||p.breakNext)?'':'<button class="btn out" data-go="break">Leave queue after this game</button>');
  }
  var gs=groups(), gi=0, size=st.settings.size||4;
  gs.forEach(function(g,i){if(g.indexOf(p.id)>=0)gi=i;});
  var mates=gs[gi]||[p.id];
  var openCourt=st.courts.filter(function(c){return !c.game;})[0];
  var wait=eta(gi+1);
  var chips='';
  for(var i=Math.max(0,gi-2);i<gi;i++)chips+='<span>Group '+(i+1)+'</span>';
  chips+='<span class="you">You</span>';
  h+='<div class="spot"><small>YOUR SPOT</small><div class="num"><b>'+(gi+1)+'</b><div><strong>in line</strong>'+(wait?'Next court in ~'+wait+' min':'You’re up next')+'</div></div><div class="chips">'+chips+'</div></div>';
  h+='<div class="card"><div class="head"><h2 style="margin:0">Your group</h2><span>'+(size===2?'Singles':'Doubles')+' · '+esc(p.skill||'Open')+'</span></div><div class="people">';
  var cls=['','brick','lime'];
  mates.forEach(function(id,i){var me=id===p.id;h+='<div><div class="avatar '+(me?'':cls[(i%2)+1])+'" style="'+(me?'':'')+'">'+esc(ini(nm(id)))+'</div>'+(me?'You':esc(first(nm(id))))+'</div>';});
  for(var k=mates.length;k<size;k++)h+='<div><div class="avatar open">+</div>Open</div>';
  h+='</div></div>';
  if(gi>0){
    h+='<div class="card"><h2>Ahead of you</h2>';
    for(var j=Math.max(0,gi-3);j<gi;j++){
      var tag=j===0?(openCourt?'<span class="pill">Court '+openCourt.id+'</span>':'<span class="pill line">Next up</span>'):'';
      h+='<div class="ahead"><span class="n">'+(j+1)+'</span><span class="w">'+esc(gs[j].map(function(i){return first(nm(i));}).join(', '))+'</span>'+tag+'</div>';
    }
    h+='</div>';
  }
  return h+'<button class="btn out" data-go="break"'+(req.want==='break'?' disabled>Leaving queue…</button>':'>Leave queue</button>')+'<p class="foot">You stay checked in and can rejoin any time.</p>';
}
function viewCourts(){
  var h=head()+'<div class="head"><h1 class="big" style="margin:0">Courts</h1><span class="pill" style="background:var(--surface)">Live · '+st.courts.filter(function(c){return c.game;}).length+' of '+st.courts.length+' in play</span></div>';
  var gs=groups(), me=req&&P(req.playerId), mc=me?where(me):null;
  st.courts.forEach(function(c){
    if(c.game){
      h+='<div class="court'+(mc&&mc.id===c.id?' me':'')+'"><div class="h"><h3>Court '+c.id+'</h3><span class="pill dk">In play</span><b data-clock="'+c.game.start+'">'+clock(c.game.start)+'</b></div><div class="t">'+esc(c.game.a.concat(c.game.b).map(function(i){return first(nm(i));}).join(' · '))+'</div></div>';
    }else{
      h+='<div class="court o"><div class="h"><h3>Court '+c.id+'</h3><span class="pill open">Open</span></div><div class="t">'+(gs[0]&&gs[0].length>=(st.settings.size||4)?'Group 1 is heading over: '+esc(gs[0].map(function(i){return first(nm(i));}).join(', ')):'Waiting for the next group.')+'</div></div>';
    }
  });
  return h;
}
function render(){
  if(!loaded.s)return;
  var me=req&&req.status==='approved'?P(req.playerId):null;
  if(req&&req.status==='approved'&&!me&&st&&!seenAt)seenAt=Date.now();
  if(me||!req||req.status!=='approved')seenAt=0;
  var html, lost=req&&req.status==='approved'&&!me&&st;
  if(lost&&Date.now()-seenAt<6000)setTimeout(render,6200);
  if(lost&&Date.now()-seenAt<6000)html=head()+'<div class="card"><h2>Checking you in…</h2><p class="sub" style="margin:0">You’ve been approved. Getting your spot in the queue.</p></div>';
  else if(lost)html=head()+'<div class="card"><h2>You’re not in the queue</h2><p class="sub" style="margin-bottom:14px">The organizer may have cleared the list. Ask to join again.</p><button class="btn" data-go="leave">Ask to join again</button></div>';
  else if(!st)html=head()+'<h1 class="big">Open play</h1><p class="sub">Check-ins aren’t open yet. This page updates by itself the moment the organizer opens them.</p>';
  else if(me&&tab==='queue')html=viewQueue(me);
  else if(tab==='courts'&&st)html=viewCourts();
  else html=viewHome();
  var active=document.activeElement&&document.activeElement.id==='nm';
  app.innerHTML=html;
  nav.hidden=!st;
  nav.querySelectorAll('button').forEach(function(b){if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  if(active){var i=document.getElementById('nm');if(i){i.focus();i.setSelectionRange(form.name.length,form.name.length);}}
}
document.addEventListener('input',function(e){if(e.target.id==='nm'){form.name=e.target.value;}});
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-tab],[data-set],[data-go]');if(!t)return;
  if(t.dataset.tab){tab=t.dataset.tab;render();return;}
  if(t.dataset.set){form[t.dataset.set]=t.dataset.v;render();return;}
  if(t.dataset.go==='leave'){Store.leave();return;}
  if(t.dataset.go==='break'){Store.setWant('break');return;}
  if(t.dataset.go==='back'){Store.setWant('play');return;}
  if(t.dataset.go==='join'){
    var n=form.name.trim();
    if(!n){err='Enter your name first.';render();return;}
    if(!/^[\p{L}\p{N}][\p{L}\p{M}\p{N} .'’-]{0,29}$/u.test(n)){err='Use letters, numbers, spaces, dots, apostrophes or hyphens only.';render();return;}
    err='';busy=true;render();
    Store.submit({name:n.slice(0,30),skill:form.skill,party:'Solo'}).then(function(){busy=false;},function(){busy=false;err='Could not send your request. Check your connection and try again.';render();});
  }
});
document.addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.id==='nm'){var b=document.querySelector('[data-go="join"]');if(b)b.click();}});
Store.watchState(function(s){st=s;loaded.s=true;render();});
Store.watchMine(function(r){req=r;render();});
render();
setInterval(function(){document.querySelectorAll('[data-clock]').forEach(function(el){el.textContent=clock(+el.dataset.clock);});},1000);
})();

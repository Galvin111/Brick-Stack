(function(){
var app=document.getElementById('app'), nav=document.getElementById('nav');
var st=null, req=null, tab='queue', form={name:'',skill:'Intermediate',party:'Solo'}, err='', busy=false, loaded={s:false}, seenAt=0;
var LEVELS=['Beginner','Novice','Intermediate','Advanced','Expert'];
var ARROW='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="square" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function ini(n){var p=String(n).trim().split(/\s+/);return (p[0][0]+(p[1]?p[1][0]:'')).toUpperCase();}
function first(n){return String(n).trim().split(/\s+/)[0];}
function plural(n,w){return n+' '+w+(n===1?'':'s');}
function clock(t){var s=Math.max(0,Math.floor((Date.now()-t)/1000)),m=Math.floor(s/60);s%=60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;}
function P(id){return st&&st.players.filter(function(p){return p.id===id;})[0]||null;}
function nm(id){var p=P(id);return p?p.name:'?';}
function free(){return st.courts.filter(function(c){return !c.game;}).length;}
/* minutes until group number g (1-based) gets a court, from a rough 12 minute game */
function eta(g){var c=st.courts.length||1,w=Math.ceil(Math.max(0,g-free())/c);return w*12;}
function groups(){if(st.preview&&st.preview.length)return st.preview.map(function(g){return g.ids;});var size=st.settings.size||4,out=[];for(var i=0;i<st.queue.length;i+=size)out.push(st.queue.slice(i,i+size));return out;}
function head(){
  var right='';
  if(req&&P(req.playerId))right='<span class="me" role="img" aria-label="Signed in as '+esc(req.name)+'">'+esc(ini(req.name))+'</span>';
  else if(st)right='<span class="status'+(st.sessionOpen?'':' off')+'">'+(st.sessionOpen?'Check-ins open':'Check-ins closed')+'</span>';
  return '<header class="bar"><span class="brand"><img src="assets/brand/mark.svg" alt="" width="43" height="30"><span>brick club</span></span>'+right+'</header>';
}
function intro(open){return (open?'<p class="kicker">Tonight</p>':'')+'<h1 class="display">Open <em>play</em></h1>';}

function summary(){
  var open=st&&st.sessionOpen, size=st?st.settings.size||4:4, q=st?st.queue.length:0;
  var wait=st?eta(Math.ceil((q+1)/size)):0;
  return '<div class="stats"><div><b>'+(st?st.courts.length:0)+'</b><span>Courts</span></div><div><b>'+q+'</b><span>In queue</span></div><div><b>'+(open&&wait?wait+'<small>MIN</small>':open?'NOW':'–')+'</b><span>Est. wait</span></div></div>';
}
function scale(){
  return '<div class="lvl-head"><span id="lvl-l">Skill level <i>(rate yourself)</i></span><b>'+esc(form.skill)+'</b></div>'+
    '<div class="scale" role="group" aria-labelledby="lvl-l">'+LEVELS.map(function(o,i){return '<button type="button" data-set="skill" data-v="'+o+'" aria-pressed="'+(form.skill===o)+'" aria-label="'+(i+1)+', '+o+'">'+(i+1)+'</button>';}).join('')+'</div>'+
    '<div class="scale-ends" aria-hidden="true"><span>Beginner</span><span>Expert</span></div>';
}
function joinCard(note){
  return '<label class="l" for="nm">Your name</label><input id="nm" class="field" type="text" maxlength="30" autocomplete="name" enterkeyhint="done" placeholder="e.g. Juan Dela Cruz" value="'+esc(form.name)+'"><div class="err" role="alert">'+esc(err)+'</div>'+
    scale()+'<button class="btn go" data-go="join"'+(busy?' disabled':'')+'>Ask to join'+ARROW+'</button><p class="foot">'+(note||'The organizer approves you before you’re added to the queue.')+'</p>';
}
function panel(title,text,extra){return '<div class="panel"><h2>'+title+'</h2><p>'+text+'</p>'+(extra||'')+'</div>';}
function viewHome(){
  var h=head();
  if(!st||!st.sessionOpen){
    return h+intro(false)+'<p class="sub">Check-ins aren’t open yet. This page updates by itself the moment the organizer opens them.</p>'+summary();
  }
  h+=intro(true)+summary();
  if(req&&req.status==='pending'){
    return h+panel('Request sent','Hang tight, '+esc(first(req.name))+'. The organizer is checking you in. This page updates by itself once you’re approved.','<button class="btn out" data-go="leave">Cancel request</button>');
  }
  if(req&&req.status==='declined')return h+panel('Not added this time','The organizer couldn’t add you. Find them at the courts, or ask again below.')+joinCard();
  if(req&&req.status==='removed')return h+panel('You were removed from the queue','Ask again below, or find the organizer.')+joinCard();
  return h+joinCard(req&&req.status==='left'?'You left the queue. You can ask to join again.':'');
}
function where(p){
  for(var i=0;i<st.courts.length;i++){var c=st.courts[i];if(c.game&&(c.game.a.indexOf(p.id)>=0||c.game.b.indexOf(p.id)>=0))return c;if(c.hold.indexOf(p.id)>=0)return c;}
  return null;
}
function viewQueue(p){
  var h=head();
  if(p.status==='break')return h+panel('You’re out of the queue','You’re still checked in to open play. Tap below when you’re ready and you’ll join the back of the line.','<button class="btn" data-go="back"'+(req.want==='play'?' disabled>Rejoining…':'>Rejoin queue')+'</button>');
  if(p.status==='court'||p.status==='hold'){
    var c=where(p), g=c&&c.game, leaving=req.want==='break'||p.breakNext;
    h+='<div class="title-row"><h1>You’re on</h1><span>'+(g?'Game in progress':'Winners stay on')+'</span></div>';
    h+='<div class="hero"><span class="big">'+(c?c.id:'')+'</span><div class="facts"><div><b>Court '+(c?c.id:'')+'</b><span>Pick your partners and have fun</span></div>'+(g?'<div><b data-clock="'+g.start+'">'+clock(g.start)+'</b><span>on court</span></div>':'')+'</div></div>';
    if(g)h+='<section class="sec"><div class="sec-h"><h2>Playing with</h2></div><ol class="rows">'+g.a.concat(g.b).filter(function(i){return i!==p.id;}).map(function(i){return '<li><span class="w b">'+esc(nm(i))+'</span></li>';}).join('')+'</ol></section>';
    return h+(leaving?'<p class="foot c">You’ll leave the queue after this game.</p>':'<button class="btn out" data-go="break">Leave queue after this game</button>');
  }
  var gs=groups(), gi=0, size=st.settings.size||4;
  gs.forEach(function(g,i){if(g.indexOf(p.id)>=0)gi=i;});
  var mates=gs[gi]||[p.id];
  var openCourt=st.courts.filter(function(c){return !c.game;})[0];
  var wait=eta(gi+1);
  h+='<div class="title-row"><h1>Your spot</h1><span>'+(size===2?'Singles':'Doubles')+' · '+esc(p.skill||'Open')+'</span></div>';
  h+='<div class="hero"><span class="big">'+(gi+1)+'</span><div class="facts">'+
    (gi?'<div><b>In line</b><span>'+plural(gi,'group')+' ahead of you</span></div>':'<div><b>You’re next</b><span>First group in line</span></div>')+
    (wait?'<div><b>~'+wait+' min</b><span>until a court opens</span></div>':'<div><b>Get ready</b><span>A court is opening</span></div>')+'</div></div>';
  var track='';
  for(var i=Math.max(0,gi-2);i<gi;i++)track+='<div>Group '+(i+1)+'</div>';
  h+='<div class="track" aria-hidden="true">'+track+'<div class="on">You</div></div>';
  h+='<section class="sec"><div class="sec-h"><h2>Your group</h2><span>'+mates.length+' of '+size+'</span></div><ol class="rows">';
  mates.forEach(function(id,i){var me=id===p.id;h+='<li><span class="n">'+(i+1)+'</span><span class="w b">'+esc(nm(id))+'</span>'+(me?'<span class="you">You</span>':'')+'</li>';});
  for(var k=mates.length;k<size;k++)h+='<li><span class="n">'+(k+1)+'</span><span class="w dim">Open spot</span><span class="note">Filled from the queue</span></li>';
  h+='</ol></section>';
  if(gi>0){
    h+='<section class="sec"><div class="sec-h"><h2>Ahead of you</h2></div><ol class="rows">';
    for(var j=Math.max(0,gi-3);j<gi;j++){
      var tag=j===0?(openCourt?'<span class="go-court">Court '+openCourt.id+ARROW+'</span>':'<span class="next">Next up</span>'):'';
      h+='<li><span class="n">'+(j+1)+'</span><span class="w">'+esc(gs[j].map(function(i){return first(nm(i));}).join(', '))+'</span>'+tag+'</li>';
    }
    h+='</ol></section>';
  }
  return h+'<button class="btn out" data-go="break"'+(req.want==='break'?' disabled>Leaving queue…':'>Leave queue')+'</button><p class="foot c">You stay checked in and can rejoin any time.</p>';
}
function viewCourts(){
  var inPlay=st.courts.filter(function(c){return c.game;}).length;
  var h=head()+'<div class="title-row"><h1 class="display">Courts</h1><span class="status">'+inPlay+' of '+st.courts.length+' in play</span></div>';
  var gs=groups(), me=req&&P(req.playerId), mc=me?where(me):null;
  h+='<div class="courts">';
  st.courts.forEach(function(c){
    var mine=mc&&mc.id===c.id?'<span class="you">You</span>':'';
    if(c.game){
      h+='<article class="court"><div class="h"><span class="cn">'+c.id+'</span><div class="cs"><small>Court</small><b>In play</b></div>'+mine+'<span class="clock" data-clock="'+c.game.start+'">'+clock(c.game.start)+'</span></div><div class="t">'+esc(c.game.a.concat(c.game.b).map(function(i){return first(nm(i));}).join(' · '))+'</div></article>';
    }else{
      h+='<article class="court open"><div class="h"><span class="cn">'+c.id+'</span><div class="cs"><small>Court</small><b>Open</b></div>'+mine+'</div><div class="t">'+(gs[0]&&gs[0].length>=(st.settings.size||4)?'Group 1 is heading over: '+esc(gs[0].map(function(i){return first(nm(i));}).join(', ')):'Waiting for the next group.')+'</div></article>';
    }
  });
  return h+'</div>';
}
function render(){
  if(!loaded.s)return;
  var me=req&&req.status==='approved'?P(req.playerId):null;
  if(req&&req.status==='approved'&&!me&&st&&!seenAt)seenAt=Date.now();
  if(me||!req||req.status!=='approved')seenAt=0;
  var html, lost=req&&req.status==='approved'&&!me&&st;
  if(lost&&Date.now()-seenAt<6000)setTimeout(render,6200);
  if(lost&&Date.now()-seenAt<6000)html=head()+panel('Checking you in…','You’ve been approved. Getting your spot in the queue.');
  else if(lost)html=head()+panel('You’re not in the queue','The organizer may have cleared the list. Ask to join again.','<button class="btn" data-go="leave">Ask to join again</button>');
  else if(!st)html=head()+intro(false)+'<p class="sub">Check-ins aren’t open yet. This page updates by itself the moment the organizer opens them.</p>';
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

(function(){
var KEY='nextup-session-v1';
var VIEWS=['courts','players','standings','setup'];
var SAMPLE=['Maya','Dario','Priya','Tomás','Lena','Kofi','Jun','Farah','Beck','Noor'];
function fresh(){return{players:[],queue:[],courts:[{id:1,game:null,hold:[]},{id:2,game:null,hold:[]}],history:[],settings:{size:4,rotation:'off',mode:'social',auto:false},nextId:1,started:Date.now(),sessionOpen:false};}
function norm(s){if(s&&Array.isArray(s.players)&&Array.isArray(s.courts)&&s.settings){s.queue=s.queue||[];s.history=s.history||[];s.courts.forEach(function(c){c.hold=c.hold||[];c.game=c.game||null;});if(!s.started)s.started=Date.now();if(!s.settings.mode)s.settings.mode='social';s.met=s.met||{};return s;}return fresh();}
var after=[], handled={};
/* phone notices (approved, removed) go out only once the session itself is saved, so a phone never sees "approved" before the queue has the player */
function save(){S.preview=previewGroups().map(function(g){return {ids:g};});var q=after.splice(0);Store.saveState(S).then(function(){q.forEach(function(f){f();});},function(){toast('Could not save. Check your connection.');});}
var S=fresh(), reqs=[], user=null, booted=false, watching=false, app=document.getElementById('app'), dlg=document.getElementById('dlg'), toastEl=document.getElementById('toast'), foot=document.getElementById('side-foot');
var dstate=null, armed=null, toastT=null, focusAdd=false;

function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function P(id){for(var i=0;i<S.players.length;i++)if(S.players[i].id===id)return S.players[i];return null;}
function nm(id){var p=P(id);return p?p.name:'?';}
function C(id){for(var i=0;i<S.courts.length;i++)if(S.courts[i].id===id)return S.courts[i];return null;}
function mins(t){return Math.floor((Date.now()-t)/60000);}
function ago(t){var m=mins(t);return m<1?'just now':m+' min';}
function clock(t){var s=Math.max(0,Math.floor((Date.now()-t)/1000)),m=Math.floor(s/60);s=s%60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;}
function plural(n,w){return n+' '+w+(n===1?'':'s');}
function toast(msg){toastEl.textContent=msg;toastEl.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){toastEl.classList.remove('on');},2600);}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function view(){var h=location.hash.replace('#','');return VIEWS.indexOf(h)>=0?h:'courts';}
function names(ids){return ids.map(nm).join(', ');}

/* ---------- session logic ---------- */
function addPlayers(text){
  var list=text.split(/[,\n]/).map(function(s){return s.trim().slice(0,30);}).filter(Boolean), added=0, dup=0;
  list.forEach(function(n){
    var exists=S.players.some(function(p){return p.name.toLowerCase()===n.toLowerCase();});
    if(exists){dup++;return;}
    var id=S.nextId++;
    S.players.push({id:id,name:n,skill:'Intermediate',status:'queue',games:0,wins:0,since:Date.now(),run:0});
    S.queue.push(id);added++;
  });
  if(added)toast(plural(added,'player')+' added to the queue'+(dup?', '+dup+' already here':''));
  else if(dup)toast('That name is already in this session');
  autoFill();
}
/* a break asked for mid-game, by the organizer (breakNext) or from the player's phone (want) */
function wantsBreak(p){var r=p.uid?reqFor(p.uid):null;return !!p.breakNext||!!(r&&r.status==='approved'&&r.playerId===p.id&&r.want==='break'&&!handled[r.uid+':break']);}
function ackBreak(p){
  p.breakNext=false;
  var r=p.uid?reqFor(p.uid):null;
  if(r&&r.want==='break'&&!handled[r.uid+':break']){handled[r.uid+':break']=true;after.push(function(){Store.patchRequest(r.uid,{want:'ok'});});}
}
function toQueue(ids,front){
  var go=[];
  ids.forEach(function(id){var p=P(id);if(!p)return;p.run=0;
    if(wantsBreak(p)){p.status='break';ackBreak(p);}
    else{p.status='queue';p.since=Date.now();go.push(id);}
  });
  if(front)S.queue=go.concat(S.queue);else S.queue=S.queue.concat(go);
}
var RATE={Beginner:1,Novice:2,Intermediate:3,Advanced:4,Expert:5}, LEVELS=['Beginner','Novice','Intermediate','Advanced','Expert'], SKIP_CAP=2;
function lvl(id){var p=P(id);return RATE[p&&p.skill]||3;}
function mkey(a,b){return a<b?a+'-'+b:b+'-'+a;}
function metN(a,b,k){var m=S.met&&S.met[mkey(a,b)];return m?(m[k]||0):0;}
function noteMet(a,b,k){S.met=S.met||{};var key=mkey(a,b),m=S.met[key]||(S.met[key]={p:0,o:0});m[k]++;}
function combos(arr,n){if(n===0)return [[]];if(arr.length<n)return [];var out=[];for(var i=0;i<=arr.length-n;i++)combos(arr.slice(i+1),n-1).forEach(function(c){out.push([arr[i]].concat(c));});return out;}
/* who plays next. Fair and Social take the front of the line. Level groups keeps the longest waiter,
   then picks the closest levels from the next few in line, and never skips anyone more than SKIP_CAP times in a row. */
function pickIds(q,k,base,commit){
  if(S.settings.mode!=='level'||q.length<=k)return q.slice(0,k);
  var win=q.slice(0,Math.min(q.length,Math.max(k*2,8))), forced=[win[0]];
  win.forEach(function(id,i){if(i>0&&forced.length<k&&(P(id).skips||0)>=SKIP_CAP)forced.push(id);});
  var rest=win.filter(function(id){return forced.indexOf(id)<0;}), best=null;
  combos(rest,k-forced.length).forEach(function(c){
    var r=forced.concat(c).concat(base).map(lvl), spread=Math.max.apply(null,r)-Math.min.apply(null,r);
    var pos=c.reduce(function(s,id){return s+win.indexOf(id);},0), score=spread*100+pos;
    if(!best||score<best.score)best={score:score,ids:forced.concat(c)};
  });
  var ids=best.ids.sort(function(x,y){return q.indexOf(x)-q.indexOf(y);});
  if(commit){
    var top=Math.max.apply(null,ids.map(function(id){return q.indexOf(id);}));
    q.slice(0,top).forEach(function(id){if(ids.indexOf(id)<0)P(id).skips=(P(id).skips||0)+1;});
    ids.forEach(function(id){P(id).skips=0;});
  }
  return ids;
}
/* how four players split into teams */
function split(ids){
  if(ids.length!==4)return [ids.slice(0,ids.length/2),ids.slice(ids.length/2)];
  var opts=[[[0,1],[2,3]],[[0,2],[1,3]],[[0,3],[1,2]]], best=null;
  opts.forEach(function(o){
    var A=[ids[o[0][0]],ids[o[0][1]]], B=[ids[o[1][0]],ids[o[1][1]]];
    var soc=metN(A[0],A[1],'p')*10+metN(B[0],B[1],'p')*10;
    A.forEach(function(x){B.forEach(function(y){soc+=metN(x,y,'o')*3;});});
    var diff=Math.abs(lvl(A[0])+lvl(A[1])-lvl(B[0])-lvl(B[1]));
    var cost=(S.settings.mode==='social'?soc:diff*100+soc)+Math.random()*0.5;
    if(!best||cost<best.cost)best={cost:cost,a:A,b:B};
  });
  return [best.a,best.b];
}
function fillCourt(c){
  var size=S.settings.size, need=size-c.hold.length;
  if(c.game||need<0||S.queue.length<need)return false;
  var take=pickIds(S.queue,need,c.hold,true), a=[], b=[], half=size/2;
  S.queue=S.queue.filter(function(id){return take.indexOf(id)<0;});
  if(c.hold.length){
    c.hold.forEach(function(id,i){(i%2?b:a).push(id);});
    take.forEach(function(id){(a.length<half?a:b).push(id);});
  }else{var t=split(take);a=t[0];b=t[1];}
  a.concat(b).forEach(function(id){P(id).status='court';});
  c.game={a:a,b:b,start:Date.now()};c.hold=[];
  return true;
}
/* the real next groups, in order. Saved with the session so phones and the TV show the same thing. */
function previewGroups(){
  var q=S.queue.slice(), size=S.settings.size, out=[];
  while(q.length){var g=pickIds(q,Math.min(size,q.length),[],false);out.push(g);q=q.filter(function(id){return g.indexOf(id)<0;});}
  return out;
}
function autoFill(){if(S.settings.auto)S.courts.forEach(function(c){if(!c.game)fillCourt(c);});}
function noteGame(a,b){
  [a,b].forEach(function(side){side.forEach(function(x,i){side.slice(i+1).forEach(function(y){noteMet(x,y,'p');});});});
  a.forEach(function(x){b.forEach(function(y){noteMet(x,y,'o');});});
}
/* players may pick their own partners on court; cycle AB|CD -> AC|DB -> AD|BC */
function swapTeams(g){
  if(g.a.length!==2||g.b.length!==2)return;
  var o=[g.a[1],g.b[0],g.b[1]];
  g.a=[g.a[0],o[1]];g.b=[o[2],o[0]];
}
function finish(c,winner,sa,sb){
  var g=c.game, win=g[winner], lose=g[winner==='a'?'b':'a'];
  noteGame(g.a,g.b);
  g.a.concat(g.b).forEach(function(id){P(id).games++;});
  win.forEach(function(id){P(id).wins++;});
  S.history.unshift({court:c.id,a:g.a.map(nm),b:g.b.map(nm),sa:sa,sb:sb,winner:winner,at:Date.now()});
  if(S.history.length>200)S.history.length=200;
  c.game=null;
  if(S.settings.rotation==='stay'){
    var stay=[],off=[];
    win.forEach(function(id){var p=P(id);p.run=(p.run||0)+1;(p.run>=2||wantsBreak(p)?off:stay).push(id);});
    stay.forEach(function(id){P(id).status='hold';});
    c.hold=stay;
    toQueue(off.concat(lose),false);
  }else{
    toQueue(win.concat(lose),false);
  }
  autoFill();
}
function cancelGame(c){var g=c.game;c.game=null;toQueue(g.a.concat(g.b),true);}
function releaseHold(c){var h=c.hold;c.hold=[];toQueue(h,true);}

function pending(){return reqs.filter(function(r){return r.status==='pending';}).sort(function(a,b){return a.at-b.at;});}
function reqFor(uid){return reqs.filter(function(r){return r.uid===uid;})[0]||null;}
/* players who tapped Leave on their phone come off the queue as soon as they are not mid-game */
function processLeaves(){
  var changed=false;
  reqs.forEach(function(r){
    if(r.status!=='left'||!r.playerId)return;
    var p=P(r.playerId);
    if(!p||p.uid!==r.uid||p.status==='court'||p.status==='hold')return;
    S.queue=S.queue.filter(function(x){return x!==p.id;});
    S.players=S.players.filter(function(x){return x.id!==p.id;});
    changed=true;
  });
  /* players who tapped Take a break or I'm back on their phone. Each request is answered once. */
  reqs.forEach(function(r){
    if(r.want!=='break'&&r.want!=='play'){delete handled[r.uid+':break'];delete handled[r.uid+':play'];return;}
    var key=r.uid+':'+r.want;
    if(handled[key]||r.status!=='approved'||!r.playerId)return;
    var p=P(r.playerId);
    if(!p||p.uid!==r.uid)return;
    if(r.want==='break'){
      if(p.status==='queue'){S.queue=S.queue.filter(function(x){return x!==p.id;});p.status='break';}
      else if(p.status!=='break')return;
    }else{
      if(p.status==='break')toQueue([p.id],false);
      else if(p.status!=='queue')return;
    }
    handled[key]=true;changed=true;
    after.push(function(){Store.patchRequest(r.uid,{want:'ok'});});
  });
  if(changed)autoFill();
  return changed;
}

/* ---------- views ---------- */
function courtCard(c){
  var size=S.settings.size, h;
  if(c.game){
    h='<article class="court"><div class="court-head"><h3>Court '+c.id+'</h3><span class="pill">In play</span><span class="clock" data-clock="'+c.game.start+'">'+clock(c.game.start)+'</span></div>';
    h+='<span class="team">'+esc(c.game.a.map(nm).join(' · '))+'</span><div class="vs">VS</div><span class="team b">'+esc(c.game.b.map(nm).join(' · '))+'</span>';
    h+='<div class="court-actions"><button class="btn dark" data-act="result" data-id="'+c.id+'">End game</button>'+(c.game.a.length===2?'<button class="btn quiet" data-act="swap" data-id="'+c.id+'">Swap partners</button>':'')+'</div>';
  }else if(c.hold.length){
    var need=size-c.hold.length, short=need-S.queue.length;
    h='<article class="court open"><div class="court-head"><h3>Court '+c.id+'</h3><span class="pill hold">Winners staying</span></div>';
    h+='<p>'+esc(c.hold.map(nm).join(' · '))+'</p><p class="note" style="margin-top:0">Needs '+need+' more.</p>';
    h+='<div class="court-actions"><button class="btn primary" data-act="fill" data-id="'+c.id+'"'+(short>0?' disabled':'')+'>Start game</button><button class="btn quiet" data-act="release" data-id="'+c.id+'">Clear</button></div>';
    if(short>0)h+='<p class="note">Waiting for '+plural(short,'more player')+' in the queue.</p>';
  }else{
    var miss=size-S.queue.length;
    h='<article class="court open"><div class="court-head"><h3>Court '+c.id+'</h3><span class="pill open">Open</span></div>';
    h+=miss>0?'<p>Waiting for '+plural(miss,'more player')+' in the queue.</p>':'<p>Ready for the next group: '+esc(names(previewGroups()[0]))+'</p>';
    h+='<div class="court-actions"><button class="btn primary" data-act="fill" data-id="'+c.id+'"'+(miss>0?' disabled':'')+'>Start game</button></div>';
  }
  return h+'</article>';
}
function pendingPanel(){
  var list=pending();
  if(!list.length)return '';
  var h='<section class="up pend" aria-label="Waiting for approval"><div class="sec-head"><h2>Waiting for approval</h2><span>'+list.length+'</span></div>';
  list.forEach(function(r){
    h+='<div class="group"><div class="who"><b>'+esc(r.name)+'</b><small>'+esc(r.skill)+' · asked '+ago(r.at)+' ago</small></div><button class="btn primary small" data-act="approve" data-uid="'+esc(r.uid)+'">Approve</button><button class="btn quiet small" data-act="decline" data-uid="'+esc(r.uid)+'" aria-label="Decline '+esc(r.name)+'">Decline</button></div>';
  });
  return h+'</section>';
}
function upNext(){
  var size=S.settings.size, h='<section class="up" aria-label="Up next"><div class="sec-head"><h2>Up next</h2><span>'+plural(S.queue.length,'player')+' · '+plural(Math.ceil(S.queue.length/size),'group')+'</span></div>';
  if(!S.queue.length)h+='<p class="note" style="margin:0 0 12px">The queue is empty. Players come back here when their game ends.</p>';
  var open=S.courts.filter(function(c){return !c.game;})[0];
  previewGroups().forEach(function(g,i){
    var full=g.length===size, first=P(g[0]);
    h+='<div class="group"><span class="n">'+(i+1)+'</span><div class="who"><b>'+esc(names(g))+(full?'':' + '+(size-g.length)+' open')+'</b><small>Waiting <span data-since="'+first.since+'">'+ago(first.since)+'</span> · Levels '+g.map(lvl).join(', ')+'</small></div>';
    if(i===0&&full&&open)h+='<button class="btn dark small" data-act="fill" data-id="'+open.id+'">Send</button>';
    h+='</div>';
  });
  var breaks=S.players.filter(function(p){return p.status==='break';});
  if(breaks.length)h+='<p class="note">Out of the queue: '+esc(breaks.map(function(p){return p.name;}).join(', '))+'. Bring them back from Players.</p>';
  h+='<div class="add-row"><label for="add-in">Add walk-in player</label><div class="add"><input id="add-in" class="field" type="text" autocomplete="off" enterkeyhint="done" placeholder="Player name"><button class="btn primary" data-act="add">Add</button></div></div></section>';
  return h;
}
function courtStepper(){
  var last=S.courts[S.courts.length-1], canRemove=S.courts.length>1&&!last.game&&!last.hold.length;
  return '<div class="cstep" role="group" aria-label="Number of courts"><button class="btn small quiet" data-act="court-less" aria-label="Remove a court"'+(canRemove?'':' disabled')+'>−</button><span><b>'+S.courts.length+'</b> '+(S.courts.length===1?'court':'courts')+'</span><button class="btn small quiet" data-act="court-more" aria-label="Add a court"'+(S.courts.length>=12?' disabled':'')+'>+</button></div>';
}
function joinToggle(){return '<button class="btn small '+(S.sessionOpen?'quiet':'primary')+'" data-act="toggle-join" aria-pressed="'+!!S.sessionOpen+'">'+(S.sessionOpen?'Close check-ins':'Open check-ins')+'</button>';}
function viewCourts(){
  if(!S.players.length&&!pending().length){
    return '<div class="page-head"><div><h1>Live board</h1><p>'+(S.sessionOpen?'Check-ins are open. Players who scan the QR appear here for you to approve.':'Tap Open check-ins so players can scan the QR and ask to join.')+'</p></div><div class="head-r">'+courtStepper()+joinToggle()+'</div></div>'+
      '<div class="empty"><h1>Nobody’s in the queue yet</h1><p>Players who ask to join appear here for approval. You can also add the players who’ve checked in yourself.</p><div class="row"><a class="btn primary" href="#players">Add players</a><button class="btn" data-act="sample">Try it with 10 sample players</button></div></div>';
  }
  var inUse=S.courts.filter(function(c){return c.game;}).length;
  var waits=S.queue.map(function(id){return mins(P(id).since);}), avg=waits.length?Math.round(waits.reduce(function(a,b){return a+b;},0)/waits.length):0;
  var h='<div class="page-head"><div><h1>Live board</h1><p>'+plural(S.queue.length,'player')+' waiting</p></div><div class="head-r"><span class="live">Live · '+inUse+' of '+S.courts.length+' in play</span>'+courtStepper()+joinToggle()+'</div></div>';
  h+='<div class="stats"><div class="stat"><small>Courts in use</small><b>'+inUse+' / '+S.courts.length+'</b></div><div class="stat"><small>In queue</small><b>'+S.queue.length+'</b></div><div class="stat"><small>Average wait</small><b>'+avg+' min</b></div><div class="stat"><small>Games played</small><b>'+S.history.length+'</b></div></div>';
  h+='<div class="board"><section aria-label="Courts"><div class="sec-head"><h2>Courts</h2>'+(S.settings.auto?'<span>Auto-assign: On</span>':'')+'</div><div class="courts">'+S.courts.map(courtCard).join('')+'</div></section>'+'<div>'+pendingPanel()+upNext()+'</div></div>';
  return h;
}
function statusText(p){
  if(p.status==='court'||p.status==='hold'){var c=S.courts.filter(function(c){return (c.game&&c.game.a.concat(c.game.b).indexOf(p.id)>=0)||c.hold.indexOf(p.id)>=0;})[0];return 'On Court '+(c?c.id:'')+(wantsBreak(p)?' · break after this game':'');}
  if(p.status==='break')return 'Out of the queue';
  return 'Number '+(S.queue.indexOf(p.id)+1)+' in the queue';
}
function viewPlayers(){
  var h='<div class="page-head"><div><h1>Players</h1><p>Check people in. They join the back of the queue.</p></div></div>';
  h+='<div class="panel"><h2>Add players</h2><div class="add"><input id="add-in" class="field" type="text" autocomplete="off" enterkeyhint="done" aria-label="Player names" placeholder="Name, or several separated by commas"><button class="btn primary" data-act="add">Add to queue</button></div></div>';
  h+='<div class="panel"><h2>'+plural(S.players.length,'player')+' in this session</h2>';
  if(!S.players.length)h+='<p class="note" style="margin:0">Nobody has checked in yet. Add the first name above.</p>';
  else h+='<ul class="roster">'+S.players.slice().sort(function(a,b){return a.name.localeCompare(b.name);}).map(function(p){
    var busy=p.status==='court'||p.status==='hold';
    return '<li><div class="who"><b>'+esc(p.name)+'</b><small>'+statusText(p)+'</small></div><select class="rate" data-rate="'+p.id+'" aria-label="Level for '+esc(p.name)+'">'+LEVELS.map(function(l){return '<option'+(l===(p.skill||'Intermediate')?' selected':'')+'>'+l+'</option>';}).join('')+'</select>'+
      (p.status==='break'?'<button class="btn small" data-act="rejoin" data-id="'+p.id+'">Rejoin queue</button>':'<button class="btn quiet small" data-act="break" data-id="'+p.id+'">'+(p.status==='court'?(wantsBreak(p)?'Cancel break':'Break after game'):'Break')+'</button>')+
      '<button class="btn quiet small warn" data-act="remove" data-id="'+p.id+'"'+(busy?' disabled':'')+'>Remove</button></li>';
  }).join('')+'</ul>';
  return h+'</div>';
}
function viewStandings(){
  var ps=S.players.filter(function(p){return p.games>0;}).sort(function(a,b){return b.wins-a.wins||(b.wins/b.games-a.wins/a.games)||a.games-b.games||a.name.localeCompare(b.name);});
  if(!ps.length&&!S.history.length)return '<div class="empty"><h1>No results yet</h1><p>Standings fill in as you end games on the Courts tab.</p><div class="row"><a class="btn primary" href="#courts">Go to courts</a></div></div>';
  var h='<div class="page-head"><div><h1>Standings</h1></div></div><div class="panel"><div class="scroll"><table><thead><tr><th>#</th><th>Player</th><th>Won</th><th>Played</th><th>Win %</th></tr></thead><tbody>'+
    ps.map(function(p,i){return '<tr><td>'+(i+1)+'</td><td>'+esc(p.name)+'</td><td>'+p.wins+'</td><td>'+p.games+'</td><td>'+Math.round(100*p.wins/p.games)+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  h+='<div class="panel"><h2>Recent games</h2><ul class="games">'+S.history.slice(0,30).map(function(g){
    var w=g.winner==='a'?g.a:g.b, l=g.winner==='a'?g.b:g.a, ws=g.winner==='a'?g.sa:g.sb, ls=g.winner==='a'?g.sb:g.sa;
    var sc=(ws!=null&&ls!=null)?', '+ws+'–'+ls:'';
    return '<li><b>'+esc(w.join(' & '))+'</b> beat '+esc(l.join(' & '))+sc+'<br><small>Court '+g.court+'</small></li>';
  }).join('')+'</ul></div>';
  return h;
}
function seg(key,opts){return '<div class="seg">'+opts.map(function(o){return '<button class="btn" data-act="set" data-key="'+key+'" data-val="'+o[0]+'" aria-pressed="'+(String(S.settings[key])===String(o[0]))+'">'+o[1]+'</button>';}).join('')+'</div>';}
function viewSetup(){
  var last=S.courts[S.courts.length-1], canRemove=S.courts.length>1&&!last.game&&!last.hold.length;
  var h='<div class="page-head"><div><h1>Setup</h1></div></div><div class="panel"><h2>Session setup</h2>';
  h+='<div class="setting"><h3>Courts</h3><p>'+(S.courts.length>1&&!canRemove?'Court '+last.id+' is in use. Finish its game to remove it.':'How many courts you have for this session.')+'</p><div class="stepper"><button class="btn" data-act="court-less" aria-label="Remove a court"'+(canRemove?'':' disabled')+'>−</button><b>'+S.courts.length+'</b><button class="btn" data-act="court-more" aria-label="Add a court"'+(S.courts.length>=12?' disabled':'')+'>+</button></div></div>';
  h+='<div class="setting"><h3>Game type</h3><p>Applies to the next game sent on.</p>'+seg('size',[[4,'Doubles'],[2,'Singles']])+'</div>';
  h+='<div class="setting"><h3>When a game ends</h3><p>Everyone off sends all players to the back of the queue, winners first. Winners stay keeps them on court, split onto opposite sides, for up to two wins in a row.</p>'+seg('rotation',[['off','Everyone off'],['stay','Winners stay']])+'</div>';
  h+='<div class="setting"><h3>Queue mode</h3><p>'+({social:'Next four in line play. Teams are shuffled so people partner and face someone new.',balanced:'Next four in line play. Teams are split by level so both sides are about even.',level:'Picks the closest levels from the next 8 waiting and balances teams. Nobody is skipped more than twice in a row.'})[S.settings.mode]+'</p>'+seg('mode',[['social','Social mix'],['balanced','Balanced teams'],['level','Level groups']])+'</div>';
  h+='<div class="setting"><h3>Fill open courts automatically</h3><p>Sends the next group on as soon as a result is recorded.</p>'+seg('auto',[[false,'Off'],[true,'On']])+'</div>';
  h+='</div><div class="panel"><h2>Player QR code</h2><div class="qrbox"><div class="q">'+qrSvg()+'</div><div><p>'+esc(joinUrl())+'</p><button class="btn" data-act="print-qr">Print QR sign</button></div></div><p class="hint" style="margin:12px 0 0;color:var(--muted)">Players scan this to ask to join. You approve each request on the Live board.</p></div><div class="panel"><h2>Start over</h2><div class="setting"><h3>New session, same players</h3><p>Clears results and puts everyone back in the queue.</p><button class="btn" data-act="restart">Start new session</button></div><div class="setting"><h3>Clear everything</h3><p>Removes all players, results and settings from this device.</p><button class="btn warn" data-act="wipe">Clear everything</button></div></div>';
  return h;
}
function joinUrl(){return new URL('../',location.href).href;}
function qrSvg(){try{var q=qrcode(0,'M');q.addData(joinUrl());q.make();return q.createSvgTag({cellSize:4,margin:0,scalable:true});}catch(e){return '';}}
function printQr(){
  var w=window.open('','_blank');if(!w){toast('Allow pop-ups to print the QR sign');return;}
  w.document.write('<!doctype html><title>Join the queue</title><body style="font-family:system-ui,sans-serif;text-align:center;padding:48px"><h1 style="font-size:56px;margin:0 0 8px">Join open play</h1><p style="font-size:26px;margin:0 0 32px">Scan to ask for a spot in the queue</p><div style="width:420px;margin:0 auto">'+qrSvg()+'</div><p style="font-size:22px;margin-top:28px">'+esc(joinUrl().replace(/^https?:\/\//,''))+'</p></body>');
  w.document.close();w.focus();setTimeout(function(){w.print();},300);
}
function renderFoot(){
  var t=new Date(S.started);
  foot.innerHTML='<i>SESSION LIVE</i><b>Open Play</b>Started '+t.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
}
function render(){
  var v=view();
  if(!booted){app.innerHTML='<div class="empty"><h1>Organizer sign in</h1><p>Sign in with the organizer Google account to run the queue.</p><div class="row"><button class="btn primary" data-act="login">Sign in with Google</button></div></div>';renderFoot();return;}
  document.querySelectorAll('nav a').forEach(function(a){if(a.getAttribute('href')==='#'+v)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  var old=document.getElementById('add-in'), typed=old?old.value:'', had=old&&document.activeElement===old;
  app.innerHTML=({courts:viewCourts,players:viewPlayers,standings:viewStandings,setup:viewSetup})[v]();
  var box=document.getElementById('add-in');if(box&&typed&&!focusAdd){box.value=typed;if(had)box.focus();}
  renderFoot();
  armed=null;
  if(focusAdd){var i=document.getElementById('add-in');if(i)i.focus();focusAdd=false;}
}

/* ---------- score sheet ---------- */
function tcard(side,ids,label){
  var w=dstate.sa!==dstate.sb&&((dstate.sa>dstate.sb)===(side==='a'));
  return '<div class="tcard'+(w?' win':'')+'"><div class="lab"><small>'+label+'</small>'+(w?'<span class="badge">Winner</span>':'')+'</div><div class="names">'+esc(ids.map(nm).join(' · '))+'</div>'+
    '<div class="score"><button type="button" class="step" data-step="'+side+'" data-d="-1" aria-label="Subtract a point from '+label+'">−</button><b aria-live="polite">'+dstate['s'+side]+'</b><button type="button" class="step plus" data-step="'+side+'" data-d="1" aria-label="Add a point to '+label+'">+</button></div></div>';
}
function drawResult(){
  var c=C(dstate.court), g=c.game;
  dlg.innerHTML='<h2 id="dlg-title">How did it go?</h2><p class="sub">Court '+c.id+'. Enter the final score so the next group can get on.</p>'+
    tcard('a',g.a,'TEAM A')+tcard('b',g.b,'TEAM B')+
    (g.a.length===2?'<button type="button" class="link" id="dlg-swap">Wrong teams? Swap partners</button>':'')+'<label class="check"><span><b>Winners stay on court</b><small>Next group in the queue challenges them</small></span><input type="checkbox" id="stay"'+(S.settings.rotation==='stay'?' checked':'')+'></label>'+
    '<p class="err" id="dlg-err" role="alert">'+(dstate.sa===dstate.sb&&(dstate.sa||dstate.sb)?'Scores are tied. Change a score to submit.':'')+'</p>'+
    '<div class="dlg-actions"><button type="button" class="btn primary" id="dlg-save"'+(dstate.sa===dstate.sb?' disabled':'')+'>Submit score</button><button type="button" class="link" id="dlg-cancel-game">Skip, just free the court</button><button type="button" class="link" id="dlg-back">Back</button></div>';
}
function openResult(c){
  dstate={court:c.id,sa:0,sb:0};
  drawResult();
  if(!dlg.open)dlg.showModal();
}
dlg.addEventListener('click',function(e){
  var t=e.target.closest('button');if(!t||!dstate)return;
  var c=C(dstate.court);
  if(t.id==='dlg-swap'){swapTeams(c.game);save();drawResult();return;}
  if(t.dataset.step){var k='s'+t.dataset.step;dstate[k]=Math.max(0,Math.min(99,dstate[k]+parseInt(t.dataset.d,10)));drawResult();var again=dlg.querySelector('[data-step="'+t.dataset.step+'"][data-d="'+t.dataset.d+'"]');if(again)again.focus();return;}
  if(t.id==='dlg-back'){dlg.close();return;}
  if(!c||!c.game){dlg.close();render();return;}
  if(t.id==='dlg-cancel-game'){cancelGame(c);dlg.close();save();render();toast('Court freed. Players are back at the front of the queue');return;}
  if(t.id==='dlg-save'){
    if(dstate.sa===dstate.sb)return;
    S.settings.rotation=document.getElementById('stay').checked?'stay':'off';
    finish(c,dstate.sa>dstate.sb?'a':'b',dstate.sa,dstate.sb);dlg.close();save();render();toast('Score saved for Court '+c.id);
  }
});
dlg.addEventListener('close',function(){dstate=null;});

/* ---------- actions ---------- */
function confirmTwice(btn,act){
  if(armed===act)return true;
  armed=act;btn.dataset.label=btn.textContent;btn.textContent='Tap again to confirm';
  setTimeout(function(){if(armed===act){armed=null;if(btn.isConnected)btn.textContent=btn.dataset.label;}},4000);
  return false;
}
document.addEventListener('click',function(e){
  var b=e.target.closest('[data-act]');if(!b||b.disabled)return;
  var act=b.dataset.act,id=parseInt(b.dataset.id,10),p,c,i;
  switch(act){
    case 'login':Store.adminLogin().catch(function(){toast('Sign in failed. Try again.');});return;
    case 'toggle-join':S.sessionOpen=!S.sessionOpen;toast(S.sessionOpen?'Check-ins are open. Players can now scan and ask to join':'Check-ins are closed');break;
    case 'print-qr':printQr();return;
    case 'approve':{var r=reqFor(b.dataset.uid);if(!r||r.status!=='pending')return;
      S.players.filter(function(x){return x.uid===r.uid;}).forEach(function(old){if(old.status!=='court'&&old.status!=='hold'){S.queue=S.queue.filter(function(q){return q!==old.id;});S.players=S.players.filter(function(x){return x!==old;});}});
      var nid=S.nextId++;S.players.push({id:nid,name:r.name,uid:r.uid,skill:r.skill,party:r.party,status:'queue',games:0,wins:0,since:Date.now(),run:0});S.queue.push(nid);
      after.push(function(){Store.patchRequest(r.uid,{status:'approved',playerId:nid});});toast(r.name+' approved and added to the queue');autoFill();break;}
    case 'decline':{var d=reqFor(b.dataset.uid);if(!d)return;Store.patchRequest(d.uid,{status:'declined'});toast(d.name+' declined');return;}
    case 'sample':addPlayers(SAMPLE.join(','));S.players.forEach(function(p,i){p.skill=LEVELS[(i*2)%5];});break;
    case 'add':i=document.getElementById('add-in');if(!i.value.trim()){i.focus();return;}addPlayers(i.value);focusAdd=true;break;
    case 'swap':c=C(id);if(c&&c.game){swapTeams(c.game);toast('Court '+c.id+': '+c.game.a.map(nm).join(' & ')+' vs '+c.game.b.map(nm).join(' & '));}break;
    case 'fill':c=C(id);if(c&&!fillCourt(c))toast('Not enough players in the queue');break;
    case 'result':c=C(id);if(c&&c.game)openResult(c);return;
    case 'release':c=C(id);if(c)releaseHold(c);break;
    case 'break':p=P(id);if(!p)return;
      if(p.status==='queue'){S.queue=S.queue.filter(function(x){return x!==id;});p.status='break';toast(p.name+' is on a break');}
      else if(p.status==='hold'){S.courts.forEach(function(c){c.hold=c.hold.filter(function(x){return x!==id;});});p.status='break';p.run=0;toast(p.name+' is on a break');}
      else if(p.status==='court'){
        if(wantsBreak(p)){ackBreak(p);toast(p.name+' stays in the rotation');}
        else{p.breakNext=true;toast(p.name+' goes on a break after this game');}
      }break;
    case 'rejoin':p=P(id);if(p&&p.status==='break'){toQueue([id],false);toast(p.name+' is back in the queue');autoFill();}break;
    case 'remove':p=P(id);if(!p||p.status==='court'||p.status==='hold')return;if(!confirmTwice(b,'remove'+id))return;
      S.queue=S.queue.filter(function(x){return x!==id;});S.players=S.players.filter(function(x){return x.id!==id;});if(p.uid)after.push(function(){Store.patchRequest(p.uid,{status:'removed'});});toast(p.name+' removed');break;
    case 'set':var k=b.dataset.key,v=b.dataset.val;S.settings[k]=k==='size'?parseInt(v,10):k==='auto'?v==='true':v;autoFill();break;
    case 'court-more':if(S.courts.length<12){S.courts.push({id:S.courts[S.courts.length-1].id+1,game:null,hold:[]});autoFill();}break;
    case 'court-less':c=S.courts[S.courts.length-1];if(S.courts.length>1&&!c.game&&!c.hold.length)S.courts.pop();break;
    case 'restart':if(!confirmTwice(b,'restart'))return;
      S.courts.forEach(function(c){c.game=null;c.hold=[];});S.history=[];S.queue=[];S.met={};S.started=Date.now();
      S.players.forEach(function(p){p.games=0;p.wins=0;p.run=0;p.skips=0;p.status='queue';p.since=Date.now();S.queue.push(p.id);});
      toast('New session started');break;
    case 'wipe':if(!confirmTwice(b,'wipe'))return;S=fresh();toast('Everything cleared');break;
    default:return;
  }
  processLeaves();save();render();
});
document.addEventListener('change',function(e){var t=e.target;if(!t.dataset||!t.dataset.rate)return;var p=P(parseInt(t.dataset.rate,10));if(p&&LEVELS.indexOf(t.value)>=0){p.skill=t.value;save();render();toast(p.name+' is now '+t.value);}});
document.addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.target.id==='add-in'&&e.target.value.trim()){addPlayers(e.target.value);focusAdd=true;save();render();}
});
window.addEventListener('hashchange',render);
setInterval(function(){
  document.querySelectorAll('[data-clock]').forEach(function(el){el.textContent=clock(+el.dataset.clock);});
  document.querySelectorAll('[data-since]').forEach(function(el){el.textContent=ago(+el.dataset.since);});
},1000);
function boot(){
  Store.adminAuth(function(u){
    user=u;
    if(!u){booted=false;render();return;}
    Store.getState().then(function(s){
      S=norm(s);booted=true;
      if(!watching){watching=true;Store.watchRequests(function(r){reqs=r;if(booted&&processLeaves()){save();}if(booted)render();});}
      render();
    },function(){toast('Could not load the session.');});
  });
}
boot();
})();

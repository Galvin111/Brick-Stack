(function(){
var board=document.getElementById('board'), st=null;
var joinUrl=new URL('../',location.href).href;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function nm(id){var p=st.players.filter(function(p){return p.id===id;})[0];return p?p.name.split(/\s+/)[0]:'?';}
function clock(t){var s=Math.max(0,Math.floor((Date.now()-t)/1000)),m=Math.floor(s/60);s%=60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;}
function qr(){try{var q=qrcode(0,'M');q.addData(joinUrl);q.make();return q.createSvgTag({cellSize:4,margin:0,scalable:true});}catch(e){return '';}}
function render(){
  var h;
  if(!st||!st.sessionOpen){board.innerHTML='<div class="closed">Open play isn’t running right now.</div>';return;}
  var size=st.settings.size||4, groups=[];
  if(st.preview&&st.preview.length)groups=st.preview.map(function(g){return g.ids;});
  else for(var i=0;i<st.queue.length;i+=size)groups.push(st.queue.slice(i,i+size));
  var open=st.courts.filter(function(c){return !c.game;});
  function head(c,right){return '<div class="h"><span class="cn">'+c.id+'</span><span class="cs">Court</span>'+(right||'')+'</div>';}
  var courts=st.courts.map(function(c){
    if(c.game)return '<div class="c">'+head(c,'<span class="clk" data-clock="'+c.game.start+'">'+clock(c.game.start)+'</span>')+'<div class="t">'+esc(c.game.a.concat(c.game.b).map(nm).join(' · '))+'</div></div>';
    if(c===open[0]&&groups[0]&&groups[0].length>=size)return '<div class="c open">'+head(c)+'<div class="big">Group 1, head over now</div><div class="t">'+esc(groups[0].map(nm).join(', '))+'</div></div>';
    return '<div class="c idle">'+head(c)+'<div class="t">Open</div></div>';
  }).join('');
  var next=groups.slice(0,5).map(function(g,i){return '<div class="n"><b>'+(i+1)+'</b><span>'+esc(g.map(nm).join(', '))+(g.length<size?' + '+(size-g.length):'')+'</span></div>';}).join('')||'<div class="n none">Nobody waiting</div>';
  board.innerHTML='<div class="grid"><div><h2>Now playing</h2><div class="courts">'+courts+'</div></div><div><h2>Up next</h2><div class="next">'+next+'</div><div class="scan"><div class="q">'+qr()+'</div><div><b>Scan to join the queue</b><small>'+esc(joinUrl.replace(/^https?:\/\//,''))+'</small></div></div></div></div>';
}
function tick(){
  document.getElementById('time').textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  document.querySelectorAll('[data-clock]').forEach(function(el){el.textContent=clock(+el.dataset.clock);});
}
Store.watchState(function(s){st=s;render();});
render();tick();setInterval(tick,1000);
})();

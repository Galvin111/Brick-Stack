/* Shared data layer for the player, organizer and TV pages.
   Firestore layout:  state/live        the whole session (players, queue, courts, history). Public read, organizer write.
                      requests/{uid}    one join request per phone. Owner and organizer read; owner creates and can leave.
   With no Firebase config it falls back to localStorage so every page still works on one device. */
(function(){
var cfg=window.BRICK_FIREBASE||{}, live=!!cfg.apiKey;
var V='10.14.1', base='https://www.gstatic.com/firebasejs/'+V+'/';
var db,auth,fb;
function loadScript(src){return new Promise(function(res,rej){var s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('Could not load '+src));};document.head.appendChild(s);});}
var ready=live?loadScript(base+'firebase-app-compat.js').then(function(){return Promise.all([loadScript(base+'firebase-auth-compat.js'),loadScript(base+'firebase-firestore-compat.js')]);}).then(function(){fb=window.firebase;fb.initializeApp(cfg);auth=fb.auth();db=fb.firestore();}):Promise.resolve();
function clean(o){return JSON.parse(JSON.stringify(o));}
function anon(){return ready.then(function(){return new Promise(function(res,rej){var off=auth.onAuthStateChanged(function(u){if(u){off();res(u);}else auth.signInAnonymously().catch(rej);});});});}

/* ---- local demo backend ---- */
var LS_STATE='bs-state',LS_REQ='bs-requests',LS_UID='bs-uid',subs=[];
function lget(k,d){try{var r=localStorage.getItem(k);return r?JSON.parse(r):d;}catch(e){return d;}}
function lset(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}notify();}
function notify(){subs.slice().forEach(function(f){f();});}
window.addEventListener('storage',notify);
function lsub(f){subs.push(f);f();}
function luid(){var u=lget(LS_UID,null);if(!u){u='local-'+Math.random().toString(36).slice(2,10);try{localStorage.setItem(LS_UID,JSON.stringify(u));}catch(e){}}return u;}

var Store={
  mode:live?'firebase':'local',
  watchState:function(cb){
    if(!live)return lsub(function(){cb(lget(LS_STATE,null));});
    ready.then(function(){db.doc('state/live').onSnapshot(function(s){cb(s.exists?s.data():null);},function(){cb(null);});});
  },
  watchMine:function(cb){
    if(!live)return lsub(function(){cb(lget(LS_REQ,{})[luid()]||null);});
    anon().then(function(u){db.doc('requests/'+u.uid).onSnapshot(function(s){cb(s.exists?s.data():null);});});
  },
  submit:function(d){
    if(!live){var r=lget(LS_REQ,{});r[luid()]=Object.assign({},d,{uid:luid(),status:'pending',at:Date.now()});lset(LS_REQ,r);return Promise.resolve();}
    return anon().then(function(u){return db.doc('requests/'+u.uid).set(Object.assign({},d,{uid:u.uid,status:'pending',at:Date.now()}));});
  },
  leave:function(){
    if(!live){var r=lget(LS_REQ,{}),m=r[luid()];if(m){m.status='left';lset(LS_REQ,r);}return Promise.resolve();}
    return anon().then(function(u){return db.doc('requests/'+u.uid).update({status:'left'});});
  },
  /* organizer */
  adminAuth:function(cb){
    if(!live){cb({email:'local demo'});return;}
    ready.then(function(){auth.onAuthStateChanged(function(u){cb(u&&!u.isAnonymous?u:null);});});
  },
  adminLogin:function(){return ready.then(function(){return auth.signInWithPopup(new fb.auth.GoogleAuthProvider());});},
  adminLogout:function(){return ready.then(function(){return auth.signOut();});},
  getState:function(){
    if(!live)return Promise.resolve(lget(LS_STATE,null));
    return ready.then(function(){return db.doc('state/live').get();}).then(function(s){return s.exists?s.data():null;});
  },
  saveState:function(s){
    if(!live){lset(LS_STATE,s);return Promise.resolve();}
    return ready.then(function(){return db.doc('state/live').set(clean(s));});
  },
  watchRequests:function(cb){
    if(!live)return lsub(function(){var r=lget(LS_REQ,{});cb(Object.keys(r).map(function(k){return r[k];}));});
    ready.then(function(){db.collection('requests').onSnapshot(function(q){cb(q.docs.map(function(d){return d.data();}));});});
  },
  patchRequest:function(uid,patch){
    if(!live){var r=lget(LS_REQ,{});if(r[uid]){Object.assign(r[uid],patch);lset(LS_REQ,r);}return Promise.resolve();}
    return ready.then(function(){return db.doc('requests/'+uid).update(patch);});
  }
};
window.Store=Store;
})();

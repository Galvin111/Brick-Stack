// Attack tests for firestore.rules. Run with:  npm test
// They run against a local emulator (project "demo-brickstack"), never your live database.
import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment, assertSucceeds, assertFails,
} from '@firebase/rules-unit-testing';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';

const ADMIN_EMAIL = 'garoudesu21@gmail.com';
const ts = () => firebase.firestore.FieldValue.serverTimestamp();
let env;

const admin = () => env.authenticatedContext('organizer', {
  email: ADMIN_EMAIL, email_verified: true, firebase: { sign_in_provider: 'google.com' },
}).firestore();
const phone = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const stranger = () => env.unauthenticatedContext().firestore();
const join = (uid, extra = {}) => ({ uid, name: 'Juan Dela Cruz', skill: 'Intermediate', party: 'Solo', status: 'pending', at: ts(), ...extra });

async function setOpen(open) {
  await env.withSecurityRulesDisabled(async (c) => {
    await c.firestore().doc('state/live').set({ sessionOpen: open, players: [], queue: [] });
  });
}
async function seedRequest(uid, data) {
  await env.withSecurityRulesDisabled(async (c) => { await c.firestore().doc('requests/' + uid).set(data); });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-brickstack',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await setOpen(true); });

// ---------- the session document ----------
test('anyone can read the live session (phones and TV)', async () => {
  await assertSucceeds(stranger().doc('state/live').get());
});
test('a stranger cannot change the session', async () => {
  await assertFails(stranger().doc('state/live').set({ sessionOpen: true }));
});
test('a player phone cannot change the session', async () => {
  await assertFails(phone('p1').doc('state/live').set({ sessionOpen: true, queue: ['me'] }));
});
test('a Google account that is not the organizer cannot change the session', async () => {
  const other = env.authenticatedContext('x', { email: 'someone@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();
  await assertFails(other.doc('state/live').set({ sessionOpen: true }));
});
test('the organizer email with an unverified address or password sign-in is refused', async () => {
  const unverified = env.authenticatedContext('x', { email: ADMIN_EMAIL, email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore();
  const password = env.authenticatedContext('y', { email: ADMIN_EMAIL, email_verified: true, firebase: { sign_in_provider: 'password' } }).firestore();
  await assertFails(unverified.doc('state/live').update({ sessionOpen: false }));
  await assertFails(password.doc('state/live').update({ sessionOpen: false }));
});
test('the organizer can change the session', async () => {
  await assertSucceeds(admin().doc('state/live').set({ sessionOpen: false }));
});

// ---------- joining ----------
test('a phone can ask to join while check-ins are open', async () => {
  await assertSucceeds(phone('p1').doc('requests/p1').set(join('p1')));
});
test('joining is refused while check-ins are closed', async () => {
  await setOpen(false);
  await assertFails(phone('p1').doc('requests/p1').set(join('p1')));
});
test('a visitor who is not signed in cannot join', async () => {
  await assertFails(stranger().doc('requests/p1').set(join('p1')));
});
test('a phone cannot file a request for someone else', async () => {
  await assertFails(phone('p1').doc('requests/p2').set(join('p2')));
  await assertFails(phone('p1').doc('requests/p1').set(join('p2')));
});
test('a phone cannot approve itself', async () => {
  await assertFails(phone('p1').doc('requests/p1').set(join('p1', { status: 'approved' })));
});
test('a faked timestamp (to jump the line) is refused', async () => {
  await assertFails(phone('p1').doc('requests/p1').set(join('p1', { at: 1 })));
});
test('extra fields are refused', async () => {
  await assertFails(phone('p1').doc('requests/p1').set(join('p1', { playerId: 1 })));
  await assertFails(phone('p1').doc('requests/p1').set(join('p1', { admin: true })));
});
test('a made-up skill level is refused', async () => {
  await assertFails(phone('p1').doc('requests/p1').set(join('p1', { skill: 'Pro' })));
});
test('names with code or symbols are refused', async () => {
  for (const name of ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '"><b>', 'a&b', '   ', '', 'x'.repeat(31), '{{name}}', ' Juan']) {
    await assertFails(phone('p1').doc('requests/p1').set(join('p1', { name })), 'should refuse: ' + JSON.stringify(name));
  }
});
test('normal names are accepted', async () => {
  for (const [i, name] of ['Juan Dela Cruz', 'Ma. Teresa', "O'Neil", 'Ana-Marie', 'José', 'Bea 2', 'Nguyễn'].entries()) {
    await assertSucceeds(phone('n' + i).doc('requests/n' + i).set(join('n' + i, { name })), 'should accept: ' + name);
  }
});

// ---------- reading requests ----------
test('a phone can read its own request', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'pending' });
  await assertSucceeds(phone('p1').doc('requests/p1').get());
});
test("a phone cannot read someone else's request", async () => {
  await seedRequest('p2', { uid: 'p2', name: 'B', status: 'pending' });
  await assertFails(phone('p1').doc('requests/p2').get());
});
test('a phone cannot list everyone\'s requests', async () => {
  await assertFails(phone('p1').collection('requests').get());
});
test('the organizer can list requests', async () => {
  await assertSucceeds(admin().collection('requests').get());
});

// ---------- changing a request ----------
test('a phone can leave the queue', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'approved' });
  await assertSucceeds(phone('p1').doc('requests/p1').update({ status: 'left' }));
});
test('a phone can ask for a break once approved', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'approved' });
  await assertSucceeds(phone('p1').doc('requests/p1').update({ want: 'break' }));
});
test('a pending phone cannot promote itself to approved', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'pending' });
  await assertFails(phone('p1').doc('requests/p1').update({ status: 'approved' }));
});
test('a phone cannot rename itself after approval', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'approved' });
  await assertFails(phone('p1').doc('requests/p1').update({ name: 'Someone Else' }));
});
test("a phone cannot touch someone else's request", async () => {
  await seedRequest('p2', { uid: 'p2', name: 'B', status: 'approved' });
  await assertFails(phone('p1').doc('requests/p2').update({ status: 'left' }));
});
test('a phone cannot delete its request (only the organizer can)', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'pending' });
  await assertFails(phone('p1').doc('requests/p1').delete());
  await assertSucceeds(admin().doc('requests/p1').delete());
});
test('a declined player can ask again only while check-ins are open', async () => {
  await seedRequest('p1', { uid: 'p1', name: 'A', status: 'declined' });
  await assertSucceeds(phone('p1').doc('requests/p1').set(join('p1')));
  await seedRequest('p2', { uid: 'p2', name: 'B', status: 'declined' });
  await setOpen(false);
  await assertFails(phone('p2').doc('requests/p2').set(join('p2')));
});

// ---------- everything else ----------
test('any other collection is closed', async () => {
  await assertFails(stranger().doc('secrets/x').get());
  await assertFails(phone('p1').doc('anything/x').set({ a: 1 }));
  await assertFails(admin().doc('anything/x').set({ a: 1 }));
});

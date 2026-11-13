import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate, rateLimited, readBody } from './contact.js';

const good = { nombre: 'Ana', email: 'ana@empresa.es', mensaje: 'Quiero una plataforma para mi flota', tipos: ['MVP', 'hack'] };

test('accepts a valid submission and drops unknown project types', () => {
  const r = validate(good);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data.tipos, ['MVP']);
});

test('rejects bad email, short message and missing name', () => {
  assert.equal(validate({ ...good, email: 'nope' }).ok, false);
  assert.equal(validate({ ...good, mensaje: 'hola' }).ok, false);
  assert.equal(validate({ ...good, nombre: '  ' }).ok, false);
});

test('strips newlines from the name so it cannot inject headers', () => {
  assert.equal(validate({ ...good, nombre: 'Ana\r\nBcc: x@y.z' }).data.nombre, 'Ana Bcc: x@y.z');
});

test('flags honeypot submissions as spam', () => {
  assert.deepEqual(validate({ ...good, web: 'http://spam' }), { ok: false, error: 'spam' });
});

test('decodes accents split across request chunks', async () => {
  const bytes = Buffer.from(JSON.stringify({ mensaje: 'envío de prueba con ñ y acentos' }), 'utf8');
  const cut = bytes.indexOf(0xc3) + 1; // split right inside the 2-byte "í"
  const req = (async function* () { yield bytes.subarray(0, cut); yield bytes.subarray(cut); })();
  assert.equal((await readBody(req)).mensaje, 'envío de prueba con ñ y acentos');
});

test('rate limits after 5 sends from one IP', () => {
  const now = Date.now();
  for (let i = 0; i < 5; i++) assert.equal(rateLimited('1.2.3.4', now + i), false);
  assert.equal(rateLimited('1.2.3.4', now + 6), true);
});

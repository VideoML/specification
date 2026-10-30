import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
// JCS for these vectors: strings, integers, arrays and plain objects only.
function canonical(x) {
  if (Array.isArray(x)) return `[${x.map(canonical).join(',')}]`;
  if (x && typeof x === 'object') return `{${Object.keys(x).sort().map(k => `${JSON.stringify(k)}:${canonical(x[k])}`).join(',')}}`;
  if (typeof x === 'number' && !Number.isSafeInteger(x)) throw Error('vector numbers must be safe integers');
  return JSON.stringify(x);
}
function codepointCompare(a, b) {
  const aa = Array.from(a, c => c.codePointAt(0)), bb = Array.from(b, c => c.codePointAt(0));
  for (let i = 0; i < Math.min(aa.length, bb.length); i++) if (aa[i] !== bb[i]) return aa[i] - bb[i];
  return aa.length - bb.length;
}
function digest(manifest) {
  const m = structuredClone(manifest); delete m.contentDigest;
  for (const k of ['files', 'assets']) m[k].sort((a,b) => codepointCompare(a.path,b.path));
  return sha(Buffer.from(canonical(m) + m.files.map(f => f.sha256).join(''), 'utf8'));
}
function filesValid(m, contents) {
  const map = new Map();
  for (const f of m.files) {
    if (map.has(f.path) || !Object.hasOwn(contents, f.path) || sha(contents[f.path]) !== f.sha256) return false;
    map.set(f.path, f);
  }
  if (Object.keys(contents).length !== map.size) return false;
  return m.assets.every(a => map.has(a.path) && map.get(a.path).sha256 === a.sha256 && map.get(a.path).mediaType === a.mediaType)
    && [m.entry, ...m.audio, ...m.timing].every(p => map.has(p));
}
const bytes = {'source/é.xml': Buffer.from('source'), 'assets/😀.txt': Buffer.from('asset'), 'dependencies.lock.json':Buffer.from('{}'), 'assets/Ω.txt':Buffer.from('second asset')};
const f = (path,mediaType) => ({path,mediaType,sha256:sha(bytes[path])});
const manifest = {schemaVersion:1,projectId:'unicode',entry:'source/é.xml',width:2,height:2,fps:30,durationFrames:3,seed:0,toolchainVersion:'1',files:[f('source/é.xml','application/xml'),f('assets/😀.txt','text/plain'),f('dependencies.lock.json','application/json'),f('assets/Ω.txt','text/plain')],assets:[f('assets/😀.txt','text/plain'),f('assets/Ω.txt','text/plain')],audio:[],timing:[],effects:[],dependencies:{},fonts:{},contentDigest:'ignored'};
const expected = '6d933178b4a8d02c08979cde6347dd7e700ca96d13c0937e76f298b4b0fb5136';
console.log('bundle digest:',digest(manifest));
assert.equal(digest(manifest), expected);
const reordered=structuredClone(manifest); reordered.files.reverse(); reordered.assets.reverse();
assert.equal(digest(reordered), expected);
assert(filesValid(manifest,bytes));
const wrong=structuredClone(manifest);wrong.files[0].sha256='0'.repeat(64);assert(!filesValid(wrong,bytes));
const missing=structuredClone(manifest);missing.entry='source/missing.xml';assert(!filesValid(missing,bytes));
const mismatch=structuredClone(manifest);mismatch.assets[0].sha256='0'.repeat(64);assert(!filesValid(mismatch,bytes));
const duplicate=structuredClone(manifest);duplicate.files.push(duplicate.files[0]);assert(!filesValid(duplicate,bytes));
function revisionValid(p) {return (p.modelRevision !== null && p.modelId !== null) || (typeof p.cacheDisabledReason === 'string' && p.cacheDisabledReason.length > 0);}
assert(revisionValid({modelId:'kokoro',modelRevision:null,cacheDisabledReason:'unavailable'}));
assert(!revisionValid({modelId:'kokoro',modelRevision:null,cacheDisabledReason:null}));
assert(!revisionValid({modelId:null,modelRevision:'rev',cacheDisabledReason:''}));
function frames(start,end,rate,fps) {return start===end ? [Math.floor(start/rate*fps),Math.floor(start/rate*fps)] : [Math.floor(start/rate*fps),Math.ceil(end/rate*fps)];}
assert.deepEqual(frames(240,960,24000,30),[0,2]);
assert.deepEqual(frames(240,240,24000,30),[0,0]);
function timingValid(t) {
  const all=[...t.scenes,...t.cues,...t.layers,...t.components,...t.transitions,...t.segments];
  if(new Set(all.map(x=>x.id)).size!==all.length) return false;
  const cues=new Set(t.cues.map(x=>x.id));
  const byTrack = new Map();
  for (const segment of t.segments) { const prior=byTrack.get(segment.track) ?? []; if(prior.some(p=>segment.startSample<p.endSample && p.startSample<segment.endSample)) return false; prior.push(segment); byTrack.set(segment.track,prior); }
  return all.every(x=>x.startFrame<=x.endFrame && x.endFrame<=t.durationFrames) && t.segments.every(s=>s.startSample<=s.endSample && cues.has(s.cueId) && frames(s.startSample,s.endSample,t.sampleRateHz,t.fps).every((v,i)=>v===[s.startFrame,s.endFrame][i]) && s.audioSha256===s.provenance.audioSha256 && s.pcmSha256===s.provenance.pcmSha256);
}
const timing=JSON.parse(fs.readFileSync(new URL('../examples/contracts/resolved-timing.json',import.meta.url)));
assert(timingValid(timing));
const badTiming=structuredClone(timing);badTiming.segments[0].endFrame=1;assert(!timingValid(badTiming));
const badRef=structuredClone(timing);badRef.segments[0].cueId='missing';assert(!timingValid(badRef));
const overlap=structuredClone(timing);overlap.segments.push({...overlap.segments[0],id:'seg-2'});assert(!timingValid(overlap));
const badId=structuredClone(timing);badId.scenes[0].id='cue-1';assert(!timingValid(badId));
// A real minimal WAV vector: the PCM hash excludes its 44-byte header.
const pcm=Buffer.from([0,0,255,127,0,128]); const wav=Buffer.alloc(44+pcm.length);
wav.write('RIFF',0);wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(pcm.length,40);pcm.copy(wav,44);
const validateAudio=(wavBytes, audioHash, pcmHash)=>sha(wavBytes)===audioHash && sha(wavBytes.subarray(44))===pcmHash;
assert(validateAudio(wav,sha(wav),sha(pcm)));assert(!validateAudio(wav,sha(pcm),sha(pcm)));assert(!validateAudio(wav,sha(wav),sha(wav)));
console.log('semantic vectors passed');

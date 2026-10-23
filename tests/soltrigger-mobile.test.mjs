import assert from 'node:assert/strict';
import {deflateSync,inflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseStpatch,writeStpatch} from '../soltrigger-mobile.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const src=Buffer.alloc(5*1024*1024,41), target=Buffer.concat([src,Buffer.alloc(100)]);
const replacements=[{offset:3,bytes:Buffer.from('Thai patch')},{offset:src.length-4,bytes:Buffer.alloc(104,74)}];
for(const b of replacements)b.bytes.copy(target,b.offset);
const g={sourceSize:src.length,targetSize:target.length,sourceSha256:hash(src),targetSha256:hash(target)};
function makePatch(blocks){const m=Buffer.from(JSON.stringify({format:'STPATCH1',source_size:g.sourceSize,target_size:g.targetSize,source_sha256:g.sourceSha256,target_sha256:g.targetSha256,changed_blocks:blocks.length}));const h=Buffer.alloc(12);h.write('STPATCH1');h.writeUInt32LE(m.length,8);return Buffer.concat([h,m,...blocks.flatMap(b=>{const z=deflateSync(b.bytes),h=Buffer.alloc(16);h.writeBigUInt64LE(BigInt(b.offset));h.writeUInt32LE(b.bytes.length,8);h.writeUInt32LE(z.length,12);return [h,z]})]);}
let maxRead=0;const file={size:src.length,arrayBuffer(){throw Error('whole ISO read forbidden')},slice(a,b){maxRead=Math.max(maxRead,b-a);return new Blob([src.subarray(a,b)])}};
const patch=makePatch(replacements),blocks=parseStpatch(patch,g),parts=[];
await writeStpatch(file,g,blocks,{async write(b){parts.push(Buffer.from(b))}});
assert.deepEqual(Buffer.concat(parts),target);assert.ok(maxRead<=2*1024*1024);
assert.throws(()=>parseStpatch(patch.subarray(0,-1),g));
assert.throws(()=>parseStpatch(patch,{...g,sourceSha256:'bad'}));
assert.throws(()=>parseStpatch(makePatch([replacements[1],replacements[0]]),g));
await assert.rejects(()=>writeStpatch(file,g,[{...blocks[0],length:1}],{async write(){}}));
await assert.rejects(()=>writeStpatch(file,g,blocks,{async write(){throw Object.assign(Error('full'),{name:'QuotaExceededError'})}}));
console.log('PASS fixtures: exact output, growth, bounded reads, truncation, mismatched manifest, unordered blocks, decompression bounds, disk-full propagation');
// Real 18-block patch against a synthetic zero-filled source, compared to an
// independent zlib/reference stream. No copyrighted source ROM is required.
const actual=readFileSync(new URL('../patches/SolTrigger_Thai_v1.1.stp', import.meta.url));const m=JSON.parse(actual.subarray(12,12+actual.readUInt32LE(8)));
const realGame={sourceSize:m.source_size,targetSize:m.target_size,sourceSha256:m.source_sha256,targetSha256:m.target_sha256};
const parsed=parseStpatch(actual,realGame);let reference=createHash('sha256'),position=0;
const zero=Buffer.alloc(2*1024*1024);function zeros(n){while(n>0){const size=Math.min(n,zero.length);reference.update(zero.subarray(0,size));n-=size;}}
for(const b of parsed){zeros(b.offset-position);const raw=inflateSync(b.bytes);assert.equal(raw.length,b.length);reference.update(raw);position=b.offset+b.length;}zeros(realGame.targetSize-position);
let outputHash=createHash('sha256'),written=0;
await writeStpatch({size:realGame.sourceSize,arrayBuffer(){throw Error('whole read')},slice(a,b){assert.ok(b-a<=zero.length);return new Blob([zero.subarray(0,b-a)])}},realGame,parsed,{async write(bytes){outputHash.update(new Uint8Array(bytes));written+=bytes.byteLength;}});
assert.equal(written,realGame.targetSize);assert.equal(outputHash.digest('hex'),reference.digest('hex'));
console.log('PASS actual patch: 18 blocks, 1,522,102,272 output bytes, same hash as independent reference on synthetic source');

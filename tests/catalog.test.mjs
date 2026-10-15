import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const catalog=JSON.parse(readFileSync(new URL("../sound-bank.json",import.meta.url),"utf8"));
const entries=Object.entries(catalog.banks);

test("el catálogo incluye 31 sonidos y 13 instrumentos acústicos",()=>{
  assert.equal(entries.length,31);
  assert.equal(entries.filter(([,b])=>b.type==="acoustic").length,13);
  assert.equal(entries.filter(([,b])=>b.type==="electronic").length,18);
});
test("cada preset contiene archivos reales y 3 capas musicales o un one-shot válido",()=>{
  for(const [id,b] of entries){
    assert.ok(id.length>1);
    assert.ok(typeof b.name==="string"&&b.name.length>3);
    assert.ok(typeof b.category==="string");
    if(b.type==="acoustic"){
      assert.ok(["drumkit","drumkit2"].includes(b.folder));
      assert.equal(b.levels.length,3);
      assert.ok(b.levels.every(v=>Number.isInteger(v)&&v>=1&&v<=6));
      assert.ok(Number.isInteger(b.rr)&&b.rr>=3&&b.rr<=4);
    }else{
      assert.ok(b.files.length>=1&&b.files.length<=3);
      assert.ok(b.files.every(path=>path.endsWith(".wav")&&path.startsWith("drum-samples/")));
    }
  }
});
test("las grabaciones acústicas cubren las ocho filas iniciales",()=>{
  for(const k of ["kick","hho","hhc","snare","crash","china","tomhi","tomlo"])
    assert.equal(catalog.banks[k].type,"acoustic");
  assert.equal(catalog.banks.kick.rr,4);
});
test("URLs de audio fijadas a revisiones para despliegues reproducibles",()=>{
  assert.match(catalog.sources.acoustic,/ferrosintesis\/[0-9a-f]{40}\//);
  assert.match(catalog.sources.electronic,/free-drum-samples\/[0-9a-f]{40}\//);
});

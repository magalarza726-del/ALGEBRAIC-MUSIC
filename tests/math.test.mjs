import test from "node:test";
import assert from "node:assert/strict";
import {ZERO, DEFAULT_A, DEFAULT_B, toNormalized, validDiscrete, quantize, inverse, calculate} from "../matrix.mjs";

test("la conversión 0/1/2/3 preserva las intensidades",()=>{
  assert.deepEqual(quantize(toNormalized(DEFAULT_A)),DEFAULT_A);
  assert.equal(toNormalized(DEFAULT_A)[0][0],1);
  assert.equal(toNormalized(DEFAULT_A)[2][0],2/3);
});
test("valida matrices 8×8 con intensidades enteras",()=>{
  assert.equal(validDiscrete(ZERO()),true);
  assert.equal(validDiscrete([[1]]),false);
  assert.equal(validDiscrete(ZERO().map(row=>row.map(()=>4))),false);
});
test("el promedio de dos matrices de 3 produce 3",()=>{
  const full=ZERO().map(row=>row.map(()=>3));
  assert.deepEqual(calculate(full,full).discrete,full);
});
test("el producto de matrices identidad normalizadas vale 1/8 en la diagonal",()=>{
  const id=ZERO().map((row,i)=>row.map((_,j)=>i===j?3:0));
  const product=calculate(id,id,"matrixProduct");
  assert.equal(product.continuous[0][0],1/8);
  assert.equal(product.continuous[0][1],0);
  assert.equal(product.discrete[0][0],0);
});
test("transposición intercambia filas y columnas",()=>{
  const a=ZERO();a[2][5]=3;
  const result=calculate(a,ZERO(),"transpose");
  assert.equal(result.discrete[5][2],3);
  assert.equal(result.discrete[2][5],0);
});
test("inversión temporal conserva instrumento",()=>{
  const a=ZERO();a[1][0]=2;
  assert.equal(calculate(a,ZERO(),"reverse").discrete[1][7],2);
});
test("la inversa detecta matrices singulares",()=>{
  assert.equal(inverse(toNormalized(ZERO())),null);
  assert.match(calculate(ZERO(),ZERO(),"inverse").error,/singular/);
});
test("la inversa de la identidad es identidad",()=>{
  const id=ZERO().map((row,i)=>row.map((_,j)=>i===j?3:0));
  assert.deepEqual(inverse(toNormalized(id)),toNormalized(id));
  assert.deepEqual(calculate(id,ZERO(),"inverse").discrete,id);
});
test("normalización por pico amplifica el máximo relativo",()=>{
  const a=ZERO();a[0][0]=1;
  assert.equal(calculate(a,ZERO(),"transpose","fixed").discrete[0][0],1);
  assert.equal(calculate(a,ZERO(),"transpose","peak").discrete[0][0],3);
});
test("hadamard conserva sólo golpes coincidentes",()=>{
  const a=ZERO(),b=ZERO();a[0][0]=3;a[0][1]=3;b[0][0]=3;
  const c=calculate(a,b,"hadamard").discrete;
  assert.equal(c[0][0],3);
  assert.equal(c[0][1],0);
});
test("los patrones iniciales son válidos",()=>{
  assert.equal(validDiscrete(DEFAULT_A),true);
  assert.equal(validDiscrete(DEFAULT_B),true);
});

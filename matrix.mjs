// Núcleo matemático puro: sin DOM, Web Audio ni dependencias.
export const SIZE = 8;
export const ZERO = () => Array.from({length: SIZE}, () => Array(SIZE).fill(0));
export const DEFAULT_A = [
  [3,0,0,0,3,0,0,0],
  [0,0,0,0,0,0,0,0],
  [2,2,2,2,2,2,2,2],
  [0,0,3,0,0,0,3,0],
  [0,0,0,0,3,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0]
];
export const DEFAULT_B = [
  [3,0,0,3,0,0,3,0],
  [0,0,0,0,0,0,0,0],
  [1,0,2,0,1,0,2,0],
  [0,0,3,0,0,3,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0],
  [0,0,0,0,0,3,0,0],
  [0,0,0,0,0,0,0,0]
];
const clamp = x => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
export function validDiscrete(matrix) {
  return Array.isArray(matrix) && matrix.length === SIZE &&
    matrix.every(row => Array.isArray(row) && row.length === SIZE &&
      row.every(value => Number.isInteger(value) && value >= 0 && value <= 3));
}
export function toNormalized(matrix) {
  if (!validDiscrete(matrix)) throw new TypeError("La matriz debe ser 8 × 8, con enteros de 0 a 3.");
  return matrix.map(row => row.map(value => value / 3));
}
export function quantize(matrix) {
  return matrix.map(row => row.map(value => Math.round(clamp(value) * 3)));
}
export function normalizeResult(raw, mode = "fixed") {
  if (mode === "peak") {
    const peak = Math.max(0, ...raw.flat().filter(Number.isFinite));
    return raw.map(row => row.map(value => peak > 1e-10 ? clamp(value / peak) : 0));
  }
  return raw.map(row => row.map(clamp));
}
export function multiply(A, B) {
  return A.map((row, r) => row.map((_, c) =>
    Array.from({length: SIZE}, (_, k) => A[r][k] * B[k][c]).reduce((s, n) => s + n, 0)
  ));
}
export function inverse(A) {
  const augmented = A.map((row, i) => [...row, ...Array.from({length: SIZE}, (_, j) => +(i === j))]);
  for (let i = 0; i < SIZE; i++) {
    let pivot = i;
    for (let j = i + 1; j < SIZE; j++) {
      if (Math.abs(augmented[j][i]) > Math.abs(augmented[pivot][i])) pivot = j;
    }
    if (Math.abs(augmented[pivot][i]) < 1e-10) return null;
    [augmented[i], augmented[pivot]] = [augmented[pivot], augmented[i]];
    const d = augmented[i][i];
    for (let k = 0; k < 2 * SIZE; k++) augmented[i][k] /= d;
    for (let j = 0; j < SIZE; j++) {
      if (j === i) continue;
      const factor = augmented[j][i];
      for (let k = 0; k < 2 * SIZE; k++) augmented[j][k] -= factor * augmented[i][k];
    }
  }
  return augmented.map(row => row.slice(SIZE));
}
export const OPERATIONS = {
  average: { formula: "C = (A + B) / 2", description: "Combina las dos matrices sin superar la intensidad máxima." },
  subtract: { formula: "C = máx(0, A − B)", description: "Conserva la parte de A que B no neutraliza." },
  matrixProduct: { formula: "C = (A × B) / 8", description: "Producto algebraico: cada celda combina una fila de A con una columna de B." },
  hadamard: { formula: "Cᵢⱼ = Aᵢⱼ · Bᵢⱼ", description: "Multiplicación elemento a elemento: resalta coincidencias temporales." },
  transpose: { formula: "Cᵢⱼ = Aⱼᵢ", description: "Intercambia instrumentos y tiempos de la matriz A." },
  reverse: { formula: "Cᵢⱼ = Aᵢ,₇₋ⱼ", description: "Invierte la secuencia temporal sin intercambiar instrumentos." },
  invertIntensity: { formula: "Cᵢⱼ = (Aᵢⱼ > 0) ? 1 − Aᵢⱼ : 0", description: "Invierte la fuerza de los golpes presentes; los silencios permanecen." },
  inverse: { formula: "C = A⁻¹  (si existe)", description: "La inversa algebraica requiere una matriz no singular; puede producir valores negativos." }
};
export function calculate(discreteA, discreteB, operation = "average", normalization = "fixed") {
  const A = toNormalized(discreteA);
  const B = toNormalized(discreteB);
  const meta = OPERATIONS[operation] || OPERATIONS.average;
  let raw;
  let error = null;
  switch (operation) {
    case "average": raw = A.map((row, i) => row.map((v, j) => (v + B[i][j]) / 2)); break;
    case "subtract": raw = A.map((row, i) => row.map((v, j) => Math.max(0, v - B[i][j]))); break;
    case "matrixProduct": raw = multiply(A, B).map(row => row.map(v => v / SIZE)); break;
    case "hadamard": raw = A.map((row, i) => row.map((v, j) => v * B[i][j])); break;
    case "transpose": raw = A.map((row, i) => row.map((_, j) => A[j][i])); break;
    case "reverse": raw = A.map(row => [...row].reverse()); break;
    case "invertIntensity": raw = A.map(row => row.map(v => v > 0 ? 1 - v : 0)); break;
    case "inverse":
      raw = inverse(A);
      if (!raw) { error = "A es singular: no tiene inversa algebraica. Modifica la matriz A."; raw = ZERO(); }
      break;
    default: raw = A.map((row, i) => row.map((v, j) => (v + B[i][j]) / 2));
  }
  const continuous = normalizeResult(raw, normalization);
  return { continuous, discrete: quantize(continuous), error, formula: meta.formula, description: meta.description };
}
export function matrixText(matrix) {
  return matrix.map(row => row.map(v => Number(v).toFixed(2).padStart(4, " ")).join("  ")).join("\n");
}

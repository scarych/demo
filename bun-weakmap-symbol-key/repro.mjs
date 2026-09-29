// A Symbol that is still reachable as a property key of a live object is treated as dead by
// the garbage collector: its WeakMap entries are removed and WeakRefs to it are cleared,
// although Object.getOwnPropertySymbols() still returns it. Node (V8) keeps both.
const gc = globalThis.Bun ? () => Bun.gc(true) : globalThis.gc;
if (!gc) throw new Error("Node: run with --expose-gc");

// overwrite stack slots that may still point at the symbol, so that a conservative stack
// scan does not keep it alive by accident (without it the bug still shows, less often)
const scrub = (depth) => (depth > 0 ? scrub(depth - 1) + depth : 0);

const registry = new WeakMap();
const held = []; // control case: the symbol is also kept in an array

function makeObject(control) {
  const key = Symbol("key");
  registry.set(key, "value");
  const ref = new WeakRef(key);
  if (control) held.push(key);
  return { object: { [key]: true }, ref }; // the symbol stays reachable as a property key
}

function run(control, runs = 200) {
  let entryLost = 0;
  let refCleared = 0;
  for (let i = 0; i < runs; i++) {
    const { object, ref } = makeObject(control);
    scrub(100);
    gc();
    const [key] = Object.getOwnPropertySymbols(object); // still there
    if (!registry.has(key)) entryLost++;
    if (ref.deref() === undefined) refCleared++;
  }
  return `WeakMap entry lost ${entryLost}/${runs}, WeakRef cleared ${refCleared}/${runs}`;
}

console.log(globalThis.Bun ? `Bun ${Bun.version}` : `Node ${process.version}`);
console.log(`symbol reachable only as a property key: ${run(false)}`);
console.log(`symbol also held in an array (control):  ${run(true)}`);

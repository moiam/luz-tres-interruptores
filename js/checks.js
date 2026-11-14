// Revisiones didácticas: colores mal usados y errores típicos de montaje.

export function colorIssues(wires, nice) {
  const out = [];
  for (const w of wires) {
    const ends = [w.a, w.b];
    const isN = ends.some((t) => t === 'sup.N' || t === 'lamp.N');
    const isPE = ends.some((t) => t.endsWith('.PE'));
    const name = `${nice(w.a)} → ${nice(w.b)}`;
    if (isPE && w.col !== 'tierra') out.push(`${name} es la tierra: debe ser amarillo-verde.`);
    else if (isN && !isPE && w.col !== 'neutro') out.push(`${name} es el neutro: debe ser azul.`);
    else if (!isN && !isPE && (w.col === 'neutro' || w.col === 'tierra'))
      out.push(`${name} lleva fase: el ${w.col === 'neutro' ? 'azul' : 'amarillo-verde'} está reservado para ${w.col}.`);
  }
  return out;
}

export function mistakes(wires, nice) {
  const out = [];
  const traveler = /^(A|B)\.(1|2)$/;
  for (const w of wires) {
    const ends = [w.a, w.b];
    const name = `${nice(w.a)} → ${nice(w.b)}`;
    if (ends.some((t) => t === 'sup.L' || t === 'lamp.L') && ends.some((t) => traveler.test(t)))
      out.push(`${name}: la fase y el retorno van al tornillo <strong>L</strong> (común) del conmutador, no al 1 ni al 2.`);
    if (ends.some((t) => t === 'sup.N' || t === 'lamp.N') && ends.some((t) => /^[ABC]\./.test(t)))
      out.push(`${name}: el neutro no pasa por ningún interruptor.`);
  }
  return out;
}

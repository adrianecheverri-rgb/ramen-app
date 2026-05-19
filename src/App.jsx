import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ──────────────────────────────────────────────────────────────
const SUPA_URL = "https://wtmfywkiwwywgxggyfji.supabase.co";
const SUPA_KEY = "sb_publishable_HtJCx8wqoIWJ3-DFRCrInQ_XbJCsJqB";
const sb = createClient(SUPA_URL, SUPA_KEY);

// ── HELPERS ───────────────────────────────────────────────────────────────
const Q = (n) => `Q${(+n||0).toFixed(2)}`;
const pct = (n) => `${(+n||0).toFixed(1)}%`;

const CATS_PLATOS = [
  { id:"ramen",   label:"Ramen",   emoji:"🍜" },
  { id:"sushi",   label:"Sushi",   emoji:"🍣" },
  { id:"entrada", label:"Entrada", emoji:"🥗" },
  { id:"bebida",  label:"Bebida",  emoji:"🥤" },
  { id:"postre",  label:"Postre",  emoji:"🍮" },
  { id:"otro",    label:"Otro",    emoji:"🍱" },
];

const CATS_INV = [
  { id:"proteina",  label:"Proteína",  emoji:"🥩" },
  { id:"verdura",   label:"Verduras",  emoji:"🥬" },
  { id:"base",      label:"Bases",     emoji:"🍚" },
  { id:"salsa",     label:"Salsas",    emoji:"🫙" },
  { id:"bebida",    label:"Bebidas",   emoji:"🥤" },
  { id:"empaque",   label:"Empaque",   emoji:"📦" },
  { id:"general",   label:"General",   emoji:"🗂" },
];

const UNIDADES = ["kg","g","litro","ml","unidad","paquete","caja","bolsa"];

function semaforo(fc) {
  if (!fc||fc<=0) return null;
  if (fc<28) return { c:"#22c55e", bg:"#052e16", br:"#166534", emoji:"🟢", label:"Excelente", desc:"Plato muy rentable." };
  if (fc<35) return { c:"#86efac", bg:"#052e16", br:"#166534", emoji:"🟢", label:"Bien",      desc:"Margen saludable." };
  if (fc<40) return { c:"#fbbf24", bg:"#1c1400", br:"#b45309", emoji:"🟡", label:"Alerta",    desc:"Sube precio o reduce costo." };
  return       { c:"#f87171", bg:"#1c0000", br:"#b91c1c", emoji:"🔴", label:"Peligro",   desc:"Food cost crítico. Acción urgente." };
}

function calcPlato(plato, ings) {
  const costo = (ings||[]).reduce((s,i)=>s+(+i.cant||0)*(+i.precio||0),0);
  const merma = costo * ((+plato.merma||10)/100);
  const total = costo + merma;
  const v = +plato.precio||0;
  return { costo, merma, total, fc: v>0?(total/v)*100:0, ganancia: v-total };
}

function catPlato(id) { return CATS_PLATOS.find(c=>c.id===id)||CATS_PLATOS[CATS_PLATOS.length-1]; }
function catInv(id)   { return CATS_INV.find(c=>c.id===id)||CATS_INV[CATS_INV.length-1]; }

// ── UI COMPONENTS ─────────────────────────────────────────────────────────
function Card({ children, style={}, onClick }) {
  return <div onClick={onClick} style={{ background:"#1c1c1e",borderRadius:18,padding:"16px 18px",marginBottom:10,cursor:onClick?"pointer":undefined,...style }}>{children}</div>;
}
function Lbl({ children }) {
  return <div style={{ fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,marginTop:16 }}>{children}</div>;
}
function Btn({ children, onClick, variant="primary", full=false, small=false, disabled=false }) {
  const v = {
    primary:  { background:"#22c55e", color:"#000" },
    secondary:{ background:"#2c2c2e", color:"#f5f5f5" },
    ghost:    { background:"transparent", color:"#6b7280" },
    danger:   { background:"#1c0000", color:"#f87171", border:"1px solid #7f1d1d" },
  };
  return <button disabled={disabled} onClick={onClick} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:6,borderRadius:12,cursor:disabled?"not-allowed":"pointer",border:"none",fontFamily:"inherit",fontWeight:700,width:full?"100%":"auto",padding:small?"9px 16px":"14px 22px",fontSize:small?13:15,opacity:disabled?0.4:1,...v[variant] }}>{children}</button>;
}
function Spinner() {
  return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",padding:"60px 0" }}>
    <div style={{ width:32,height:32,border:"3px solid #2c2c2e",borderTop:"3px solid #22c55e",borderRadius:"50%",animation:"spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}
function Toast({ msg, onClose }) {
  useEffect(()=>{ const t=setTimeout(onClose,2500); return ()=>clearTimeout(t); },[]);
  return <div style={{ position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"#22c55e",color:"#000",padding:"10px 20px",borderRadius:20,fontSize:13,fontWeight:700,zIndex:999,whiteSpace:"nowrap",boxShadow:"0 4px 20px #00000060" }}>{msg}</div>;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: PLATOS
// ═══════════════════════════════════════════════════════════════════════════
function Platos() {
  const [platos, setPlatos] = useState([]);
  const [ingsMap, setIngsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("lista");
  const [editPlato, setEditPlato] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [toast, setToast] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: ps }, { data: ings }] = await Promise.all([
      sb.from("platos").select("*").order("created_at"),
      sb.from("ingredientes").select("*"),
    ]);
    setPlatos(ps||[]);
    const map = {};
    (ings||[]).forEach(i=>{ if(!map[i.plato_id]) map[i.plato_id]=[]; map[i.plato_id].push(i); });
    setIngsMap(map);
    setLoading(false);
  },[]);

  useEffect(()=>{ fetchAll(); },[fetchAll]);

  // Realtime
  useEffect(()=>{
    const ch = sb.channel("platos-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"platos"},fetchAll)
      .on("postgres_changes",{event:"*",schema:"public",table:"ingredientes"},fetchAll)
      .subscribe();
    return ()=>sb.removeChannel(ch);
  },[fetchAll]);

  const abrirNuevo = () => {
    setEditPlato({ nombre:"", precio:"", categoria:"ramen", merma:10, ings:[{nombre:"",cant:"",precio:""}] });
    setVista("editor");
  };
  const abrirEditar = (p) => {
    setEditPlato({ ...p, ings: (ingsMap[p.id]||[]).map(i=>({...i})) });
    setVista("editor");
  };
  const guardar = async (p) => {
    if (!p.nombre||!p.precio) return;
    let platoId = p.id;
    if (p.id) {
      await sb.from("platos").update({ nombre:p.nombre,precio:+p.precio,categoria:p.categoria,merma:+p.merma }).eq("id",p.id);
      await sb.from("ingredientes").delete().eq("plato_id",p.id);
    } else {
      const { data } = await sb.from("platos").insert({ nombre:p.nombre,precio:+p.precio,categoria:p.categoria,merma:+p.merma }).select().single();
      platoId = data.id;
    }
    const ingsValidos = (p.ings||[]).filter(i=>i.nombre);
    if (ingsValidos.length>0) {
      await sb.from("ingredientes").insert(ingsValidos.map(i=>({ plato_id:platoId, nombre:i.nombre, cant:+i.cant||0, precio:+i.precio||0 })));
    }
    setToast("✓ Guardado"); setVista("lista");
  };
  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este plato?")) return;
    await sb.from("platos").delete().eq("id",id);
    setToast("Eliminado"); setVista("lista");
  };

  if (vista==="editor"&&editPlato) {
    return <PlatoEditor plato={editPlato} onGuardar={guardar} onVolver={()=>setVista("lista")} onEliminar={eliminar} />;
  }

  const catsConPlatos = CATS_PLATOS.filter(c=>platos.some(p=>p.categoria===c.id));
  const filtrados = filtro==="todos" ? platos : platos.filter(p=>p.categoria===filtro);
  const fcProm = platos.length>0 ? platos.reduce((s,p)=>s+calcPlato(p,ingsMap[p.id]).fc,0)/platos.length : 0;

  return (
    <div style={{ padding:"0 16px" }}>
      {toast&&<Toast msg={toast} onClose={()=>setToast("")} />}
      <div style={{ padding:"52px 0 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:26,fontWeight:800,color:"#f5f5f5" }}>Costeo</div>
          <div style={{ fontSize:13,color:"#6b7280",marginTop:2 }}>{platos.length} plato{platos.length!==1?"s":""} · Tiempo real 🟢</div>
        </div>
        <button onClick={abrirNuevo} style={{ background:"#22c55e",border:"none",borderRadius:14,width:44,height:44,fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontWeight:800 }}>+</button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {platos.length>0&&(
            <>
              <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:4 }}>
                {[
                  { l:"Platos",     v:platos.length,  c:"#f5f5f5" },
                  { l:"FC promedio",v:pct(fcProm),     c:fcProm<35?"#22c55e":fcProm<40?"#fbbf24":"#f87171" },
                  { l:"Estado",     v:fcProm<35?"✓ Sano":"⚠ Revisar", c:fcProm<35?"#22c55e":"#fbbf24" },
                ].map((m,i)=>(
                  <Card key={i} style={{ marginBottom:0,textAlign:"center",padding:"10px 8px" }}>
                    <div style={{ fontSize:11,color:"#6b7280" }}>{m.l}</div>
                    <div style={{ fontSize:15,fontWeight:800,color:m.c,marginTop:3 }}>{m.v}</div>
                  </Card>
                ))}
              </div>
              {catsConPlatos.length>1&&(
                <div style={{ display:"flex",gap:8,overflowX:"auto",padding:"12px 0 4px",WebkitOverflowScrolling:"touch" }}>
                  <button onClick={()=>setFiltro("todos")} style={{ flexShrink:0,background:filtro==="todos"?"#22c55e":"#1c1c1e",border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,fontWeight:700,color:filtro==="todos"?"#000":"#9ca3af",cursor:"pointer",fontFamily:"inherit" }}>
                    Todos ({platos.length})
                  </button>
                  {catsConPlatos.map(cat=>{
                    const count=platos.filter(p=>p.categoria===cat.id).length;
                    return (
                      <button key={cat.id} onClick={()=>setFiltro(cat.id)} style={{ flexShrink:0,background:filtro===cat.id?"#22c55e":"#1c1c1e",border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,fontWeight:700,color:filtro===cat.id?"#000":"#9ca3af",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>
                        {cat.emoji} {cat.label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {platos.length===0 ? (
            <Card style={{ textAlign:"center",padding:"48px 20px",marginTop:8 }}>
              <div style={{ fontSize:48,marginBottom:14 }}>🍽</div>
              <div style={{ fontSize:18,fontWeight:700,color:"#f5f5f5",marginBottom:8 }}>Sin platos todavía</div>
              <div style={{ fontSize:14,color:"#6b7280",marginBottom:24,lineHeight:1.6 }}>Agrega tu primer plato para ver el food cost en tiempo real.</div>
              <Btn onClick={abrirNuevo} full>Agregar mi primer plato</Btn>
            </Card>
          ) : (
            <>
              <Lbl>{filtro==="todos"?"Todos los platos":catPlato(filtro).label}</Lbl>
              {filtrados.map(p=>{
                const c=calcPlato(p,ingsMap[p.id]); const sem=semaforo(c.fc); const cat=catPlato(p.categoria);
                return (
                  <Card key={p.id} onClick={()=>abrirEditar(p)} style={{ display:"flex",alignItems:"center",gap:12 }}>
                    <div style={{ width:48,height:48,borderRadius:14,background:sem?sem.bg:"#111",border:`1px solid ${sem?sem.br:"#2c2c2e"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0 }}>
                      {cat.emoji}
                    </div>
                    <div style={{ flex:1,minWidth:0 }}>
                      <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
                        <div style={{ fontSize:16,fontWeight:700,color:"#f5f5f5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{p.nombre}</div>
                        <div style={{ fontSize:10,background:"#2c2c2e",color:"#6b7280",padding:"2px 7px",borderRadius:6,flexShrink:0 }}>{cat.label}</div>
                      </div>
                      <div style={{ fontSize:12,color:"#6b7280" }}>
                        Venta: {Q(p.precio)} · Costo: {Q(c.total)} · <span style={{ color:c.ganancia>=0?"#22c55e":"#f87171" }}>Ganancia: {Q(c.ganancia)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign:"right",flexShrink:0 }}>
                      <div style={{ fontSize:20,fontWeight:800,color:sem?sem.c:"#6b7280" }}>{pct(c.fc)}</div>
                      <div style={{ fontSize:11,color:sem?sem.c:"#6b7280",marginTop:1 }}>{sem?sem.label:"—"}</div>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}
      <div style={{ height:20 }} />
    </div>
  );
}

function PlatoEditor({ plato, onGuardar, onVolver, onEliminar }) {
  const [p, setP] = useState(plato);
  const [saving, setSaving] = useState(false);
  const c = calcPlato(p, p.ings);
  const sem = semaforo(c.fc);

  const setIng = (i,f,v) => setP(prev=>{ const ings=[...prev.ings]; ings[i]={...ings[i],[f]:v}; return {...prev,ings}; });
  const addIng = () => setP(prev=>({...prev,ings:[...prev.ings,{nombre:"",cant:"",precio:""}]}));
  const delIng = (i) => setP(prev=>({...prev,ings:prev.ings.filter((_,idx)=>idx!==i)}));
  const handleGuardar = async () => { setSaving(true); await onGuardar(p); setSaving(false); };

  return (
    <div style={{ padding:"0 16px" }}>
      <div style={{ padding:"52px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <button onClick={onVolver} style={{ background:"transparent",border:"none",color:"#9ca3af",fontSize:28,cursor:"pointer",fontFamily:"inherit",lineHeight:1,padding:"0 8px 0 0" }}>‹</button>
        <div style={{ flex:1,fontSize:20,fontWeight:800,color:"#f5f5f5" }}>{p.id?"Editar plato":"Nuevo plato"}</div>
        <Btn small onClick={handleGuardar} disabled={!p.nombre||!p.precio||saving}>{saving?"...":"Guardar"}</Btn>
      </div>

      <Lbl>Categoría</Lbl>
      <div style={{ display:"flex",gap:8,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch" }}>
        {CATS_PLATOS.map(cat=>{
          const activo=p.categoria===cat.id;
          return <button key={cat.id} onClick={()=>setP(prev=>({...prev,categoria:cat.id}))} style={{ flexShrink:0,background:activo?"#22c55e":"#1c1c1e",border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,fontWeight:700,color:activo?"#000":"#9ca3af",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>{cat.emoji} {cat.label}</button>;
        })}
      </div>

      <Lbl>Nombre del plato</Lbl>
      <input type="text" value={p.nombre||""} onChange={e=>setP(prev=>({...prev,nombre:e.target.value}))} placeholder="Ej: Spicy Tuna Roll"
        style={{ width:"100%",background:"#1c1c1e",border:"none",borderRadius:14,padding:"15px 16px",fontSize:17,color:"#f5f5f5",fontFamily:"inherit",boxSizing:"border-box",outline:"none" }} />

      <Lbl>Precio de venta al cliente</Lbl>
      <div style={{ display:"flex",alignItems:"center",background:"#1c1c1e",borderRadius:14,overflow:"hidden" }}>
        <span style={{ padding:"0 14px",fontSize:18,fontWeight:700,color:"#4b5563" }}>Q</span>
        <input type="number" inputMode="decimal" value={p.precio||""} onChange={e=>setP(prev=>({...prev,precio:e.target.value}))} placeholder="0"
          style={{ flex:1,background:"transparent",border:"none",outline:"none",padding:"15px 14px 15px 0",fontSize:22,fontWeight:800,color:"#f5f5f5",fontFamily:"inherit",width:"100%" }} />
      </div>

      <Lbl>Ingredientes — por 1 plato</Lbl>
      <Card style={{ background:"#111",padding:"12px 14px" }}>
        <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 28px",gap:6,marginBottom:8 }}>
          {["Ingrediente","Cantidad","Costo Q",""].map((h,i)=><div key={i} style={{ fontSize:10,color:"#4b5563",fontWeight:700,textTransform:"uppercase" }}>{h}</div>)}
        </div>
        {(p.ings||[]).map((ing,i)=>(
          <div key={i} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 28px",gap:6,marginBottom:8,alignItems:"center" }}>
            <input type="text" value={ing.nombre||""} onChange={e=>setIng(i,"nombre",e.target.value)} placeholder="Arroz..."
              style={{ background:"#2c2c2e",border:"none",borderRadius:10,padding:"10px",fontSize:14,color:"#f5f5f5",fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box" }} />
            <input type="number" inputMode="decimal" value={ing.cant||""} onChange={e=>setIng(i,"cant",e.target.value)} placeholder="150"
              style={{ background:"#2c2c2e",border:"none",borderRadius:10,padding:"10px 8px",fontSize:14,fontWeight:700,color:"#f5f5f5",fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",textAlign:"center" }} />
            <input type="number" inputMode="decimal" value={ing.precio||""} onChange={e=>setIng(i,"precio",e.target.value)} placeholder="0.00"
              style={{ background:"#2c2c2e",border:"none",borderRadius:10,padding:"10px 8px",fontSize:14,fontWeight:700,color:"#f5f5f5",fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box",textAlign:"center" }} />
            <button onClick={()=>delIng(i)} disabled={(p.ings||[]).length===1} style={{ background:"transparent",border:"none",color:(p.ings||[]).length===1?"#2c2c2e":"#6b7280",fontSize:20,cursor:(p.ings||[]).length===1?"default":"pointer",padding:0,lineHeight:1 }}>×</button>
          </div>
        ))}
        <button onClick={addIng} style={{ width:"100%",background:"#2c2c2e",border:"none",borderRadius:10,padding:"10px",color:"#6b7280",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:4 }}>+ Agregar ingrediente</button>
      </Card>

      <Lbl>Merma y desperdicio</Lbl>
      <Card style={{ padding:"14px 16px" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
          <span style={{ fontSize:13,color:"#9ca3af" }}>Porcentaje de merma</span>
          <span style={{ fontSize:18,fontWeight:800,color:"#f5f5f5" }}>{p.merma||10}%</span>
        </div>
        <input type="range" min="0" max="20" value={p.merma||10} onChange={e=>setP(prev=>({...prev,merma:+e.target.value}))} style={{ width:"100%",accentColor:"#22c55e" }} />
        <div style={{ fontSize:11,color:"#4b5563",marginTop:6 }}>Recomendado 8–12%</div>
      </Card>

      {+p.precio>0&&c.total>0&&(
        <>
          <Lbl>Resultado en vivo</Lbl>
          <Card style={{ background:sem?sem.bg:"#111",border:`1px solid ${sem?sem.br:"#2c2c2e"}` }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14 }}>
              {[{l:"Costo real",v:Q(c.total),c2:"#f5f5f5"},{l:"Ganancia",v:Q(c.ganancia),c2:c.ganancia>=0?"#22c55e":"#f87171"},{l:"Food cost",v:pct(c.fc),c2:sem?sem.c:"#f5f5f5"}].map((m,i)=>(
                <div key={i} style={{ textAlign:"center",background:"#00000030",borderRadius:10,padding:"10px 4px" }}>
                  <div style={{ fontSize:10,color:"#6b7280",marginBottom:4 }}>{m.l}</div>
                  <div style={{ fontSize:17,fontWeight:800,color:m.c2 }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:12,color:"#4b5563",marginBottom:10 }}>Ingredientes: {Q(c.costo)} + Merma: {Q(c.merma)} = {Q(c.total)}</div>
            {sem&&(
              <div style={{ display:"flex",alignItems:"center",gap:10,background:sem.c+"18",border:`1px solid ${sem.c}33`,padding:"10px 12px",borderRadius:12 }}>
                <span style={{ fontSize:20 }}>{sem.emoji}</span>
                <div><div style={{ fontSize:14,fontWeight:700,color:sem.c }}>{sem.label}</div><div style={{ fontSize:12,color:"#9ca3af",marginTop:2 }}>{sem.desc}</div></div>
              </div>
            )}
          </Card>
        </>
      )}

      {p.id&&<div style={{ marginTop:8,marginBottom:4 }}><Btn variant="ghost" full small onClick={()=>onEliminar(p.id)}>Eliminar este plato</Btn></div>}
      <div style={{ height:32 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREEN: INVENTARIO
// ═══════════════════════════════════════════════════════════════════════════
function Inventario() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("lista");
  const [editItem, setEditItem] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [toast, setToast] = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await sb.from("inventario").select("*").order("nombre");
    setItems(data||[]);
    setLoading(false);
  },[]);

  useEffect(()=>{ fetchAll(); },[fetchAll]);

  useEffect(()=>{
    const ch = sb.channel("inv-realtime")
      .on("postgres_changes",{event:"*",schema:"public",table:"inventario"},fetchAll)
      .subscribe();
    return ()=>sb.removeChannel(ch);
  },[fetchAll]);

  const abrirNuevo = () => { setEditItem({ nombre:"",categoria:"general",cantidad:0,unidad:"kg",minimo:0,costo_unitario:0 }); setVista("editor"); };
  const abrirEditar = (item) => { setEditItem({...item}); setVista("editor"); };

  const guardar = async (item) => {
    if (!item.nombre) return;
    if (item.id) {
      await sb.from("inventario").update({ nombre:item.nombre,categoria:item.categoria,cantidad:+item.cantidad,unidad:item.unidad,minimo:+item.minimo,costo_unitario:+item.costo_unitario,updated_at:new Date().toISOString() }).eq("id",item.id);
    } else {
      await sb.from("inventario").insert({ nombre:item.nombre,categoria:item.categoria,cantidad:+item.cantidad,unidad:item.unidad,minimo:+item.minimo,costo_unitario:+item.costo_unitario });
    }
    setToast("✓ Guardado"); setVista("lista");
  };

  const eliminar = async (id) => {
    if (!confirm("¿Eliminar este producto?")) return;
    await sb.from("inventario").delete().eq("id",id);
    setToast("Eliminado"); setVista("lista");
  };

  const ajustarCantidad = async (id, delta) => {
    const item = items.find(i=>i.id===id);
    if (!item) return;
    const nueva = Math.max(0, (+item.cantidad||0)+delta);
    await sb.from("inventario").update({ cantidad:nueva, updated_at:new Date().toISOString() }).eq("id",id);
  };

  if (vista==="editor"&&editItem) {
    return <InventarioEditor item={editItem} onGuardar={guardar} onVolver={()=>setVista("lista")} onEliminar={eliminar} />;
  }

  const criticos = items.filter(i=>(+i.cantidad||0)<=(+i.minimo||0)&&(+i.minimo||0)>0);
  const catsConItems = CATS_INV.filter(c=>items.some(i=>i.categoria===c.id));
  const filtrados = filtro==="todos" ? items : items.filter(i=>i.categoria===filtro);

  return (
    <div style={{ padding:"0 16px" }}>
      {toast&&<Toast msg={toast} onClose={()=>setToast("")} />}
      <div style={{ padding:"52px 0 16px",display:"flex",justifyContent:"space-between",alignItems:"flex-end" }}>
        <div>
          <div style={{ fontSize:26,fontWeight:800,color:"#f5f5f5" }}>Inventario</div>
          <div style={{ fontSize:13,color:"#6b7280",marginTop:2 }}>{items.length} producto{items.length!==1?"s":""} · Tiempo real 🟢</div>
        </div>
        <button onClick={abrirNuevo} style={{ background:"#22c55e",border:"none",borderRadius:14,width:44,height:44,fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"#000",fontWeight:800 }}>+</button>
      </div>

      {loading ? <Spinner /> : (
        <>
          {criticos.length>0&&(
            <Card style={{ background:"#1c0000",border:"1px solid #7f1d1d",marginBottom:12 }}>
              <div style={{ fontSize:13,fontWeight:700,color:"#f87171",marginBottom:8 }}>🔴 Stock bajo — {criticos.length} producto{criticos.length>1?"s":""}</div>
              {criticos.map(i=>(
                <div key={i.id} style={{ fontSize:13,color:"#fca5a5",marginBottom:4 }}>• {i.nombre} — {i.cantidad} {i.unidad} (mínimo: {i.minimo})</div>
              ))}
            </Card>
          )}

          {items.length>0&&catsConItems.length>1&&(
            <div style={{ display:"flex",gap:8,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch" }}>
              <button onClick={()=>setFiltro("todos")} style={{ flexShrink:0,background:filtro==="todos"?"#22c55e":"#1c1c1e",border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,fontWeight:700,color:filtro==="todos"?"#000":"#9ca3af",cursor:"pointer",fontFamily:"inherit" }}>
                Todos ({items.length})
              </button>
              {catsConItems.map(cat=>{
                const count=items.filter(i=>i.categoria===cat.id).length;
                return <button key={cat.id} onClick={()=>setFiltro(cat.id)} style={{ flexShrink:0,background:filtro===cat.id?"#22c55e":"#1c1c1e",border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,fontWeight:700,color:filtro===cat.id?"#000":"#9ca3af",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>{cat.emoji} {cat.label} ({count})</button>;
              })}
            </div>
          )}

          {items.length===0 ? (
            <Card style={{ textAlign:"center",padding:"48px 20px",marginTop:8 }}>
              <div style={{ fontSize:48,marginBottom:14 }}>📦</div>
              <div style={{ fontSize:18,fontWeight:700,color:"#f5f5f5",marginBottom:8 }}>Sin productos todavía</div>
              <div style={{ fontSize:14,color:"#6b7280",marginBottom:24,lineHeight:1.6 }}>Agrega tus ingredientes y materiales para controlar el inventario.</div>
              <Btn onClick={abrirNuevo} full>Agregar primer producto</Btn>
            </Card>
          ) : (
            <>
              <Lbl>{filtro==="todos"?"Todos los productos":catInv(filtro).label}</Lbl>
              {filtrados.map(item=>{
                const bajo=(+item.cantidad||0)<=(+item.minimo||0)&&(+item.minimo||0)>0;
                const cat=catInv(item.categoria);
                return (
                  <Card key={item.id} style={{ border:bajo?"1px solid #7f1d1d":undefined }}>
                    <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:10 }}>
                      <div style={{ width:44,height:44,borderRadius:12,background:bajo?"#1c0000":"#2c2c2e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0 }}>{cat.emoji}</div>
                      <div style={{ flex:1,minWidth:0 }} onClick={()=>abrirEditar(item)}>
                        <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                          <div style={{ fontSize:15,fontWeight:700,color:"#f5f5f5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{item.nombre}</div>
                          {bajo&&<span style={{ fontSize:10,background:"#7f1d1d",color:"#fca5a5",padding:"2px 6px",borderRadius:6,flexShrink:0 }}>BAJO</span>}
                        </div>
                        <div style={{ fontSize:12,color:"#6b7280",marginTop:2 }}>
                          Costo: {Q(item.costo_unitario)}/{item.unidad} · Mínimo: {item.minimo} {item.unidad}
                        </div>
                      </div>
                      <div style={{ textAlign:"right",flexShrink:0 }}>
                        <div style={{ fontSize:20,fontWeight:800,color:bajo?"#f87171":"#22c55e" }}>{item.cantidad}</div>
                        <div style={{ fontSize:11,color:"#6b7280" }}>{item.unidad}</div>
                      </div>
                    </div>
                    {/* Botones ajuste rápido */}
                    <div style={{ display:"flex",gap:8,alignItems:"center" }}>
                      <button onClick={()=>ajustarCantidad(item.id,-1)} style={{ flex:1,background:"#2c2c2e",border:"none",borderRadius:10,padding:"8px",fontSize:18,color:"#f87171",cursor:"pointer",fontFamily:"inherit",fontWeight:700 }}>−</button>
                      <div style={{ flex:2,textAlign:"center",fontSize:12,color:"#6b7280" }}>Ajustar cantidad</div>
                      <button onClick={()=>ajustarCantidad(item.id,+1)} style={{ flex:1,background:"#2c2c2e",border:"none",borderRadius:10,padding:"8px",fontSize:18,color:"#22c55e",cursor:"pointer",fontFamily:"inherit",fontWeight:700 }}>+</button>
                    </div>
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}
      <div style={{ height:20 }} />
    </div>
  );
}

function InventarioEditor({ item, onGuardar, onVolver, onEliminar }) {
  const [p, setP] = useState(item);
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ padding:"0 16px" }}>
      <div style={{ padding:"52px 0 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
        <button onClick={onVolver} style={{ background:"transparent",border:"none",color:"#9ca3af",fontSize:28,cursor:"pointer",fontFamily:"inherit",lineHeight:1,padding:"0 8px 0 0" }}>‹</button>
        <div style={{ flex:1,fontSize:20,fontWeight:800,color:"#f5f5f5" }}>{p.id?"Editar producto":"Nuevo producto"}</div>
        <Btn small onClick={async()=>{ setSaving(true); await onGuardar(p); setSaving(false); }} disabled={!p.nombre||saving}>{saving?"...":"Guardar"}</Btn>
      </div>

      <Lbl>Categoría</Lbl>
      <div style={{ display:"flex",gap:8,overflowX:"auto",paddingBottom:6,WebkitOverflowScrolling:"touch" }}>
        {CATS_INV.map(cat=>{
          const activo=p.categoria===cat.id;
          return <button key={cat.id} onClick={()=>setP(prev=>({...prev,categoria:cat.id}))} style={{ flexShrink:0,background:activo?"#22c55e":"#1c1c1e",border:"none",borderRadius:20,padding:"8px 14px",fontSize:13,fontWeight:700,color:activo?"#000":"#9ca3af",cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap" }}>{cat.emoji} {cat.label}</button>;
        })}
      </div>

      <Lbl>Nombre del producto</Lbl>
      <input type="text" value={p.nombre||""} onChange={e=>setP(prev=>({...prev,nombre:e.target.value}))} placeholder="Ej: Chashu de cerdo"
        style={{ width:"100%",background:"#1c1c1e",border:"none",borderRadius:14,padding:"15px 16px",fontSize:17,color:"#f5f5f5",fontFamily:"inherit",boxSizing:"border-box",outline:"none" }} />

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16 }}>
        <div>
          <Lbl>Cantidad actual</Lbl>
          <div style={{ display:"flex",alignItems:"center",background:"#1c1c1e",borderRadius:14,overflow:"hidden" }}>
            <input type="number" inputMode="decimal" value={p.cantidad||""} onChange={e=>setP(prev=>({...prev,cantidad:e.target.value}))} placeholder="0"
              style={{ flex:1,background:"transparent",border:"none",outline:"none",padding:"13px 14px",fontSize:20,fontWeight:800,color:"#f5f5f5",fontFamily:"inherit",width:"100%" }} />
          </div>
        </div>
        <div>
          <Lbl>Unidad</Lbl>
          <select value={p.unidad||"kg"} onChange={e=>setP(prev=>({...prev,unidad:e.target.value}))}
            style={{ width:"100%",background:"#1c1c1e",border:"none",borderRadius:14,padding:"14px",fontSize:16,color:"#f5f5f5",fontFamily:"inherit",outline:"none" }}>
            {UNIDADES.map(u=><option key={u}>{u}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4 }}>
        <div>
          <Lbl>Stock mínimo</Lbl>
          <div style={{ display:"flex",alignItems:"center",background:"#1c1c1e",borderRadius:14,overflow:"hidden" }}>
            <input type="number" inputMode="decimal" value={p.minimo||""} onChange={e=>setP(prev=>({...prev,minimo:e.target.value}))} placeholder="0"
              style={{ flex:1,background:"transparent",border:"none",outline:"none",padding:"13px 14px",fontSize:20,fontWeight:800,color:"#f5f5f5",fontFamily:"inherit",width:"100%" }} />
          </div>
          <div style={{ fontSize:11,color:"#4b5563",marginTop:4 }}>Alerta si baja de aquí</div>
        </div>
        <div>
          <Lbl>Costo por unidad</Lbl>
          <div style={{ display:"flex",alignItems:"center",background:"#1c1c1e",borderRadius:14,overflow:"hidden" }}>
            <span style={{ padding:"0 10px",fontSize:14,fontWeight:700,color:"#4b5563" }}>Q</span>
            <input type="number" inputMode="decimal" value={p.costo_unitario||""} onChange={e=>setP(prev=>({...prev,costo_unitario:e.target.value}))} placeholder="0"
              style={{ flex:1,background:"transparent",border:"none",outline:"none",padding:"13px 8px 13px 0",fontSize:20,fontWeight:800,color:"#f5f5f5",fontFamily:"inherit",width:"100%" }} />
          </div>
        </div>
      </div>

      {p.id&&<div style={{ marginTop:20,marginBottom:4 }}><Btn variant="ghost" full small onClick={()=>onEliminar(p.id)}>Eliminar este producto</Btn></div>}
      <div style={{ height:32 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [tab, setTab] = useState("platos");

  const tabs = [
    { id:"platos",    emoji:"🍽", label:"Costeo" },
    { id:"inventario",emoji:"📦", label:"Inventario" },
  ];

  return (
    <div style={{ background:"#080808",minHeight:"100vh",maxWidth:430,margin:"0 auto",fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif",color:"#f5f5f5" }}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}input,button,select{font-family:inherit}::-webkit-scrollbar{display:none}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}input[type=range]{accent-color:#22c55e}`}</style>

      <div style={{ overflowY:"auto",height:"calc(100vh - 70px)",WebkitOverflowScrolling:"touch" }}>
        {tab==="platos"&&<Platos />}
        {tab==="inventario"&&<Inventario />}
      </div>

      <div style={{ position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"#0a0a0a",borderTop:"1px solid #1c1c1e",display:"flex",paddingBottom:"env(safe-area-inset-bottom)" }}>
        {tabs.map(t=>(
          <div key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 0 8px",cursor:"pointer" }}>
            <div style={{ fontSize:tab===t.id?26:22,transition:"font-size .15s" }}>{t.emoji}</div>
            <div style={{ fontSize:10,fontWeight:tab===t.id?700:400,color:tab===t.id?"#22c55e":"#4b5563",marginTop:2 }}>{t.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

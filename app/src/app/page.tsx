"use client";

import { useEffect } from "react";
import Link from "next/link";

const SIGN_IN_URL = "/sign-in";
const SIGN_IN_HREF = "https://www.hello-roomly.com/sign-in";

export default function LandingPage() {
  useEffect(() => {
    const rooms = ["Suite 101", "Deluxe 102", "Est. 103", "Est. 104", "Junior 105", "Suite 106"];
    const days = ["L 7", "M 8", "X 9", "J 10", "V 11", "S 12", "D 13"];
    const bookings = [
      { r: 0, s: 0, e: 2, bg: "#0C48AD", tx: "#fff", n: "García" },
      { r: 1, s: 1, e: 4, bg: "#FFBC1A", tx: "#041B42", n: "Martínez" },
      { r: 2, s: 3, e: 6, bg: "#0C48AD", tx: "#fff", n: "López" },
      { r: 3, s: 0, e: 1, bg: "#77B9FF", tx: "#041B42", n: "Soto" },
      { r: 4, s: 4, e: 6, bg: "#BF0A43", tx: "#fff", n: "Ramírez" },
      { r: 5, s: 1, e: 3, bg: "#FFBC1A", tx: "#041B42", n: "Torres" },
      { r: 0, s: 4, e: 6, bg: "#77B9FF", tx: "#041B42", n: "Herrera" },
      { r: 3, s: 3, e: 5, bg: "#0C48AD", tx: "#fff", n: "Vega" },
    ];

    const grid = document.getElementById("cal-grid");
    if (!grid) return;

    const hr = document.createElement("div");
    hr.style.cssText =
      "display:grid;grid-template-columns:60px repeat(7,1fr);gap:3px;margin-bottom:3px";
    hr.innerHTML =
      "<div></div>" +
      days
        .map(
          (d) =>
            `<div style="text-align:center;font-size:0.58rem;color:#94a3b8;font-weight:600;padding:2px 0">${d}</div>`
        )
        .join("");
    grid.appendChild(hr);

    rooms.forEach((_, ri) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:grid;grid-template-columns:60px repeat(7,1fr);gap:3px;align-items:center;margin-bottom:2px";
      const lbl = document.createElement("div");
      lbl.style.cssText =
        "font-size:0.6rem;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:4px;font-weight:500";
      lbl.textContent = rooms[ri];
      row.appendChild(lbl);
      for (let di = 0; di < 7; di++) {
        const cell = document.createElement("div");
        cell.id = `c${ri}-${di}`;
        cell.style.cssText =
          "height:24px;background:#F1F5F9;border-radius:4px;position:relative;overflow:hidden;transition:background .35s";
        row.appendChild(cell);
      }
      grid.appendChild(row);
    });

    let timer: ReturnType<typeof setTimeout>;

    function animate() {
      rooms.forEach((_, ri) => {
        for (let di = 0; di < 7; di++) {
          const c = document.getElementById(`c${ri}-${di}`);
          if (c) {
            c.style.background = "#F1F5F9";
            c.style.borderRadius = "4px";
            c.innerHTML = "";
          }
        }
      });
      bookings.forEach((b, bi) => {
        setTimeout(() => {
          for (let d = b.s; d <= b.e; d++) {
            const cell = document.getElementById(`c${b.r}-${d}`);
            if (!cell) return;
            cell.style.background = b.bg;
            const isSingle = b.s === b.e,
              isStart = d === b.s,
              isEnd = d === b.e;
            cell.style.borderRadius = isSingle
              ? "4px"
              : isStart
              ? "4px 0 0 4px"
              : isEnd
              ? "0 4px 4px 0"
              : "0";
            if (isStart) {
              const lbl = document.createElement("div");
              lbl.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;padding:0 6px;font-size:0.56rem;font-weight:700;color:${b.tx};white-space:nowrap;overflow:hidden`;
              lbl.textContent = b.n;
              cell.appendChild(lbl);
            }
          }
        }, bi * 380 + 400);
      });
      timer = setTimeout(animate, bookings.length * 380 + 3000);
    }

    animate();

    setTimeout(() => {
      const n = document.getElementById("notif");
      if (n) { n.style.opacity = "1"; n.style.transform = "translateY(0)"; }
    }, 1200);
    setTimeout(() => {
      const b = document.getElementById("badge-occ");
      if (b) { b.style.opacity = "1"; b.style.transform = "translateY(0)"; }
    }, 2000);

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).style.opacity = "1";
            (e.target as HTMLElement).style.transform = "translateY(0)";
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".pain-card,.feat-card,.step").forEach((el) => {
      (el as HTMLElement).style.opacity = "0";
      (el as HTMLElement).style.transform = "translateY(16px)";
      (el as HTMLElement).style.transition = "opacity .5s ease,transform .5s ease";
      obs.observe(el);
    });

    return () => {
      clearTimeout(timer);
      obs.disconnect();
    };
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;color:#041B42;overflow-x:hidden}
        a{text-decoration:none;color:inherit}
        .pain-card:hover{background:rgba(255,255,255,0.07)!important;border-color:rgba(255,188,26,0.25)!important}
        .feat-card:hover{border-color:#0C48AD!important;transform:translateY(-2px)}
        .feat-card{transition:border-color .2s,transform .2s}
        .nav-sign-in:hover{background:#f1f5f9!important}
        .nav-demo:hover{background:#0a3d96!important}
        .btn-gold:hover{background:#f0a800!important}
      `}</style>

      {/* NAV */}
      <nav style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 48px",background:"#fff",borderBottom:"1px solid #e5e7eb",position:"sticky",top:0,zIndex:50}}>
        <Link href="/" style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:36,height:36,background:"#FFBC1A",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>🚪</div>
          <span style={{fontSize:"1.6rem",fontWeight:700,color:"#041B42",letterSpacing:"-0.03em"}}>Roomly</span>
        </Link>
        <ul style={{display:"flex",gap:28,alignItems:"center",listStyle:"none"}}>
          <li><a href="#funciones" style={{fontSize:"0.82rem",fontWeight:500,color:"#64748b"}}>Funciones</a></li>
          <li><a href="#como-funciona" style={{fontSize:"0.82rem",fontWeight:500,color:"#64748b"}}>Cómo funciona</a></li>
          <li style={{width:1,height:20,background:"#e2e8f0"}}></li>
          <li>
            <Link href={SIGN_IN_URL} className="nav-sign-in" style={{fontSize:"0.82rem",fontWeight:500,color:"#041B42",border:"1px solid #CBD5E1",padding:"8px 18px",borderRadius:8,display:"flex",alignItems:"center",gap:6}}>
              Iniciar sesión
            </Link>
          </li>
          <li>
            <a href="mailto:hola@hello-roomly.com" className="nav-demo" style={{background:"#0C48AD",color:"#fff",padding:"9px 22px",borderRadius:8,fontWeight:600,fontSize:"0.82rem",display:"flex",alignItems:"center",gap:6}}>
              Solicitar demo
            </a>
          </li>
        </ul>
      </nav>

      {/* HERO */}
      <section style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:64,alignItems:"center",padding:"72px 48px 64px",maxWidth:1200,margin:"0 auto"}}>
        <div>
          <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#0C48AD",fontSize:"0.72rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:"5px 14px",borderRadius:20,marginBottom:24}}>
            Sistema hotelero todo en uno
          </div>
          <h1 style={{fontSize:"clamp(2.4rem,3.8vw,3.8rem)",fontWeight:700,lineHeight:1.1,letterSpacing:"-0.03em",marginBottom:20,color:"#041B42"}}>
            Tu hotel,<br />sin el{" "}
            <span style={{color:"#FFBC1A",borderBottom:"3px solid #FFBC1A",paddingBottom:1}}>caos.</span>
          </h1>
          <p style={{fontSize:"1rem",lineHeight:1.75,color:"#475569",marginBottom:36}}>
            Roomly reemplaza las hojas de cálculo y los mensajes de WhatsApp con un panel completo de reservas, pagos y reportes — diseñado para hoteles boutique en México.
          </p>
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:48,flexWrap:"wrap"}}>
            <a href="mailto:hola@hello-roomly.com" style={{display:"inline-flex",alignItems:"center",gap:8,background:"#0C48AD",color:"#fff",padding:"13px 28px",borderRadius:10,fontSize:"0.9rem",fontWeight:600}}>
              Solicitar demo gratis →
            </a>
            <Link href={SIGN_IN_URL} style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EEEEEE",color:"#041B42",padding:"13px 24px",borderRadius:10,fontSize:"0.9rem",fontWeight:500}}>
              Iniciar sesión
            </Link>
          </div>
          <div style={{display:"flex",gap:32,paddingTop:32,borderTop:"1px solid #e2e8f0"}}>
            {[["100%","en línea, sin instalación"],["MXN","pagos en pesos mexicanos"],["48h","para empezar a operar"]].map(([num,lbl])=>(
              <div key={num}>
                <div style={{fontSize:"1.8rem",fontWeight:700,color:"#0C48AD",lineHeight:1}}>{num}</div>
                <div style={{fontSize:"0.72rem",color:"#94a3b8",marginTop:4}}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{position:"relative"}}>
          <div style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,overflow:"hidden",boxShadow:"0 4px 24px rgba(12,72,173,0.08)"}}>
            <div style={{background:"#041B42",padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{display:"flex",gap:5}}>
                  {[0,1,2].map(i=><span key={i} style={{width:9,height:9,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"block"}}></span>)}
                </div>
                <span style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.6)",letterSpacing:"0.06em",textTransform:"uppercase",fontWeight:500}}>Panel Roomly — Calendario</span>
              </div>
              <div style={{background:"#FFBC1A",color:"#041B42",fontSize:"0.6rem",fontWeight:700,padding:"2px 8px",borderRadius:4}}>LIVE</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"68px 1fr"}}>
              <div style={{background:"#F8FAFC",borderRight:"1px solid #e2e8f0",padding:"12px 8px"}}>
                {[["Cal","📅",true],["Res","📋",false],["Pago","💳",false],["Rep","📊",false]].map(([label,,active])=>(
                  <div key={label as string} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 8px",borderRadius:8,background:active?"#0C48AD":"transparent",color:active?"#fff":"#94a3b8",fontSize:"0.68rem",fontWeight:active?600:400,marginBottom:4}}>
                    {label}
                  </div>
                ))}
              </div>
              <div style={{padding:14}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <span style={{fontWeight:700,fontSize:"0.9rem",color:"#041B42"}}>Julio 2025</span>
                  <div style={{display:"flex",gap:4,color:"#94a3b8",fontSize:"0.85rem"}}>‹ ›</div>
                </div>
                <div id="cal-grid" style={{display:"grid",gap:3}}></div>
              </div>
            </div>
          </div>

          <div id="notif" style={{position:"absolute",top:56,right:-18,background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,minWidth:195,opacity:0,transition:"opacity .5s,transform .5s",transform:"translateY(8px)",boxShadow:"0 4px 20px rgba(0,0,0,0.08)"}}>
            <div style={{width:32,height:32,background:"#D1FAE5",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"1rem"}}>✓</div>
            <div>
              <div style={{fontSize:"0.72rem",fontWeight:600,color:"#041B42"}}>Nueva reserva confirmada</div>
              <div style={{fontSize:"0.63rem",color:"#64748b",marginTop:2}}>García · Hab. 102 · 4 noches</div>
            </div>
          </div>

          <div id="badge-occ" style={{position:"absolute",bottom:32,left:-18,background:"#0C48AD",color:"#fff",borderRadius:12,padding:"12px 18px",opacity:0,transition:"opacity .5s,transform .5s",transform:"translateY(8px)"}}>
            <div style={{fontSize:"1.6rem",fontWeight:700,color:"#FFBC1A",lineHeight:1}}>87%</div>
            <div style={{fontSize:"0.68rem",marginTop:2,color:"#fff"}}>ocupación este mes</div>
          </div>
        </div>
      </section>

      {/* PAIN */}
      <section style={{background:"#041B42",padding:"80px 48px",color:"#fff"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,188,26,0.15)",border:"1px solid rgba(255,188,26,0.35)",color:"#FFBC1A",fontSize:"0.7rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 12px",borderRadius:20,marginBottom:20}}>
            El problema
          </div>
          <h2 style={{fontSize:"clamp(1.8rem,2.8vw,2.8rem)",fontWeight:700,lineHeight:1.2,marginBottom:12,letterSpacing:"-0.02em",color:"#fff"}}>
            Gestionar un hotel no debería<br />depender del{" "}
            <span style={{color:"#FFBC1A"}}>WhatsApp y Excel</span>
          </h2>
          <p style={{color:"#CBD5E1",fontSize:"0.9rem",marginBottom:52,maxWidth:500,lineHeight:1.7}}>
            La mayoría de los hoteles boutique en México operan con herramientas que no fueron hechas para ellos. El resultado: errores, estrés y clientes insatisfechos.
          </p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
            {[
              {icon:"📋",title:"Reservas perdidas en correos",body:"Confirmar manualmente cada reserva toma horas. Una habitación doble-reservada arruina la experiencia de dos familias y la reputación de tu hotel."},
              {icon:"💱",title:"Cobros sin trazabilidad",body:"Transferencias no identificadas, anticipos sin registro y saldos pendientes generan fricciones con los huéspedes y dolor de cabeza en finanzas."},
              {icon:"📉",title:"Sin visibilidad de la operación",body:"¿Cuánto ingresaste el mes pasado? ¿Qué habitación vende más? Sin datos, cada decisión es una apuesta. Con Roomly, son certezas."},
            ].map(({icon,title,body})=>(
              <div key={title} className="pain-card" style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:"32px 26px",transition:"background .2s,border-color .2s"}}>
                <div style={{width:40,height:40,background:"rgba(255,188,26,0.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18,fontSize:"1.2rem"}}>{icon}</div>
                <h3 style={{fontSize:"0.95rem",fontWeight:600,marginBottom:10,color:"#fff"}}>{title}</h3>
                <p style={{fontSize:"0.85rem",lineHeight:1.7,color:"#CBD5E1"}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funciones" style={{padding:"80px 48px",background:"#EEEEEE"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#0C48AD",fontSize:"0.7rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 12px",borderRadius:20,marginBottom:20}}>
            Funciones
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:48,alignItems:"end",marginBottom:48}}>
            <h2 style={{fontSize:"clamp(1.8rem,2.8vw,2.8rem)",fontWeight:700,letterSpacing:"-0.02em",lineHeight:1.15,color:"#041B42"}}>Todo lo que necesitas.<br />Nada que sobre.</h2>
            <p style={{fontSize:"0.9rem",lineHeight:1.75,color:"#475569",alignSelf:"end"}}>Diseñado para la operación real de un hotel boutique en México — sin funciones innecesarias, sin curvas de aprendizaje.</p>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:16}}>
            {[
              {icon:"📅",title:"Calendario en tiempo real",body:"Ve la ocupación de todas tus habitaciones en una sola vista. Bloqueos, reservas y check-ins actualizados al instante para todo el equipo.",tag:"ACTUALIZACIÓN AL INSTANTE"},
              {icon:"🌐",title:"Portal de reservas online",body:"Tus huéspedes reservan y pagan directamente desde tu portal personalizado, 24/7. Sin intermediarios, sin comisiones de OTA.",tag:"SIN COMISIONES"},
              {icon:"💳",title:"Pagos integrados",body:"Cobra con tarjeta o registra pagos manuales. Anticipos, saldos pendientes y links de pago por correo — todo trazado en pesos.",tag:"PAGOS EN MXN"},
              {icon:"📈",title:"Reportes para decidir",body:"Ocupación, ingresos por temporada y reservas por origen. Para que el dueño y finanzas hablen con datos, no suposiciones.",tag:"REPORTES EXPORTABLES"},
            ].map(({icon,title,body,tag})=>(
              <div key={title} className="feat-card" style={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:14,padding:"36px 32px"}}>
                <div style={{width:48,height:48,background:"#EFF6FF",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:18,fontSize:"1.3rem"}}>{icon}</div>
                <h3 style={{fontSize:"1rem",fontWeight:700,marginBottom:10,color:"#041B42"}}>{title}</h3>
                <p style={{fontSize:"0.85rem",lineHeight:1.7,color:"#475569"}}>{body}</p>
                <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"#F0FDF4",color:"#16a34a",fontSize:"0.65rem",fontWeight:600,padding:"3px 10px",borderRadius:20,marginTop:14}}>
                  ⚡ {tag}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" style={{padding:"80px 48px",background:"#fff"}}>
        <div style={{maxWidth:1200,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#0C48AD",fontSize:"0.7rem",fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase",padding:"4px 12px",borderRadius:20,marginBottom:20}}>
            Cómo funciona
          </div>
          <h2 style={{fontSize:"clamp(1.8rem,2.8vw,2.8rem)",fontWeight:700,letterSpacing:"-0.02em",color:"#041B42",marginBottom:12}}>
            En operación en menos de 48 horas
          </h2>
          <p style={{fontSize:"0.9rem",color:"#64748b",marginBottom:56}}>Sin instalaciones, sin técnicos, sin contratos de largo plazo.</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:32,position:"relative"}}>
            <div style={{position:"absolute",top:28,left:"calc(16.67% + 28px)",right:"calc(16.67% + 28px)",height:1,background:"#BFDBFE"}}></div>
            {[
              {n:1,title:"Configura tu hotel",body:"Carga tus habitaciones, precios por temporada y datos del hotel. Sin tecnicismos, en menos de una hora."},
              {n:2,title:"Activa tu portal",body:"Comparte el link con tus huéspedes. Reservan y pagan directamente — tú recibes la confirmación al instante."},
              {n:3,title:"Opera con claridad",body:"Panel unificado para todo el equipo. Llegadas, salidas, pagos y reportes en un solo lugar."},
            ].map(({n,title,body})=>(
              <div key={n} className="step">
                <div style={{width:56,height:56,borderRadius:"50%",background:"#0C48AD",color:"#fff",fontSize:"1.1rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 22px",position:"relative",zIndex:1,border:"3px solid #EFF6FF"}}>
                  {n}
                </div>
                <h3 style={{fontSize:"1rem",fontWeight:700,color:"#041B42",marginBottom:10}}>{title}</h3>
                <p style={{fontSize:"0.85rem",lineHeight:1.7,color:"#475569"}}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{background:"#0C48AD",padding:"80px 48px",textAlign:"center",color:"#fff"}}>
        <h2 style={{fontSize:"clamp(2rem,3.2vw,3.2rem)",fontWeight:700,letterSpacing:"-0.02em",marginBottom:16,lineHeight:1.15,color:"#fff"}}>
          ¿Listo para dejar el Excel<br />
          <span style={{color:"#FFBC1A"}}>atrás para siempre?</span>
        </h2>
        <p style={{fontSize:"0.95rem",color:"rgba(255,255,255,0.85)",marginBottom:36}}>
          Agenda una demo de 30 minutos y te mostramos Roomly en acción con tu tipo de hotel.
        </p>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
          <a href="mailto:hola@hello-roomly.com" className="btn-gold" style={{display:"inline-flex",alignItems:"center",gap:8,background:"#FFBC1A",color:"#041B42",padding:"14px 36px",borderRadius:10,fontSize:"0.95rem",fontWeight:700,transition:"background .2s"}}>
            Agendar demo gratuita →
          </a>
          <Link href={SIGN_IN_URL} style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.12)",color:"#fff",border:"1px solid rgba(255,255,255,0.3)",padding:"14px 28px",borderRadius:10,fontSize:"0.95rem",fontWeight:500}}>
            Ya tengo cuenta
          </Link>
        </div>
        <p style={{marginTop:16,fontSize:"0.78rem",color:"rgba(255,255,255,0.6)"}}>
          Sin tarjeta de crédito · Sin compromiso · Soporte en español
        </p>
      </section>

      {/* FOOTER */}
      <footer style={{background:"#041B42",padding:"32px 48px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,background:"#FFBC1A",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem"}}>🚪</div>
          <span style={{fontSize:"1.2rem",fontWeight:700,color:"#fff"}}>Roomly</span>
        </div>
        <span style={{fontSize:"0.78rem",color:"#94a3b8"}}>© 2025 Roomly · Hecho en México</span>
        <div style={{display:"flex",gap:20}}>
          <a href="#" style={{fontSize:"0.78rem",color:"#94a3b8"}}>Privacidad</a>
          <a href="#" style={{fontSize:"0.78rem",color:"#94a3b8"}}>Términos</a>
          <Link href={SIGN_IN_URL} style={{fontSize:"0.78rem",color:"#94a3b8"}}>Iniciar sesión</Link>
        </div>
      </footer>
    </>
  );
}

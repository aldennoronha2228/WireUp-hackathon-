/**
 * WireUp Circuit Diagram v2
 * - Draggable components
 * - Mouse-wheel zoom + pan canvas
 * - Live wire rerouting
 * - Proper pin positions on IC sides
 * - Clean, non-overlapping default layout
 */

import { useState, useRef, useCallback, useEffect, type PointerEvent } from "react";

/* ── palette ──────────────────────────────────────────────────────────────── */
const P = {
  bg:       "#0d0f14",
  grid:     "rgba(255,255,255,0.025)",
  text:     "#e2e8f0",
  textDim:  "#6e7280",
  textMid:  "#9ea3b0",
  compFill: "#161924",
  compBdr:  "#2a2d3e",
  pinDot:   "#4fc1ff",
  pinLabel: "#8b93a7",
  // wire colors by signal type
  vcc:   "#f59e0b",
  gnd:   "#6e7280",
  data:  "#4ec9b0",
  i2c:   "#c586c0",
  sda:   "#818cf8",
  scl:   "#a78bfa",
  uart:  "#fb923c",
};

/* ── types ────────────────────────────────────────────────────────────────── */
type Side = "L" | "R" | "T" | "B";

interface CompPin {
  id:    string;
  label: string;
  side:  Side;
  idx:   number; // 0-based index among pins on that side
  total: number; // total pins on that side
}

interface Comp {
  id:    string;
  name:  string;
  sub:   string;
  color: string;
  x:     number;
  y:     number;
  w:     number;
  h:     number;
  pins:  CompPin[];
}

interface NetWire {
  id:       string;
  a:        { comp: string; pin: string };
  b:        { comp: string; pin: string };
  color:    string;
  label:    string;
  dashed?:  boolean;
}

/* ── pin position (in component-local coords, relative to comp.x/y) ─────── */
const STUB = 18; // length of pin stub outside body

function pinOffset(pin: CompPin, w: number, h: number): [number, number] {
  const spacing = (n: number, total: number, dim: number) =>
    (dim / (total + 1)) * (n + 1);

  switch (pin.side) {
    case "L": return [-STUB,          spacing(pin.idx, pin.total, h)];
    case "R": return [w + STUB,       spacing(pin.idx, pin.total, h)];
    case "T": return [spacing(pin.idx, pin.total, w), -STUB];
    case "B": return [spacing(pin.idx, pin.total, w), h + STUB];
  }
}

function pinConnectXY(comp: Comp, pinId: string): [number, number] {
  const pin = comp.pins.find(p => p.id === pinId);
  if (!pin) return [comp.x + comp.w / 2, comp.y + comp.h / 2];
  const [ox, oy] = pinOffset(pin, comp.w, comp.h);
  return [comp.x + ox, comp.y + oy];
}

/* ── orthogonal Manhattan route ─────────────────────────────────────────── */
function route(x1: number, y1: number, x2: number, y2: number,
               side1: Side, side2: Side): string {
  // Determine natural exit directions
  const dx = x2 - x1, dy = y2 - y1;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const clearance = 28;

  // Extend from pin tip by clearance before routing
  let sx1 = x1, sy1 = y1, sx2 = x2, sy2 = y2;
  switch (side1) {
    case "L": sx1 = x1 - clearance; break;
    case "R": sx1 = x1 + clearance; break;
    case "T": sy1 = y1 - clearance; break;
    case "B": sy1 = y1 + clearance; break;
  }
  switch (side2) {
    case "L": sx2 = x2 - clearance; break;
    case "R": sx2 = x2 + clearance; break;
    case "T": sy2 = y2 - clearance; break;
    case "B": sy2 = y2 + clearance; break;
  }

  // L-shaped route through clearance points
  const rx = (sx1 + sx2) / 2;
  const ry = (sy1 + sy2) / 2;

  if (Math.abs(sx1 - sx2) > Math.abs(sy1 - sy2)) {
    // Horizontal dominant
    return `M${x1},${y1} L${sx1},${sy1} L${sx1},${sy2} L${sx2},${sy2} L${x2},${y2}`;
  } else {
    // Vertical dominant
    return `M${x1},${y1} L${sx1},${sy1} L${sx2},${sy1} L${sx2},${sy2} L${x2},${y2}`;
  }
}

/* ── build schematic from project description ────────────────────────────── */
function buildSchematic(desc: string): { comps: Comp[]; wires: NetWire[] } {
  const isESP32  = /esp32/i.test(desc);
  const hasDHT   = /dht|temperature|humidity|sensor/i.test(desc);
  const hasOLED  = /oled|display|screen/i.test(desc);
  const hasRelay = /relay/i.test(desc);
  const hasLED   = /led/i.test(desc);
  const hasBMP   = /bmp|pressure|altitude/i.test(desc);
  const hasBuzz  = /buzz|sound|alarm/i.test(desc);

  const mcuName  = isESP32 ? "ESP32 DevKit" : "Arduino Uno";
  const mcuColor = isESP32 ? "#4f8ef7" : "#00979d";

  // MCU — center of canvas
  const mcu: Comp = {
    id:"mcu", name:mcuName, sub:"Microcontroller",
    color:mcuColor, x:280, y:200, w:160, h:260,
    pins:[
      // Right side — data pins
      {id:"d2",   label:"D2",  side:"R", idx:0, total:6},
      {id:"d3",   label:"D3",  side:"R", idx:1, total:6},
      {id:"d4",   label:"D4",  side:"R", idx:2, total:6},
      {id:"sda",  label:"SDA", side:"R", idx:3, total:6},
      {id:"scl",  label:"SCL", side:"R", idx:4, total:6},
      {id:"tx",   label:"TX",  side:"R", idx:5, total:6},
      // Left side
      {id:"a0",   label:"A0",  side:"L", idx:0, total:3},
      {id:"d13",  label:"D13", side:"L", idx:1, total:3},
      {id:"rx",   label:"RX",  side:"L", idx:2, total:3},
      // Top
      {id:"vcc",  label:"VCC", side:"T", idx:0, total:2},
      {id:"v33",  label:"3V3", side:"T", idx:1, total:2},
      // Bottom
      {id:"gnd",  label:"GND", side:"B", idx:0, total:2},
      {id:"gnd2", label:"GND", side:"B", idx:1, total:2},
    ],
  };

  const comps: Comp[] = [mcu];
  const wires: NetWire[] = [];
  let wid = 0;
  const W = () => `w${wid++}`;

  // ── VCC rail (pseudo-comp, drawn as bar) ──────────────────────────────────
  const vccRail: Comp = {
    id:"vcc_rail", name:"VCC  5V", sub:"Power Rail",
    color:P.vcc, x:40, y:60, w:720, h:20,
    pins:[
      {id:"out1",label:"",side:"B",idx:0,total:6},
      {id:"out2",label:"",side:"B",idx:1,total:6},
      {id:"out3",label:"",side:"B",idx:2,total:6},
      {id:"out4",label:"",side:"B",idx:3,total:6},
      {id:"out5",label:"",side:"B",idx:4,total:6},
      {id:"out6",label:"",side:"B",idx:5,total:6},
    ],
  };
  const gndRail: Comp = {
    id:"gnd_rail", name:"GND", sub:"Ground Rail",
    color:P.gnd, x:40, y:780, w:720, h:20,
    pins:[
      {id:"in1",label:"",side:"T",idx:0,total:6},
      {id:"in2",label:"",side:"T",idx:1,total:6},
      {id:"in3",label:"",side:"T",idx:2,total:6},
      {id:"in4",label:"",side:"T",idx:3,total:6},
      {id:"in5",label:"",side:"T",idx:4,total:6},
      {id:"in6",label:"",side:"T",idx:5,total:6},
    ],
  };
  comps.push(vccRail, gndRail);

  // MCU power wires
  wires.push(
    {id:W(),a:{comp:"mcu",pin:"vcc"}, b:{comp:"vcc_rail",pin:"out1"}, color:P.vcc, label:"5V", dashed:true},
    {id:W(),a:{comp:"mcu",pin:"gnd"},b:{comp:"gnd_rail",pin:"in1"},   color:P.gnd, label:"GND", dashed:true},
  );

  // ── DHT22 / temperature sensor ─────────────────────────────────────────
  if (hasDHT) {
    const dht: Comp = {
      id:"dht22", name:"DHT22", sub:"Temp / Humidity",
      color:"#3ecf8e", x:580, y:200, w:130, h:110,
      pins:[
        {id:"vcc", label:"VCC",  side:"T",idx:0,total:1},
        {id:"data",label:"DATA", side:"L",idx:0,total:2},
        {id:"nc",  label:"NC",   side:"L",idx:1,total:2},
        {id:"gnd", label:"GND",  side:"B",idx:0,total:1},
      ],
    };
    comps.push(dht);

    // Pull-up resistor between VCC and DATA
    const r1: Comp = {
      id:"r1", name:"10kΩ", sub:"Pull-up",
      color:"#c586c0", x:490, y:220, w:60, h:34,
      pins:[
        {id:"a",label:"A",side:"L",idx:0,total:1},
        {id:"b",label:"B",side:"R",idx:0,total:1},
      ],
    };
    comps.push(r1);

    wires.push(
      {id:W(),a:{comp:"mcu",  pin:"d2"},  b:{comp:"r1",   pin:"a"},  color:P.data, label:"DATA"},
      {id:W(),a:{comp:"r1",   pin:"b"},   b:{comp:"dht22",pin:"data"},color:P.data, label:""},
      {id:W(),a:{comp:"dht22",pin:"vcc"}, b:{comp:"vcc_rail",pin:"out3"},color:P.vcc, label:"", dashed:true},
      {id:W(),a:{comp:"dht22",pin:"gnd"}, b:{comp:"gnd_rail",pin:"in3"},color:P.gnd, label:"", dashed:true},
    );
  }

  // ── OLED Display ───────────────────────────────────────────────────────
  if (hasOLED) {
    const oled: Comp = {
      id:"oled", name:"OLED 128×64", sub:"I²C Display",
      color:"#4fc1ff", x:580, y:380, w:130, h:110,
      pins:[
        {id:"vcc",label:"VCC",side:"T",idx:0,total:1},
        {id:"gnd",label:"GND",side:"B",idx:0,total:1},
        {id:"sda",label:"SDA",side:"L",idx:0,total:2},
        {id:"scl",label:"SCL",side:"L",idx:1,total:2},
      ],
    };
    comps.push(oled);
    wires.push(
      {id:W(),a:{comp:"mcu", pin:"sda"}, b:{comp:"oled",pin:"sda"}, color:P.sda, label:"SDA"},
      {id:W(),a:{comp:"mcu", pin:"scl"}, b:{comp:"oled",pin:"scl"}, color:P.scl, label:"SCL"},
      {id:W(),a:{comp:"oled",pin:"vcc"}, b:{comp:"vcc_rail",pin:"out4"},color:P.vcc,label:"",dashed:true},
      {id:W(),a:{comp:"oled",pin:"gnd"}, b:{comp:"gnd_rail",pin:"in4"},color:P.gnd,label:"",dashed:true},
    );
  }

  // ── BMP280 pressure sensor ─────────────────────────────────────────────
  if (hasBMP) {
    const bmp: Comp = {
      id:"bmp280", name:"BMP280", sub:"Pressure Sensor",
      color:"#f97316", x:580, y:560, w:130, h:110,
      pins:[
        {id:"vcc",label:"VCC",side:"T",idx:0,total:1},
        {id:"gnd",label:"GND",side:"B",idx:0,total:1},
        {id:"sda",label:"SDA",side:"L",idx:0,total:2},
        {id:"scl",label:"SCL",side:"L",idx:1,total:2},
      ],
    };
    comps.push(bmp);
    wires.push(
      {id:W(),a:{comp:"mcu",  pin:"sda"},b:{comp:"bmp280",pin:"sda"},color:P.sda,label:""},
      {id:W(),a:{comp:"mcu",  pin:"scl"},b:{comp:"bmp280",pin:"scl"},color:P.scl,label:""},
      {id:W(),a:{comp:"bmp280",pin:"vcc"},b:{comp:"vcc_rail",pin:"out5"},color:P.vcc,label:"",dashed:true},
      {id:W(),a:{comp:"bmp280",pin:"gnd"},b:{comp:"gnd_rail",pin:"in5"},color:P.gnd,label:"",dashed:true},
    );
  }

  // ── Relay module ────────────────────────────────────────────────────────
  if (hasRelay) {
    const relay: Comp = {
      id:"relay", name:"Relay", sub:"5V Module",
      color:"#ef4444", x:60, y:280, w:120, h:100,
      pins:[
        {id:"vcc",label:"VCC",side:"T",idx:0,total:1},
        {id:"gnd",label:"GND",side:"B",idx:0,total:1},
        {id:"in", label:"IN", side:"R",idx:0,total:1},
        {id:"com",label:"COM",side:"L",idx:0,total:2},
        {id:"no", label:"NO", side:"L",idx:1,total:2},
      ],
    };
    comps.push(relay);
    wires.push(
      {id:W(),a:{comp:"mcu",  pin:"d3"},b:{comp:"relay",pin:"in"},color:P.data,label:"CTRL"},
      {id:W(),a:{comp:"relay",pin:"vcc"},b:{comp:"vcc_rail",pin:"out2"},color:P.vcc,label:"",dashed:true},
      {id:W(),a:{comp:"relay",pin:"gnd"},b:{comp:"gnd_rail",pin:"in2"},color:P.gnd,label:"",dashed:true},
    );
  }

  // ── LED + resistor ──────────────────────────────────────────────────────
  if (hasLED) {
    const led: Comp = {
      id:"led", name:"LED", sub:"Status",
      color:"#facc15", x:60, y:440, w:80, h:70,
      pins:[
        {id:"a",label:"A+",side:"T",idx:0,total:1},
        {id:"k",label:"K−",side:"B",idx:0,total:1},
      ],
    };
    const r220: Comp = {
      id:"r220", name:"220Ω", sub:"Current Limit",
      color:"#facc15", x:60, y:370, w:80, h:32,
      pins:[
        {id:"a",label:"+",side:"T",idx:0,total:1},
        {id:"b",label:"−",side:"B",idx:0,total:1},
      ],
    };
    comps.push(r220, led);
    wires.push(
      {id:W(),a:{comp:"mcu",  pin:"d13"},b:{comp:"r220",pin:"a"},color:P.data,label:"PWM"},
      {id:W(),a:{comp:"r220", pin:"b"},  b:{comp:"led", pin:"a"},color:P.data,label:""},
      {id:W(),a:{comp:"led",  pin:"k"},  b:{comp:"gnd_rail",pin:"in6"},color:P.gnd,label:"",dashed:true},
    );
  }

  // ── Buzzer ──────────────────────────────────────────────────────────────
  if (hasBuzz) {
    const buzz: Comp = {
      id:"buzzer", name:"Buzzer", sub:"Passive 5V",
      color:"#fb923c", x:60, y:550, w:90, h:70,
      pins:[
        {id:"pos",label:"+",side:"T",idx:0,total:1},
        {id:"neg",label:"−",side:"B",idx:0,total:1},
      ],
    };
    comps.push(buzz);
    wires.push(
      {id:W(),a:{comp:"mcu",   pin:"d4"}, b:{comp:"buzzer",pin:"pos"},color:P.uart,label:"PWM"},
      {id:W(),a:{comp:"buzzer",pin:"neg"},b:{comp:"gnd_rail",pin:"in6"},color:P.gnd,label:"",dashed:true},
    );
  }

  // ── Decoupling cap on MCU VCC ──────────────────────────────────────────
  const cap: Comp = {
    id:"cap100n", name:"100nF", sub:"Decoupling",
    color:P.vcc, x:160, y:200, w:70, h:34,
    pins:[
      {id:"pos",label:"+",side:"T",idx:0,total:1},
      {id:"neg",label:"−",side:"B",idx:0,total:1},
    ],
  };
  comps.push(cap);
  wires.push(
    {id:W(),a:{comp:"cap100n",pin:"pos"},b:{comp:"vcc_rail",pin:"out1"},color:P.vcc,label:"",dashed:true},
    {id:W(),a:{comp:"cap100n",pin:"neg"},b:{comp:"gnd_rail",pin:"in2"},color:P.gnd,label:"",dashed:true},
  );

  return { comps, wires };
}

/* ── component SVG renderer ───────────────────────────────────────────────── */
function CompSVG({ comp, selected, onPointerDown }: {
  comp: Comp;
  selected: boolean;
  onPointerDown: (e: PointerEvent<SVGGElement>, id: string) => void;
}) {
  const isRail = comp.id.endsWith("_rail");

  const renderPin = (pin: CompPin) => {
    const [ox, oy] = pinOffset(pin, comp.w, comp.h);
    // stub: from body edge to pin tip
    let bodyX = comp.x + ox, bodyY = comp.y + oy;
    switch (pin.side) {
      case "L": bodyX = comp.x; break;
      case "R": bodyX = comp.x + comp.w; break;
      case "T": bodyY = comp.y; break;
      case "B": bodyY = comp.y + comp.h; break;
    }
    const tipX = comp.x + ox, tipY = comp.y + oy;

    // pin label offset
    let lx = tipX, ly = tipY, anchor: "start"|"middle"|"end" = "middle";
    switch (pin.side) {
      case "L": lx = tipX - 4; ly = tipY + 3.5; anchor = "end";   break;
      case "R": lx = tipX + 4; ly = tipY + 3.5; anchor = "start"; break;
      case "T": lx = tipX;     ly = tipY - 5;   anchor = "middle"; break;
      case "B": lx = tipX;     ly = tipY + 11;  anchor = "middle"; break;
    }

    return (
      <g key={pin.id}>
        <line x1={bodyX} y1={bodyY} x2={tipX} y2={tipY}
          stroke={P.pinDot} strokeWidth={1.2}/>
        <circle cx={tipX} cy={tipY} r={2.8} fill={P.pinDot}/>
        {pin.label && (
          <text x={lx} y={ly} fontSize={7.5} fill={P.pinLabel}
            textAnchor={anchor} fontFamily="JetBrains Mono,monospace">
            {pin.label}
          </text>
        )}
      </g>
    );
  };

  if (isRail) {
    return (
      <g style={{cursor:"grab"}}>
        <rect x={comp.x} y={comp.y} width={comp.w} height={comp.h}
          rx={3} fill={`${comp.color}22`} stroke={comp.color} strokeWidth={1.5}
          strokeDasharray="8,5"/>
        <text x={comp.x + 14} y={comp.y + 14}
          fontSize={9} fontWeight={700} fill={comp.color}
          fontFamily="JetBrains Mono,monospace" letterSpacing="0.06em">
          {comp.name}
        </text>
      </g>
    );
  }

  return (
    <g onPointerDown={e => onPointerDown(e, comp.id)}
      style={{ cursor:"grab", userSelect:"none" }}>
      {/* pins */}
      {comp.pins.map(renderPin)}
      {/* body */}
      <rect x={comp.x} y={comp.y} width={comp.w} height={comp.h}
        rx={5} fill={P.compFill}
        stroke={selected ? "#fff" : comp.color}
        strokeWidth={selected ? 1.8 : 1.5}/>
      {/* top bar */}
      <rect x={comp.x} y={comp.y} width={comp.w} height={22}
        rx={4} fill={`${comp.color}28`}/>
      {/* name */}
      <text x={comp.x + comp.w / 2} y={comp.y + 14}
        fontSize={8.5} fontWeight={700} fill={comp.color}
        textAnchor="middle" fontFamily="JetBrains Mono,monospace"
        letterSpacing="0.05em">
        {comp.name}
      </text>
      {/* sub */}
      <text x={comp.x + comp.w / 2} y={comp.y + comp.h / 2 + 8}
        fontSize={10} fill={P.textMid}
        textAnchor="middle" fontFamily="Inter,sans-serif" fontWeight={500}>
        {comp.sub}
      </text>
      {/* selection ring */}
      {selected && (
        <rect x={comp.x - 3} y={comp.y - 3}
          width={comp.w + 6} height={comp.h + 6}
          rx={7} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1}
          strokeDasharray="4,3"/>
      )}
    </g>
  );
}

/* ── wire SVG renderer ────────────────────────────────────────────────────── */
function WireSVG({ wire, comps }: { wire: NetWire; comps: Comp[] }) {
  const ca = comps.find(c => c.id === wire.a.comp);
  const cb = comps.find(c => c.id === wire.b.comp);
  if (!ca || !cb) return null;

  const pa = ca.pins.find(p => p.id === wire.a.pin);
  const pb = cb.pins.find(p => p.id === wire.b.pin);
  if (!pa || !pb) return null;

  const [x1, y1] = pinConnectXY(ca, wire.a.pin);
  const [x2, y2] = pinConnectXY(cb, wire.b.pin);
  const d = route(x1, y1, x2, y2, pa.side, pb.side);
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <path d={d} fill="none" stroke={wire.color} strokeWidth={1.6}
        strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={wire.dashed ? "5,4" : undefined}
        opacity={0.9}/>
      {wire.label && (
        <text x={midX} y={midY - 5} fontSize={8} fill={wire.color}
          textAnchor="middle" fontFamily="JetBrains Mono,monospace"
          opacity={0.85} fontWeight={600}>
          {wire.label}
        </text>
      )}
    </g>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export function CircuitDiagram({ projectDescription, pipelineDone }: {
  projectDescription: string;
  pipelineDone: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // ── view transform
  const [tx, setTx]     = useState(0);
  const [ty, setTy]     = useState(0);
  const [scale, setScale] = useState(0.9);

  // ── component positions
  const { comps: initComps, wires } = buildSchematic(projectDescription);
  const [comps, setComps] = useState<Comp[]>(initComps);

  // Re-build when description changes
  useEffect(() => {
    const { comps: nc } = buildSchematic(projectDescription);
    setComps(nc);
  }, [projectDescription]);

  // ── dragging state
  const draggingComp  = useRef<string | null>(null);
  const dragStart     = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null);
  const isPanning     = useRef(false);
  const panStart      = useRef<{ mx: number; my: number; tx: number; ty: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  // ── component drag ─────────────────────────────────────────────────────
  const onCompPointerDown = useCallback((e: PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    const comp = comps.find(c => c.id === id);
    if (!comp) return;
    draggingComp.current  = id;
    dragStart.current     = { mx: e.clientX, my: e.clientY, cx: comp.x, cy: comp.y };
    setSelected(id);
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);
  }, [comps]);

  const onSVGPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingComp.current && dragStart.current) {
      const dx = (e.clientX - dragStart.current.mx) / scale;
      const dy = (e.clientY - dragStart.current.my) / scale;
      setComps(prev => prev.map(c =>
        c.id === draggingComp.current
          ? { ...c, x: dragStart.current!.cx + dx, y: dragStart.current!.cy + dy }
          : c
      ));
    } else if (isPanning.current && panStart.current) {
      setTx(panStart.current.tx + e.clientX - panStart.current.mx);
      setTy(panStart.current.ty + e.clientY - panStart.current.my);
    }
  }, [scale]);

  const onSVGPointerUp = useCallback(() => {
    draggingComp.current = null;
    dragStart.current    = null;
    isPanning.current    = false;
    panStart.current     = null;
  }, []);

  // ── canvas pan ─────────────────────────────────────────────────────────
  const onSVGPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (draggingComp.current) return;
    isPanning.current = true;
    panStart.current  = { mx: e.clientX, my: e.clientY, tx, ty };
    setSelected(null);
  }, [tx, ty]);

  // ── mouse wheel zoom ───────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(s => Math.min(3, Math.max(0.2, s * factor)));
  }, []);

  // ── zoom buttons ───────────────────────────────────────────────────────
  const zoomIn    = () => setScale(s => Math.min(3, s * 1.2));
  const zoomOut   = () => setScale(s => Math.max(0.2, s / 1.2));
  const zoomReset = () => { setScale(0.9); setTx(0); setTy(0); };

  if (!pipelineDone) {
    return (
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
        flexDirection:"column", gap:12, background:P.bg }}>
        <div style={{ width:24, height:24, borderRadius:"50%",
          border:"2px solid rgba(255,255,255,0.1)", borderTopColor:"#007acc",
          animation:"spin 0.8s linear infinite" }}/>
        <p style={{ fontSize:12, color:P.textDim }}>Circuit diagram generating…</p>
      </div>
    );
  }

  return (
    <div ref={containerRef}
      style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:P.bg, position:"relative" }}>

      {/* ── Toolbar ────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"8px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)",
        flexShrink:0, background:"#0d0f14" }}>
        <div>
          <p style={{ fontSize:10, fontWeight:600, letterSpacing:"0.1em",
            textTransform:"uppercase", color:P.textDim, marginBottom:2 }}>
            Circuit Diagram
          </p>
          <p style={{ fontSize:11, color:P.textMid, maxWidth:500, lineHeight:1.4 }}>
            {projectDescription}
          </p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:4 }}>
          {/* Legend */}
          <div style={{ display:"flex", gap:10, marginRight:16 }}>
            {[{c:P.data,l:"Data"},{c:P.sda,l:"SDA"},{c:P.scl,l:"SCL"},{c:P.vcc,l:"VCC"},{c:P.gnd,l:"GND"}].map(it=>(
              <div key={it.l} style={{ display:"flex", alignItems:"center", gap:4 }}>
                <div style={{ width:14, height:2, background:it.c, borderRadius:1 }}/>
                <span style={{ fontSize:9, color:it.c, fontFamily:"var(--font-mono)" }}>{it.l}</span>
              </div>
            ))}
          </div>
          {/* Zoom controls */}
          {[
            { label:"−", fn:zoomOut },
            { label:`${Math.round(scale * 100)}%`, fn:zoomReset },
            { label:"+", fn:zoomIn  },
          ].map(b => (
            <button key={b.label} onClick={b.fn}
              style={{ padding:"3px 10px", fontSize:11, background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.1)", borderRadius:4,
                color:P.textMid, cursor:"pointer", fontFamily:"var(--font-mono)", minWidth:38 }}>
              {b.label}
            </button>
          ))}
          <span style={{ fontSize:10, color:P.textDim, marginLeft:8 }}>
            Drag components · Scroll to zoom · Drag canvas to pan
          </span>
        </div>
      </div>

      {/* ── SVG canvas ─────────────────────────────────────────────────── */}
      <div style={{ flex:1, overflow:"hidden", cursor: isPanning.current ? "grabbing" : "default" }}>
        <svg width="100%" height="100%"
          onPointerMove={onSVGPointerMove}
          onPointerUp={onSVGPointerUp}
          onPointerDown={onSVGPointerDown}
          onWheel={onWheel}
          style={{ display:"block", background:P.bg }}>

          <defs>
            <pattern id="cgrid" width={20*scale} height={20*scale} patternUnits="userSpaceOnUse"
              x={tx % (20*scale)} y={ty % (20*scale)}>
              <circle cx="1" cy="1" r="0.7" fill={P.grid}/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cgrid)"/>

          {/* Everything inside the transform group */}
          <g transform={`translate(${tx},${ty}) scale(${scale})`}>
            {/* Wires drawn first (behind components) */}
            {wires.map(w => (
              <WireSVG key={w.id} wire={w} comps={comps}/>
            ))}
            {/* Components on top */}
            {comps.map(c => (
              <CompSVG key={c.id} comp={c}
                selected={selected === c.id}
                onPointerDown={onCompPointerDown}/>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

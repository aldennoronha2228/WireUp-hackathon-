/**
 * WireUp Circuit Diagram — React Flow
 * Fixed: consistent handle IDs between nodes and edges
 */

import { useMemo } from "react";
import ReactFlow, {
  Background, Controls, MiniMap,
  Handle, Position,
  type NodeTypes, type Node, type Edge,
  BackgroundVariant,
  useNodesState, useEdgesState,
  ReactFlowProvider,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

const C = {
  bg:      "#0a0a0f",
  card:    "#161824",
  cardBdr: "#2e3048",
  text:    "#e2e8f0",
  textDim: "#8888a8",
  vcc:     "#ef4444",
  v33:     "#f97316",
  gnd:     "#6b7280",
  data:    "#3b82f6",
  i2c:     "#8b5cf6",
  uart:    "#f59e0b",
  pwm:     "#ec4899",
};

function sigColor(s: string) {
  const l = s.toLowerCase();
  if (l.includes("5v") || l.includes("vcc")) return C.vcc;
  if (l.includes("3v3") || l.includes("3.3")) return C.v33;
  if (l.includes("gnd")) return C.gnd;
  if (l.includes("sda") || l.includes("scl") || l.includes("i2c")) return C.i2c;
  if (l.includes("tx") || l.includes("rx")) return C.uart;
  if (l.includes("pwm")) return C.pwm;
  return C.data;
}

/* ── MCU Node ─────────────────────────────────────────────────────────── */
function MCUNode({ data }: { data: any }) {
  const rows: Array<[string|undefined, string|undefined]> = data.rows || [];

  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.cardBdr}`,
      borderRadius: 10, minWidth: 220, fontFamily: "var(--font-sans)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)", overflow: "visible" }}>

      {/* Header */}
      <div style={{ padding: "8px 14px 6px", borderBottom: `1px solid ${C.cardBdr}`,
        background: "rgba(255,255,255,0.03)", borderRadius: "8px 8px 0 0" }}>
        <p style={{ fontSize: 9, color: C.textDim, letterSpacing: "0.1em",
          textTransform: "uppercase", marginBottom: 3 }}>BOARD</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 22, height: 22, borderRadius: 4,
            background: "linear-gradient(135deg,#00979d,#007acc)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{data.label}</span>
        </div>
      </div>

      {/* USB power badge */}
      <div style={{ padding: "5px 14px", background: "rgba(34,197,94,0.08)",
        borderBottom: `1px solid rgba(34,197,94,0.18)`,
        display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }}/>
        <span style={{ fontSize: 10, color: "#22c55e" }}>Powered via USB</span>
      </div>

      {/* Power pins */}
      {[
        { id: "5v",  label: "5V",  color: C.vcc },
        { id: "3v3", label: "3V3", color: C.v33 },
        { id: "gnd", label: "GND", color: C.gnd },
      ].map(p => (
        <div key={p.id} style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "4px 14px",
          position: "relative", minHeight: 22 }}>
          {/* Left handle */}
          <Handle type="target" position={Position.Left} id={`${p.id}-l`}
            style={{ left: -5, width: 9, height: 9, background: p.color,
              border: `2px solid ${C.bg}`, borderRadius: "50%" }}/>
          <span style={{ fontSize: 11, fontWeight: 600, color: p.color }}>{p.label}</span>
          {/* Right handle */}
          <Handle type="target" position={Position.Right} id={`${p.id}-r`}
            style={{ right: -5, width: 9, height: 9, background: p.color,
              border: `2px solid ${C.bg}`, borderRadius: "50%" }}/>
        </div>
      ))}

      {/* GPIO section */}
      <div style={{ borderTop: `1px solid ${C.cardBdr}`, paddingTop: 4, paddingBottom: 8 }}>
        <p style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase",
          letterSpacing: "0.08em", textAlign: "center", marginBottom: 4, marginTop: 2 }}>
          GPIO Pins
        </p>
        {rows.map(([lp, rp], i) => (
          <div key={i} style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "2px 14px",
            position: "relative", minHeight: 20 }}>
            {lp ? (
              <>
                <Handle type="target" position={Position.Left} id={`pin-${lp}`}
                  style={{ left: -5, width: 8, height: 8, background: "#4fc1ff",
                    border: `2px solid ${C.bg}`, borderRadius: "50%" }}/>
                <span style={{ fontSize: 10, color: C.textDim }}>{lp}</span>
              </>
            ) : <span/>}
            {rp ? (
              <>
                <span style={{ fontSize: 10, color: C.textDim }}>{rp}</span>
                <Handle type="target" position={Position.Right} id={`pin-${rp}`}
                  style={{ right: -5, width: 8, height: 8, background: "#4fc1ff",
                    border: `2px solid ${C.bg}`, borderRadius: "50%" }}/>
              </>
            ) : <span/>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Component/Sensor Node ────────────────────────────────────────────── */
function CompNode({ data }: { data: any }) {
  const pins: Array<{ id: string; label: string; signal: string }> = data.pins || [];

  return (
    <div style={{ background: data.color ? `${data.color}10` : C.card,
      border: `1.5px solid ${data.color || C.cardBdr}`,
      borderRadius: 8, minWidth: 170, overflow: "visible",
      fontFamily: "var(--font-sans)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
      <div style={{ padding: "10px 14px 8px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>{data.label}</p>
        <p style={{ fontSize: 10, color: C.textDim, lineHeight: 1.4 }}>{data.description}</p>
      </div>
      <div style={{ borderTop: `1px solid ${data.color ? data.color + "30" : C.cardBdr}`,
        paddingTop: 5, paddingBottom: 8 }}>
        {pins.map(pin => {
          const col = sigColor(pin.signal);
          return (
            <div key={pin.id} style={{ display: "flex", alignItems: "center",
              justifyContent: "flex-end", padding: "3px 14px",
              position: "relative", minHeight: 20 }}>
              <span style={{ fontSize: 11, color: C.textDim, marginRight: 8 }}>{pin.label}</span>
              {/* Source handle on right — wire goes from here to MCU */}
              <Handle type="source" position={Position.Right} id={pin.id}
                style={{ right: -5, width: 9, height: 9, background: col,
                  border: `2px solid ${C.bg}`, borderRadius: "50%" }}/>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = { mcu: MCUNode, comp: CompNode };

/* ── Build nodes + edges ──────────────────────────────────────────────── */
function build(desc: string): { nodes: Node[]; edges: Edge[] } {
  const l = desc.toLowerCase();
  const isESP = l.includes("esp32");
  const mcuLabel = isESP ? "ESP32 DevKit" : "Arduino Uno";

  const leftPins  = isESP
    ? ["D0","D2","D4","D5","D12","D13","D14","A0","A2","A4"]
    : ["D0","D2","D4","D6","D8","D10","D12","A0","A2","A4"];
  const rightPins = isESP
    ? ["D1","D3","TX","RX","SDA","SCL","D15","A1","A3","A5"]
    : ["D1","D3","D5","D7","D9","D11","D13","A1","A3","A5"];

  const rows: Array<[string|undefined, string|undefined]> = Array.from(
    { length: Math.max(leftPins.length, rightPins.length) },
    (_, i) => [leftPins[i], rightPins[i]]
  );

  const mcu: Node = {
    id: "mcu", type: "mcu",
    position: { x: 400, y: 60 },
    data: { label: mcuLabel, rows },
  };

  const nodes: Node[] = [mcu];
  const edges: Edge[] = [];
  let yOff = 80;

  const edge = (
    id: string, src: string, srcH: string,
    tgt: string, tgtH: string,
    color: string, label = ""
  ): Edge => ({
    id, source: src, sourceHandle: srcH,
    target: tgt, targetHandle: tgtH,
    type: "smoothstep",
    animated: false,
    label,
    labelStyle: { fill: color, fontSize: 10, fontFamily: "var(--font-mono)" },
    labelBgStyle: { fill: "#0a0a0f", fillOpacity: 0.9 },
    labelBgPadding: [4, 3] as [number, number],
    labelBgBorderRadius: 3,
    style: { stroke: color, strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
  });

  // ── DHT22 ──────────────────────────────────────────────────────────────
  if (l.match(/temp|humidity|dht|weather|climate/)) {
    nodes.push({
      id: "dht", type: "comp", position: { x: 60, y: yOff },
      data: { label: "DHT22", description: "Temperature & humidity sensor",
        color: "#3ecf8e",
        pins: [
          { id: "d-vcc",  label: "VCC",  signal: "vcc" },
          { id: "d-gnd",  label: "GND",  signal: "gnd" },
          { id: "d-data", label: "DATA", signal: "data" },
        ] },
    });
    edges.push(
      edge("dht-vcc",  "dht","d-vcc",  "mcu","5v-l",     C.vcc,  "5V"),
      edge("dht-gnd",  "dht","d-gnd",  "mcu","gnd-l",    C.gnd,  "GND"),
      edge("dht-data", "dht","d-data", "mcu","pin-D4",   C.data, "D4"),
    );
    yOff += 180;
  }

  // ── OLED ───────────────────────────────────────────────────────────────
  if (l.match(/oled|display|screen/)) {
    nodes.push({
      id: "oled", type: "comp", position: { x: 60, y: yOff },
      data: { label: "OLED 128×64", description: "I²C monochrome display",
        color: "#4fc1ff",
        pins: [
          { id: "o-vcc", label: "VCC", signal: "vcc" },
          { id: "o-gnd", label: "GND", signal: "gnd" },
          { id: "o-sda", label: "SDA", signal: "sda" },
          { id: "o-scl", label: "SCL", signal: "scl" },
        ] },
    });
    edges.push(
      edge("oled-vcc", "oled","o-vcc","mcu","5v-l",    C.vcc,  "5V"),
      edge("oled-gnd", "oled","o-gnd","mcu","gnd-l",   C.gnd,  "GND"),
      edge("oled-sda", "oled","o-sda","mcu","pin-SDA", C.i2c,  "SDA"),
      edge("oled-scl", "oled","o-scl","mcu","pin-SCL", C.i2c,  "SCL"),
    );
    yOff += 200;
  }

  // ── Servo ─────────────────────────────────────────────────────────────
  if (l.match(/servo|arm|robot/)) {
    nodes.push({
      id: "servo", type: "comp", position: { x: 60, y: yOff },
      data: { label: "Servo Motor", description: isESP ? "SG90 via ESP32 PWM" : "SG90 via Arduino PWM",
        color: "#f59e0b",
        pins: [
          { id: "sv-vcc", label: "VCC (Red)",      signal: "vcc" },
          { id: "sv-gnd", label: "GND (Brown)",    signal: "gnd" },
          { id: "sv-sig", label: "Signal (Yellow)",signal: "pwm" },
        ] },
    });
    edges.push(
      edge("srv-vcc", "servo","sv-vcc","mcu","5v-r",   C.vcc, "5V"),
      edge("srv-gnd", "servo","sv-gnd","mcu","gnd-r",  C.gnd, "GND"),
      edge("srv-sig", "servo","sv-sig","mcu","pin-D9", C.pwm, "D9 PWM"),
    );
    yOff += 180;
  }

  // ── Relay ─────────────────────────────────────────────────────────────
  if (l.match(/relay/)) {
    nodes.push({
      id: "relay", type: "comp", position: { x: 60, y: yOff },
      data: { label: "Relay Module", description: "5V single channel relay",
        color: "#ef4444",
        pins: [
          { id: "rl-vcc", label: "VCC", signal: "vcc" },
          { id: "rl-gnd", label: "GND", signal: "gnd" },
          { id: "rl-in",  label: "IN",  signal: "data" },
        ] },
    });
    edges.push(
      edge("rel-vcc", "relay","rl-vcc","mcu","5v-r",   C.vcc,  "5V"),
      edge("rel-gnd", "relay","rl-gnd","mcu","gnd-r",  C.gnd,  "GND"),
      edge("rel-in",  "relay","rl-in", "mcu","pin-D5", C.data, "D5"),
    );
    yOff += 170;
  }

  // ── HC-SR04 ────────────────────────────────────────────────────────────
  if (l.match(/ultrasonic|hcsr|distance|proximity/)) {
    nodes.push({
      id: "hc", type: "comp", position: { x: 60, y: yOff },
      data: { label: "HC-SR04", description: "Ultrasonic distance sensor",
        color: "#8b5cf6",
        pins: [
          { id: "hc-vcc",  label: "VCC",  signal: "vcc"  },
          { id: "hc-gnd",  label: "GND",  signal: "gnd"  },
          { id: "hc-trig", label: "TRIG", signal: "data" },
          { id: "hc-echo", label: "ECHO", signal: "data" },
        ] },
    });
    edges.push(
      edge("hc-vcc",  "hc","hc-vcc", "mcu","5v-r",    C.vcc,  "5V"),
      edge("hc-gnd",  "hc","hc-gnd", "mcu","gnd-r",   C.gnd,  "GND"),
      edge("hc-trig", "hc","hc-trig","mcu","pin-D6",  C.data, "D6 TRIG"),
      edge("hc-echo", "hc","hc-echo","mcu","pin-D7",  C.data, "D7 ECHO"),
    );
    yOff += 190;
  }

  // ── BMP280 ─────────────────────────────────────────────────────────────
  if (l.match(/bmp|pressure|altitude/)) {
    nodes.push({
      id: "bmp", type: "comp", position: { x: 60, y: yOff },
      data: { label: "BMP280", description: "Pressure & altitude sensor",
        color: "#f97316",
        pins: [
          { id: "bp-vcc", label: "VCC", signal: "vcc" },
          { id: "bp-gnd", label: "GND", signal: "gnd" },
          { id: "bp-sda", label: "SDA", signal: "sda" },
          { id: "bp-scl", label: "SCL", signal: "scl" },
        ] },
    });
    edges.push(
      edge("bmp-vcc", "bmp","bp-vcc","mcu","5v-l",    C.vcc, "5V"),
      edge("bmp-gnd", "bmp","bp-gnd","mcu","gnd-l",   C.gnd, "GND"),
      edge("bmp-sda", "bmp","bp-sda","mcu","pin-SDA", C.i2c, "SDA"),
      edge("bmp-scl", "bmp","bp-scl","mcu","pin-SCL", C.i2c, "SCL"),
    );
  }

  // Fallback — if no component matched, show a generic sensor
  if (nodes.length === 1) {
    nodes.push({
      id: "sens", type: "comp", position: { x: 60, y: 120 },
      data: { label: "Sensor", description: "Project component",
        color: "#3b82f6",
        pins: [
          { id: "s-vcc",  label: "VCC",  signal: "vcc"  },
          { id: "s-gnd",  label: "GND",  signal: "gnd"  },
          { id: "s-data", label: "DATA", signal: "data" },
        ] },
    });
    edges.push(
      edge("s-vcc",  "sens","s-vcc", "mcu","5v-l",   C.vcc,  "5V"),
      edge("s-gnd",  "sens","s-gnd", "mcu","gnd-l",  C.gnd,  "GND"),
      edge("s-data", "sens","s-data","mcu","pin-D2", C.data, "D2"),
    );
  }

  return { nodes, edges };
}

/* ── Build from diagram.json ────────────────────────────────────────── */
function buildFromJSON(jsonStr: string, projectDesc: string): { nodes: Node[]; edges: Edge[] } {
  try {
    const data = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
    if (!data || !data.components || !Array.isArray(data.components)) {
      throw new Error("Invalid diagram JSON: missing components array");
    }

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Find MCU component
    const mcuComp = data.components.find((c: any) =>
      c.id === "mcu" ||
      (c.type && String(c.type).toLowerCase() === "mcu") ||
      (c.name && String(c.name).toLowerCase().includes("arduino")) ||
      (c.name && String(c.name).toLowerCase().includes("esp32"))
    );
    const mcuId = mcuComp ? mcuComp.id : "mcu";
    const mcuName = mcuComp ? mcuComp.name : "Arduino Uno";

    const isESP = mcuName.toLowerCase().includes("esp32") || projectDesc.toLowerCase().includes("esp32");

    const leftPins  = isESP
      ? ["D0","D2","D4","D5","D12","D13","D14","A0","A2","A4"]
      : ["D0","D2","D4","D6","D8","D10","D12","A0","A2","A4"];
    const rightPins = isESP
      ? ["D1","D3","TX","RX","SDA","SCL","D15","A1","A3","A5"]
      : ["D1","D3","D5","D7","D9","D11","D13","A1","A3","A5"];

    const rows: Array<[string|undefined, string|undefined]> = Array.from(
      { length: Math.max(leftPins.length, rightPins.length) },
      (_, i) => [leftPins[i], rightPins[i]]
    );

    // Add MCU Node
    nodes.push({
      id: mcuId,
      type: "mcu",
      position: { x: 400, y: 60 },
      data: { label: mcuName, rows },
    });

    // Add peripheral components
    const otherComps = data.components.filter((c: any) => c.id !== mcuId);
    let yOff = 80;

    otherComps.forEach((c: any, index: number) => {
      const compId = c.id || `comp-${index}`;
      const name = c.name || c.id || `Component ${index}`;
      const type = c.type || "Sensor";

      let color = "#3b82f6"; // default blue
      const nameLower = name.toLowerCase();
      if (nameLower.includes("dht") || nameLower.includes("temp") || nameLower.includes("humidity") || nameLower.includes("weather")) {
        color = "#3ecf8e";
      } else if (nameLower.includes("oled") || nameLower.includes("display") || nameLower.includes("screen")) {
        color = "#4fc1ff";
      } else if (nameLower.includes("servo") || nameLower.includes("motor") || nameLower.includes("arm")) {
        color = "#f59e0b";
      } else if (nameLower.includes("relay")) {
        color = "#ef4444";
      } else if (nameLower.includes("ultrasonic") || nameLower.includes("hcsr") || nameLower.includes("distance") || nameLower.includes("proximity")) {
        color = "#8b5cf6";
      } else if (nameLower.includes("bmp") || nameLower.includes("pressure") || nameLower.includes("baro")) {
        color = "#f97316";
      }

      // Find pins for this component from connections or powerRails
      const pinNameSet = new Set<string>();
      if (data.connections && Array.isArray(data.connections)) {
        data.connections.forEach((conn: any) => {
          if (conn.from && typeof conn.from === "string") {
            const [pComp, pPin] = conn.from.split(".");
            if (pComp === compId && pPin) pinNameSet.add(pPin);
          }
          if (conn.to && typeof conn.to === "string") {
            const [pComp, pPin] = conn.to.split(".");
            if (pComp === compId && pPin) pinNameSet.add(pPin);
          }
        });
      }

      if (data.powerRails && Array.isArray(data.powerRails)) {
        data.powerRails.forEach((rail: any) => {
          if (rail.components && Array.isArray(rail.components)) {
            rail.components.forEach((compPin: string) => {
              const [pComp, pPin] = compPin.split(".");
              if (pComp === compId && pPin) pinNameSet.add(pPin);
            });
          }
        });
      }

      const pinList = pinNameSet.size > 0
        ? Array.from(pinNameSet).map(pinName => ({
            id: `${compId}-${pinName}`,
            label: pinName,
            signal: pinName
          }))
        : [
            { id: `${compId}-VCC`, label: "VCC", signal: "vcc" },
            { id: `${compId}-GND`, label: "GND", signal: "gnd" },
            { id: `${compId}-DATA`, label: "DATA", signal: "data" }
          ];

      nodes.push({
        id: compId,
        type: "comp",
        position: { x: 60, y: yOff },
        data: {
          label: name,
          description: type,
          color,
          pins: pinList
        }
      });

      yOff += 190;
    });

    const edge = (
      id: string, src: string, srcH: string,
      tgt: string, tgtH: string,
      color: string, label = ""
    ): Edge => ({
      id, source: src, sourceHandle: srcH,
      target: tgt, targetHandle: tgtH,
      type: "smoothstep",
      animated: false,
      label,
      labelStyle: { fill: color, fontSize: 10, fontFamily: "var(--font-mono)" },
      labelBgStyle: { fill: "#0a0a0f", fillOpacity: 0.9 },
      labelBgPadding: [4, 3] as [number, number],
      labelBgBorderRadius: 3,
      style: { stroke: color, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 12, height: 12 },
    });

    const getMcuHandle = (pinName: string) => {
      const pL = pinName.toLowerCase();
      if (pL === "5v" || pL === "vcc") return "5v-l";
      if (pL === "3v3" || pL === "3.3v") return "3v3-l";
      if (pL === "gnd") return "gnd-l";
      return `pin-${pinName}`;
    };

    if (data.connections && Array.isArray(data.connections)) {
      data.connections.forEach((conn: any, i: number) => {
        if (!conn.from || !conn.to) return;
        const [fromComp, fromPin] = conn.from.split(".");
        const [toComp, toPin] = conn.to.split(".");

        if (!fromComp || !toComp) return;

        let srcHandle = fromComp === mcuId ? getMcuHandle(fromPin) : `${fromComp}-${fromPin}`;
        let tgtHandle = toComp === mcuId ? getMcuHandle(toPin) : `${toComp}-${toPin}`;

        const signal = conn.signal || fromPin || toPin || "data";
        const color = sigColor(signal);

        edges.push(
          edge(
            `edge-${fromComp}-${fromPin}-${toComp}-${toPin}-${i}`,
            fromComp,
            srcHandle,
            toComp,
            tgtHandle,
            color,
            signal
          )
        );
      });
    }

    // Process power rails
    if (data.powerRails && Array.isArray(data.powerRails)) {
      data.powerRails.forEach((rail: any, ri: number) => {
        const railLabel = rail.label || "PWR";
        const color = sigColor(railLabel);
        const railComps = rail.components || [];

        const mcuPinStr = railComps.find((rc: string) => rc.startsWith(`${mcuId}.`));
        const otherCompPins = railComps.filter((rc: string) => !rc.startsWith(`${mcuId}.`));

        if (mcuPinStr && otherCompPins.length > 0) {
          const mcuPinName = mcuPinStr.split(".")[1] || "";
          const mcuHandle = getMcuHandle(mcuPinName);

          otherCompPins.forEach((rc: string, ci: number) => {
            const [compId, compPinName] = rc.split(".");
            if (!compId || !compPinName) return;

            const edgeId = `rail-${railLabel}-${compId}-${compPinName}-${ri}-${ci}`;
            if (edges.some(e => e.id === edgeId || (e.source === compId && e.sourceHandle === `${compId}-${compPinName}` && e.target === mcuId && e.targetHandle === mcuHandle))) {
              return;
            }

            edges.push(
              edge(
                edgeId,
                compId,
                `${compId}-${compPinName}`,
                mcuId,
                mcuHandle,
                color,
                railLabel
              )
            );
          });
        }
      });
    }

    return { nodes, edges };
  } catch (err) {
    console.error("Failed to build from diagram.json, falling back to build():", err);
    return build(projectDesc);
  }
}

/* ── Inner (needs ReactFlowProvider context) ─────────────────────────── */
function Inner({ desc, diagramContent }: { desc: string; diagramContent?: string }) {
  const { nodes: n0, edges: e0 } = useMemo(() => {
    if (diagramContent && diagramContent.trim().length > 0) {
      return buildFromJSON(diagramContent, desc);
    }
    return build(desc);
  }, [desc, diagramContent]);

  const [nodes,,onNC] = useNodesState(n0);
  const [edges,,onEC] = useEdgesState(e0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Toolbar */}
      <div style={{ height: 44, flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 16px", gap: 12, background: "#0d0d14",
        borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0",
          fontFamily: "var(--font-sans)" }}>Wiring diagram</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px",
          background: "#1a1c26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}>
          <div style={{ width: 16, height: 16, borderRadius: 3,
            background: "linear-gradient(135deg,#00979d,#007acc)" }}/>
          <span style={{ fontSize: 12, color: "#e2e8f0", fontFamily: "var(--font-sans)" }}>
            {desc.toLowerCase().includes("esp32") ? "ESP32 DevKit" : "Arduino Uno"}
          </span>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNC} onEdgesChange={onEC}
          nodeTypes={nodeTypes}
          fitView fitViewOptions={{ padding: 0.25 }}
          defaultEdgeOptions={{ type: "smoothstep" }}
          style={{ background: C.bg }}>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1}
            color="rgba(255,255,255,0.05)" />
          <Controls style={{ background: "#1a1c26",
            border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }} />
          <MiniMap style={{ background: "#0d0d14",
            border: "1px solid rgba(255,255,255,0.08)" }}
            nodeColor={() => "#3b82f6"} maskColor="rgba(0,0,0,0.45)" />
        </ReactFlow>
      </div>
    </div>
  );
}

/* ── Export ──────────────────────────────────────────────────────────── */
export function CircuitDiagram({ projectDescription, diagramContent, pipelineDone }: {
  projectDescription: string;
  diagramContent?: string;
  pipelineDone: boolean;
}) {
  if (!pipelineDone) {
    return (
      <div style={{ flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:12, background:C.bg }}>
        <div style={{ width:24, height:24, borderRadius:"50%",
          border:"2px solid rgba(255,255,255,0.1)", borderTopColor:"#007acc",
          animation:"spin 0.8s linear infinite" }}/>
        <p style={{ fontSize:12, color:"#6e7280", fontFamily:"var(--font-sans)" }}>
          Circuit diagram generating…
        </p>
      </div>
    );
  }
  return (
    <ReactFlowProvider>
      <Inner desc={projectDescription} diagramContent={diagramContent}/>
    </ReactFlowProvider>
  );
}

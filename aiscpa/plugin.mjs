/**
 # Copyright (c) 2026 Peter Sturm
 #
 #  Permission is hereby granted, free of charge, to any person obtaining a
 #  copy of this software and associated documentation files (the "Software"),
 #  to deal in the Software without restriction, including without limitation
 #  the rights to use, copy, modify, merge, publish, distribute, sublicense,
 #  and/or sell copies of the Software, and to permit persons to whom the
 #  Software is furnished to do so, subject to the following conditions:
 #
 #  The above copyright notice and this permission notice shall be included
 #  in all copies or substantial portions of the Software.
 #
 #  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 #  OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 #  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 #  THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHERtime
 #  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 #  FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 #  DEALINGS IN THE SOFTWARE.
 #
 */

export default async (fApi) => {
  const VISIBLE = fApi.getStoreBaseKey() + ".visible";
  fApi.setStoreData(VISIBLE, fApi.getLocalStorage(VISIBLE, false));

  const dev = new URLSearchParams(window.location.search).get("dev") == 1;
  function log(...a) {
    console.log(
      "%cCPA",
      "background: gold; color: black; padding: 2px 4px; border-radius: 3px;",
      new Date().toLocaleTimeString("en-US", { hour12: false }),
      ...a,
    );
  }
  function debug(...a) {
    if (!dev) return;
    log(...a);
  }
  log("start", fApi, fApi.getAvNavVersion());

  const LatLon = fApi.LatLon();

  function undef(...values) {
    return values.some((value) => value == null);
  }

  // AVNAV: draws AIS CPA line on map display widget
  const AisCpaParameter = {
    Opacity: {
      type: "FLOAT",
      default: 1.0,
      description: "Opacity of the CPA line and circles",
    },
    CircleRadius: {
      type: "NUMBER",
      default: 7,
      description: "Radius of the circles at own and target CPA positions",
    },
    FillColor: {
      type: "COLOR",
      default: "yellow",
      description: "Fill color of the circles at own and target CPA positions",
    },
    LineColor: {
      type: "COLOR",
      default: "red",
      description:
        "Color of the dashed line between own and target CPA positions",
    },
    StrokeWidthCircle: {
      type: "NUMBER",
      default: 1,
      description:
        "Width of the stroke for the circles at own and target CPA positions",
    },
    StrokeColorCircle: {
      type: "COLOR",
      default: "black",
      description:
        "Color of the stroke for the circles at own and target CPA positions",
    },
    DrawRealSize: {
      type: "BOOLEAN",
      default: true,
      description: "draw targets in real world size",
    },
    MinZoom: {
      type: "FLOAT",
      default: 11.0,
      description: "Minimum zoom level to draw CPA and real size targets",
    },
    Relative: {
      type: "BOOLEAN",
      default: false,
      description: "draw CPA line relative to own ship, perpendicular to RMV",
    },
    HistoryTime: {
      type: "NUMBER",
      default: 10,
      description:
        "Time in minutes to store target history for drawing, 0 disables history drawing",
    },
    HistoryColor: {
      type: "COLOR",
      default: "#606060",
      description: "Color of the target history",
    },
    HistoryLineWidth: {
      type: "NUMBER",
      default: 2,
      description: "Width of the target history line",
    },
  };

  let lastUpdateCount = 0;
  const targetHistory = new TargetHistory(debug);

  const AisCpaWidget = {
    name: "AisCpaWidget",
    type: "map",
    storeKeys: {
      // see https://github.com/wellenvogel/avnav/blob/master/viewer/util/keys.ts
      aisList: "nav.ais.list",
      aisUpdateCount: "nav.ais.updateCount",
      position: "nav.gps.position",
      course: "nav.gps.course",
      speed: "nav.gps.speed",
      currentZoom: "map.currentZoom",
      navCircleColor: "properties.navCircleColor",
      aisLayerVisible: "properties.layers.ais",
      showCPA: VISIBLE,
    },
    initFunction: function (map, data) {
      debug("init");
    },
    finalizeFunction: function () {
      debug("finalize");
    },
    renderCanvas: function (canvas, props, context) {
      if (!props.aisLayerVisible) return;
      // debug(props.aisUpdateCount, props);

      if (props.aisUpdateCount - lastUpdateCount > 1) {
        debug("missed updates", props.aisUpdateCount - lastUpdateCount - 1);
      }
      lastUpdateCount = props.aisUpdateCount;

      const ctx = context.getContext();
      ctx.save();

      targetHistory.cleanup(props.HistoryTime);
      // debug("hist", targetHistory.targets(), targetHistory.points());

      for (const target of props.aisList) {
        try {
          // debug(target);
          if (props.HistoryTime) {
            drawTargetHistory(context, props, target);
          }
          if (props.DrawRealSize) {
            drawRealSize(context, target);
          }
          if (!props.showCPA || !target.warning) continue;
          drawCPA(context, props, target);
        } catch (e) {
          log("error MMSI", target.mmsi, e);
          // } finally {
        }
      }

      ctx.restore();
    },
  };

  function drawTargetHistory(context, props, target) {
    const pos = (target.fromEstimated && target.estimated) || target.received;
    const history = targetHistory.add(target);
    const [w, h] = context.getDimensions();
    const positions = [...history, pos];
    const pxy = positions.map((p) => context.lonLatToPixel(p.lon, p.lat));
    const visible = pxy.some(([x, y]) => x >= 0 && x <= w && y >= 0 && y <= h);
    // const visible = pxy
    // .slice(1)
    // .some((point, i) => intersects(pxy[i], point, w, h));
    if (!visible) return;
    const scale = context.getScale();
    const ctx = context.getContext();
    ctx.beginPath();
    ctx.strokeStyle = props.HistoryColor;
    ctx.lineWidth = scale * props.HistoryLineWidth;
    pxy.forEach((p, i) => {
      if (i == 0) ctx.moveTo(...p);
      else ctx.lineTo(...p);
    });
    ctx.stroke();
  }

  function drawRealSize(context, target) {
    const pos = (target.fromEstimated && target.estimated) || target.received;
    const rotation = (target.fromEstimated && target.rotation) || 0;
    const { heading, course, length, beam, to_bow, to_port } = target.received;
    const hdg = (target.received.heading ?? target.received.course) + rotation;
    if (undef(pos?.lon, pos?.lat, hdg, length, beam, to_bow, to_port)) return;

    const scale = context.getScale();
    const [width, height] = context.getDimensions();
    const p = new LatLon(pos.lat, pos.lon);
    const [x, y] = context.lonLatToPixel(p.lon, p.lat);

    if (x < 0 || x > width || y < 0 || y > height) return;
    // debug(pos, hdg, length, beam, to_bow, to_port);

    const tostern = length - to_bow;
    const stern = p.destinationPoint(tostern, hdg + 180);
    const sternport = stern.destinationPoint(to_port, hdg - 90);
    const port = sternport.destinationPoint(0.9 * length, hdg);
    const sternmid = sternport.destinationPoint(beam / 2, hdg + 90);
    const bow = sternmid.destinationPoint(length, hdg);
    const stb = port.destinationPoint(beam, hdg + 90);
    const sternstb = sternport.destinationPoint(beam, hdg + 90);
    const outline = [
      context.lonLatToPixel(sternport.lon, sternport.lat),
      context.lonLatToPixel(port.lon, port.lat),
      context.lonLatToPixel(bow.lon, bow.lat),
      context.lonLatToPixel(stb.lon, stb.lat),
      context.lonLatToPixel(sternstb.lon, sternstb.lat),
    ];

    const ctx = context.getContext();
    ctx.beginPath();
    ctx.globalAlpha = 1; // fixes transparency
    ctx.strokeStyle = "#303030";
    ctx.fillStyle = "#ff000020";
    ctx.lineWidth = scale;
    outline.forEach(([x, y], index) => {
      if (index == 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
  }

  function drawCPA(context, props, target) {
    const tcpa = target.cpadata.tcpa;
    if (undef(tcpa)) return;

    const tpos = (target.fromEstimated && target.estimated) || target.received;
    const rotation = (target.fromEstimated && target.rotation) || 0;
    const tcourse = target.received.course + rotation;
    const tspeed = target.received.speed;
    if (undef(tpos?.lon, tpos?.lat, tcourse, tspeed)) return;

    const { position, course, speed } = props;
    if (undef(position?.lon, position?.lat, course, speed)) return;

    const aP1 = new LatLon(tpos.lat, tpos.lon);
    const aTargetXY = context.lonLatToPixel(aP1.lon, aP1.lat);

    let aP2 = aP1.destinationPoint(tspeed * tcpa, tcourse);
    if (props.Relative) aP2 = aP2.destinationPoint(-speed * tcpa, course);
    const aTargetCPAXY = context.lonLatToPixel(aP2.lon, aP2.lat);
    const aP3 = new LatLon(position.lat, position.lon);
    const aOwnXY = context.lonLatToPixel(aP3.lon, aP3.lat);
    const aP4 = aP3.destinationPoint(speed * tcpa, course);
    const aOwnCPAXY = props.Relative
      ? aOwnXY
      : context.lonLatToPixel(aP4.lon, aP4.lat);

    const scale = context.getScale();
    const ctx = context.getContext();
    ctx.globalAlpha = props.Opacity;
    // draw CPA connection
    ctx.beginPath();
    ctx.strokeStyle = props.FillColor;
    ctx.lineWidth = scale * (props.LineWidth ?? 4);
    ctx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
    ctx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = props.LineColor;
    ctx.setLineDash([scale * 10, scale * 6]);
    ctx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
    ctx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
    ctx.stroke();

    // draw lines from current positions to positions at TCPA
    ctx.beginPath();
    ctx.strokeStyle = props.navCircleColor;
    ctx.lineWidth = scale;
    ctx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
    ctx.lineTo(aOwnXY[0], aOwnXY[1]);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(aTargetCPAXY[0], aTargetCPAXY[1]);
    ctx.lineTo(aTargetXY[0], aTargetXY[1]);
    ctx.stroke();

    // draw circles for positions at TCPA
    ctx.lineWidth = scale * props.StrokeWidthCircle;
    ctx.strokeStyle = props.StrokeColorCircle;
    ctx.setLineDash([]);
    ctx.fillStyle = props.FillColor;
    if (!props.Relative) {
      ctx.beginPath();
      ctx.arc(
        aOwnCPAXY[0],
        aOwnCPAXY[1],
        scale * props.CircleRadius,
        0,
        2 * Math.PI,
      );
      ctx.fill();
      ctx.stroke();
    }

    if (props.Relative || tspeed > 0.0) {
      ctx.beginPath();
      ctx.arc(
        aTargetCPAXY[0],
        aTargetCPAXY[1],
        scale * props.CircleRadius,
        0,
        2 * Math.PI,
      );
      ctx.fill();
      ctx.stroke();
    }
  }

  debug("aiscpa plugin.mjs check version");
  debug("AvNav version: ", fApi.getAvNavVersion());
  if (fApi.getAvNavVersion() < 20261019) {
    debug(
      "AIS CPA plugin requires AVNav version 20261019 or higher, please update your AVNav installation",
    );
    fApi.showToast(
      "AIS CPA plugin requires AVNav version 20261019 or higher, please update your AVNav installation",
    );
    return;
  }

  fApi.registerWidget(AisCpaWidget, AisCpaParameter);
  debug("aiscpa plugin.mjs registerWidget(AisCpaWidget, AisCpaParameter) done");

  fApi.registerUserButton(
    {
      name: "AisCpaButton",
      shortText: "CPA",
      longText: "Show/Hide AIS CPA drawings",
      icon: "images/icon.svg",
      storeKeys: { toggle: VISIBLE },
      onClick: (e) => {
        const visible = !fApi.getStoreData(VISIBLE);
        fApi.setStoreData(VISIBLE, visible);
        fApi.setLocalStorage(VISIBLE, visible);
      },
    },
    "navpage",
  );
  debug(
    "aiscpa plugin.mjs registerUserButton(AisCpaWidget, AisCpaParameter) done",
  );
};

class TargetHistory {
  constructor(log = console.log) {
    this.log = log;
    this.historyByMmsi = new Map();
    this.log("TargetHistory::constructor()");
  }

  add(target) {
    const mmsi = target?.mmsi;
    const lat = target?.received?.lat;
    const lon = target?.received?.lon;
    let history = this.historyByMmsi.get(mmsi);
    if (!history) {
      history = [];
      this.historyByMmsi.set(mmsi, history);
    }
    if (lat == null || lon == null) return history;
    const last = history.at(-1);
    if (last?.lon != lon && last?.lat != lat)
      history.push({ lat, lon, ts: Date.now() / 1000 });
    return history;
  }

  cleanup(maxMinutes) {
    const tmin = Date.now() / 1000 - maxMinutes * 60;
    for (const [mmsi, history] of this.historyByMmsi) {
      while (history.length && history[0].ts < tmin) {
        history.shift();
      }
      if (!history.length) this.historyByMmsi.delete(mmsi);
    }
  }

  clear() {
    this.historyByMmsi.clear();
  }

  targets() {
    return this.historyByMmsi.size;
  }

  points() {
    return [...this.historyByMmsi.values()].reduce(
      (sum, history) => sum + history.length,
      0,
    );
  }
}

function intersects(a, b, w, h) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0], w - a[0], a[1], h - a[1]];

  // if (![...a, ...b, w, h].every(Number.isFinite) || w < 0 || h < 0) {
  // return false;
  // }

  let tMin = 0;
  let tMax = 1;
  for (let i = 0; i < p.length; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
      continue;
    }

    const t = q[i] / p[i];
    if (p[i] < 0) {
      tMin = Math.max(tMin, t);
    } else {
      tMax = Math.min(tMax, t);
    }
    if (tMin > tMax) return false;
  }
  return true;
}

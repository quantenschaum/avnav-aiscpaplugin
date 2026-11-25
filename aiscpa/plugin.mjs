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
  const STOREKEYAISCPA = fApi.getStoreBaseKey() + ".AisCpa";
  fApi.setStoreData(STOREKEYAISCPA, true); // CPAs ares visible by default

  const dev = new URLSearchParams(window.location.search).get("dev") == 1;
  function log(...a) {
    console.log(
      "%cAISCPA",
      "background: gold; color: black; padding: 2px 4px; border-radius: 3px;",
      ...a,
    );
  }
  function debug(...a) {
    if (!dev) return;
    log(...a);
  }
  log("start", fApi, fApi.getAvNavVersion());

  const LatLon = fApi.LatLon();

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
  };

  const AisCpaWidget = {
    // Editable Parameters
    Opacity: 1.0,
    CircleRadius: 7,
    FillColor: "yellow",
    LineColor: "red",
    LineWidth: 4,
    StrokeWidthCircle: 1,
    StrokeColorCircle: "black",
    DrawRealSize: true,
    MinZoom: 11,
    Relative: false,
    name: "AisCpaWidget",
    type: "map",
    // Fordere einfach alles an, was dich interessiert
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
      aiscpaVisible: STOREKEYAISCPA,
    },
    initFunction: function (fCanvas, fProps) {
      this.CPAOpacity = fProps.Opacity;
      this.CPAStrokeWidthCircle = fProps.StrokeWidthCircle;
      this.CPAFillColor = fProps.FillColor;
      this.CPACircleRadius = fProps.CircleRadius;
      this.CPALineColor = fProps.LineColor;
      this.CPALineWidth = fProps.LineWidth;
      this.CPAStrokeColorCircle = fProps.StrokeColorCircle;
      this.CPACourseColor = fProps.navCircleColor;
      this.CPADrawRealSize = fProps.DrawRealSize;
      this.CPAMinZoom = fProps.MinZoom;
      this.CPARelative = fProps.Relative;
    },
    renderCanvas: function (fCanvas, fProps, context) {
      // debug(fProps);
      if (
        !fProps.aisLayerVisible ||
        fProps.currentZoom < this.CPAMinZoom ||
        (!fProps.aiscpaVisible && !this.CPADrawRealSize)
      ) {
        return;
      }

      // debug("update", fProps.aisUpdateCount);

      const aCtx = context.getContext();
      aCtx.save();

      for (const aAisidx in fProps.aisList) {
        const aAis = fProps.aisList[aAisidx];
        try {
          //debug("AisCpaWidget::renderCanvas() ais warning for MMSI " + aAis.mmsi + ", name " + aAis.received.shipname + ", to_bow " + aAis.received.to_bow);
          //debug("AisCpaWidget::renderCanvas() ais = ", aAis);
          // debug(aAis);

          const tpos = (aAis.fromEstimated && aAis.estimated) || aAis.received;

          if (undef(tpos, tpos?.lon, tpos?.lat, aAis.received?.course)) {
            continue;
          }

          const rotation = (aAis.fromEstimated && aAis.rotation) || 0;

          if (this.CPADrawRealSize) {
            drawRealSize(
              this,
              aCtx,
              tpos,
              (aAis.received.heading ?? aAis.received.course) + rotation,
              aAis.received.length,
              aAis.received.beam,
              aAis.received.to_bow,
              aAis.received.to_port,
            );
          }

          if (!fProps.aiscpaVisible) continue;
          if (!aAis.warning) continue;
          if (
            undef(
              fProps.position,
              fProps.position?.lat,
              fProps.position?.lon,
              fProps.speed,
              fProps.course,
              aAis.received?.speed,
              aAis.cpadata?.tcpa,
            )
          ) {
            continue;
          }
          drawCPA(
            this,
            aCtx,
            // aAis.warning,
            fProps.position,
            fProps.speed,
            fProps.course,
            tpos,
            aAis.received.speed,
            aAis.received.course + rotation,
            aAis.cpadata.tcpa,
          );
          // } catch (aE) {
          // log(
          // "error while processing AIS data for mmsi " +
          // aAis.mmsi,
          // aE,
          // );
        } finally {
        }
      }

      aCtx.restore();
      //debug("AisCpaWidget::renderCanvas() fini");
    },
  };

  function undef(...values) {
    return values.some((value) => value == null);
  }

  function drawRealSize(
    self,
    ctx,
    position,
    heading,
    length,
    beam,
    tobow,
    toport,
  ) {
    if (undef(position, heading, length, beam, tobow, toport)) return;

    // debug(self);
    const scale = self.getScale();
    const [width, height] = self.getDimensions();
    // debug(scale, width, height);
    const p = new LatLon(position.lat, position.lon);
    const [x, y] = self.lonLatToPixel(p.lon, p.lat);

    if (x < 0 || x > width || y < 0 || y > height) return; // skip if off screen

    // debug(position, heading, length, beam, tobow, toport);
    const tostern = length - tobow;
    const stern = p.destinationPoint(tostern, heading + 180);
    const sternport = stern.destinationPoint(toport, heading - 90);
    const port = sternport.destinationPoint(0.9 * length, heading);
    const sternmid = sternport.destinationPoint(beam / 2, heading + 90);
    const bowmid = sternmid.destinationPoint(length, heading);
    const stb = port.destinationPoint(beam, heading + 90);
    const sternstb = sternport.destinationPoint(beam, heading + 90);
    const outline = [
      self.lonLatToPixel(sternport.lon, sternport.lat),
      self.lonLatToPixel(port.lon, port.lat),
      self.lonLatToPixel(bowmid.lon, bowmid.lat),
      self.lonLatToPixel(stb.lon, stb.lat),
      self.lonLatToPixel(sternstb.lon, sternstb.lat),
    ];

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

  function drawCPA(
    fSelf,
    fCtx,
    fOwnPos,
    fOwnSpeed,
    fOwnCourse,
    fTargetPos,
    fTargetSpeed,
    fTargetCourse,
    fTcpa,
  ) {
    // debug("own", fOwnPos, fOwnSpeed, fOwnCourse);
    // debug("target", fTargetPos, fTargetSpeed, fTargetCourse);
    // debug("tcpa", fTcpa);
    const scale = fSelf.getScale();

    const aP1 = new LatLon(fTargetPos.lat, fTargetPos.lon);
    const aTargetXY = fSelf.lonLatToPixel(aP1.lon, aP1.lat);

    const aP2 = aP1.destinationPoint(fTargetSpeed * fTcpa, fTargetCourse);
    if (fSelf.CPARelative)
      aP2 = aP2.destinationPoint(-fOwnSpeed * fTcpa, fOwnCourse);
    const aTargetCPAXY = fSelf.lonLatToPixel(aP2.lon, aP2.lat);
    const aP3 = new LatLon(fOwnPos.lat, fOwnPos.lon);
    const aOwnXY = fSelf.lonLatToPixel(aP3.lon, aP3.lat);
    const aP4 = aP3.destinationPoint(fOwnSpeed * fTcpa, fOwnCourse);
    const aOwnCPAXY = fSelf.CPARelative
      ? aOwnXY
      : fSelf.lonLatToPixel(aP4.lon, aP4.lat);

    fCtx.globalAlpha = fSelf.CPAOpacity;
    // draw CPA connection
    fCtx.beginPath();
    fCtx.strokeStyle = fSelf.CPAFillColor;
    fCtx.lineWidth = scale * fSelf.CPALineWidth;
    fCtx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
    fCtx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
    fCtx.stroke();

    fCtx.beginPath();
    fCtx.strokeStyle = fSelf.CPALineColor;
    fCtx.setLineDash([scale * 10, scale * 6]);
    fCtx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
    fCtx.lineTo(aTargetCPAXY[0], aTargetCPAXY[1]);
    fCtx.stroke();

    // draw lines from current positions to positions at TCPA
    fCtx.beginPath();
    fCtx.strokeStyle = fSelf.CPACourseColor;
    fCtx.lineWidth = scale;
    fCtx.moveTo(aOwnCPAXY[0], aOwnCPAXY[1]);
    fCtx.lineTo(aOwnXY[0], aOwnXY[1]);
    fCtx.stroke();

    fCtx.beginPath();
    fCtx.moveTo(aTargetCPAXY[0], aTargetCPAXY[1]);
    fCtx.lineTo(aTargetXY[0], aTargetXY[1]);
    fCtx.stroke();

    // draw circles for positions at TCPA
    fCtx.lineWidth = scale * fSelf.CPAStrokeWidthCircle;
    fCtx.strokeStyle = fSelf.CPAStrokeColorCircle;
    fCtx.setLineDash([]);
    fCtx.fillStyle = fSelf.CPAFillColor;
    if (!fSelf.CPARelative) {
      fCtx.beginPath();
      fCtx.arc(
        aOwnCPAXY[0],
        aOwnCPAXY[1],
        scale * fSelf.CPACircleRadius,
        0,
        2 * Math.PI,
      );
      fCtx.fill();
      fCtx.stroke();
    }

    if (fSelf.CPARelative || fTargetSpeed > 0.0) {
      fCtx.beginPath();
      fCtx.arc(
        aTargetCPAXY[0],
        aTargetCPAXY[1],
        scale * fSelf.CPACircleRadius,
        0,
        2 * Math.PI,
      );
      fCtx.fill();
      fCtx.stroke();
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
      shortText: "AIS CPA",
      longText: "Show/Hide AIS CPA drawings",
      icon: "images/icon.svg",
      toggle: true,
      storeKeys: {
        toggle: STOREKEYAISCPA,
      },
      onClick: (fEv) => {
        //debug("AisCpaWidget::onClick() ev = ", ev);
        const state = !fApi.getStoreData(STOREKEYAISCPA);
        fApi.setStoreData(STOREKEYAISCPA, state);
        //debug("AisCpaWidget::onClick() toggle = ", toggle);
      },
    },
    "navpage",
  );
  debug(
    "aiscpa plugin.mjs registerUserButton(AisCpaWidget, AisCpaParameter) done",
  );

  debug("aiscpa plugin.mjs loaded");
  debug("name", fApi.getPluginName());
  debug("baseUrl", fApi.getBaseUrl());
  const cfg = await fApi.getConfig();
  debug("plugin config", cfg);
  return () => {
    debug("cleanup called for aiscpa plugin.mjs");
  };
};

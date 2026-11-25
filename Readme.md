# AvNav AIS CPA plugin

Draw closest-point-of-approach (CPA) information for AIS targets on the AvNav map. The plugin requires **AvNav 20261019 or newer**.

## Features

- Draw CPA predictions for AIS targets in the `WARNING` state, using the target's TCPA and own-ship/AIS motion data.
- Choose **absolute** CPA display or **Relative** mode, which shows the target's CPA position relative to own ship's current position.
- Draw optional target-history trails, stored by MMSI and limited to the configured history period.
- Draw an optional vessel outline from AIS-reported length, beam, heading, and antenna offsets. Estimated target positions are used when AvNav provides them.
- Toggle CPA drawings with the **CPA** button on the navigation page. The visibility choice is saved locally. Toggling CPA off does not hide vessel outlines or history trails.

## Installation and use

1. Upload the plugin ZIP through AvNav's **Plugins** tab.
2. Add **AisCpaWidget** to a map using **Layouts → Edit Layout → On Map**.
3. Use the **CPA** button on the navigation page to show or hide CPA lines and markers.

For a less cluttered map, the original plugin setup recommends disabling **curved vectors** and setting the AIS **relative motion vector range** to `0` under **Display Settings → AIS**. This is a display recommendation, not a plugin requirement.

## Configuration

![CPA configuration](doc/cpaconfig.png)

The widget options and defaults are:

| Option              | Default      | Description                                                                                                       |
| ------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `Opacity`           | `1.0`        | Opacity of CPA lines and markers.                                                                                 |
| `CircleRadius`      | `7`          | Radius of the CPA position markers.                                                                               |
| `FillColor`         | `yellow`     | Fill color for CPA markers and the solid CPA line.                                                                |
| `LineColor`         | `red`        | Color of the dashed CPA line.                                                                                     |
| `StrokeWidthCircle` | `1`          | CPA marker outline width.                                                                                         |
| `StrokeColorCircle` | `black`      | CPA marker outline color.                                                                                         |
| `DrawRealSize`      | `true`       | Draw vessel outlines when AIS dimensions are available.                                                           |
| `MinZoom`           | `11`         | Minimum zoom setting exposed by the widget. **The current development renderer does not yet apply this setting.** |
| `Relative`          | `false`      | Display CPA relative to own ship's current position.                                                              |
| `HistoryTime`       | `10` minutes | How long to retain and draw target history. Set to `0` to disable history trails.                                 |
| `HistoryColor`      | `#606060`    | Target-history trail color.                                                                                       |
| `HistoryLineWidth`  | `2`          | Target-history trail width.                                                                                       |

Real-size outlines require AIS targets to report vessel dimensions and antenna offsets. CPA predictions require valid own-ship position, course, and speed, plus target motion and TCPA data.

## Examples

![Graphical Closest Point of Approach display](doc/cpaexample1.png)

![Graphical Closest Point of Approach display](doc/cpaexample2.png)

![CPA visibility button](doc/cpaexample3.png)

![CPA visibility button on the navigation page](doc/cpaexample4.png)

![Real-size vessel display](doc/realsizeexample.png)

![Real-size vessel display](doc/realsizeexample2.png)

## Build a package

From this directory, run:

To use today's date as the package version:

```sh
./setVersion.sh
./build.sh
```

To choose a version explicitly, pass it to the first command (for example, `./setVersion.sh 20261127`), then run `./build.sh`. The build creates `releases/avnav-aiscpaplugin-<version>.zip`; upload the resulting ZIP through AvNav's **Plugins** tab.

## FAQ

See [faq.md](faq.md).

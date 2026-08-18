/* Vendored from @uiw/react-heat-map — https://github.com/uiwjs/react-heat-map (MIT).
 * Source: core/src/{index,SVG,Day,Rect,LabelsWeek,LabelsMonth,Legend,utils}.tsx
 *   @ 86a3d0bf02843f4893822b949f8953bc2a0fccae
 * Fetched 2026-08-16. Flattened into one file the way `matrix.tsx` is one file;
 * upstream's module split is a build-tool artefact and eight files for 400 lines
 * hides the one thing that matters here — the date arithmetic.
 * Local changes are marked WORDSCRIPT.
 *
 * WHY THIS IS VENDORED RATHER THAN DEPENDED ON. `rectRender` replaces the
 * emitted element wholesale, which is the whole reason this library was chosen:
 * drawing circles instead of squares is a render override and not a fork. But
 * the column count is not overridable, and that is the one thing this product
 * has to decide for itself (see the WORDSCRIPT note on `columns`). A dependency
 * would have to be patched on every install to say it.
 */

import * as React from "react"
import { Fragment, useMemo } from "react"
import type { CSSProperties } from "react"

/* ── utils ──────────────────────────────────────────────────────────────── */

export function isValidDate(date: Date) {
  return date instanceof Date && !isNaN(date.getTime())
}

const DATE_ONLY_PATTERN = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/

export function parseDate(value: string | Date) {
  if (value instanceof Date) {
    return isValidDate(value) ? new Date(value.getTime()) : null
  }

  const matched = value.match(DATE_ONLY_PATTERN)
  if (matched) {
    const year = Number(matched[1])
    const month = Number(matched[2]) - 1
    const day = Number(matched[3])
    const date = new Date(year, month, day)
    if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
      return date
    }
    return null
  }

  const date = new Date(value)
  return isValidDate(date) ? date : null
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date.getTime())
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

/* WORDSCRIPT: THE WEEK STARTS ON MONDAY (ADR 0235). Upstream subtracts
   `getDay()` outright, which is a Sunday-first grid — GitHub's convention and
   not this reader's. `(getDay() + 6) % 7` is the same subtraction rotated by
   one: Monday 0, Sunday 6. Everything downstream is a walk of seven-day columns
   from whatever this returns, so the rotation moves the whole grid and nothing
   else. The weekday labels beside it are rotated to match in
   `ActivityCalendar`. */
export function getStartOfWeek(date: Date) {
  const startDate = new Date(date.getTime())
  startDate.setHours(0, 0, 0, 0)
  startDate.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7))
  return startDate
}

export function getDateToString(date: Date) {
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

export function formatData(data: HeatMapProps["value"] = []) {
  const result: Record<string, HeatMapValue> = {}
  data.forEach((item) => {
    if (item.date) {
      const date = parseDate(item.date)
      if (!date) return
      const dateString = getDateToString(date)
      result[dateString] = {
        ...item,
        date: dateString,
      }
    }
  })
  return result
}

export function numberSort(keys: number[] = []) {
  return keys.sort((x, y) => {
    if (x < y) return -1
    else if (x > y) return 1
    return 0
  })
}

export function existColor(num: number = 0, nums: number[], panelColors: Record<number, string> = {}) {
  let color = ""
  for (let a = 0; a < nums.length; a += 1) {
    if (nums[a] > num) {
      color = panelColors[nums[a]]
      break
    }
    color = panelColors[nums[a]]
  }
  return color
}

export const convertPanelColors = (colors: string[], maxCount: number): Record<number, string> => {
  const step = Math.ceil(maxCount / (colors.length - 1))
  const panelColors: Record<number, string> = {}
  colors.forEach((color, index) => {
    panelColors[index * step] = color
  })
  return panelColors
}

/* ── Rect ───────────────────────────────────────────────────────────────── */

export interface RectProps extends React.SVGProps<SVGRectElement> {
  value?: HeatMapValue & {
    column: number
    row: number
    index: number
  }
  render?: HeatMapProps["rectRender"]
}

export const Rect = (props: RectProps) => {
  /* WORDSCRIPT: upstream also pulls `key` out of props here, to keep it out of
     `...reset`. React never puts `key` in props, so the read is dead and React
     19 warns on every one of the 182 cells — enough stderr to bury a real
     warning in a test run. The JSX `key` at each call site is untouched. */
  const { style, value, render, ...reset } = props
  const rectProps: React.SVGProps<SVGRectElement> = {
    ...reset,
    style: {
      display: "block",
      /* WORDSCRIPT: upstream hard-codes `cursor: pointer` on every cell. A day
         in this calendar is not a link and does not go anywhere — it explains
         itself on hover — and a pointer cursor on 182 cells promises 182
         navigations that do not exist. */
      ...style,
    },
  }

  if (render && typeof render === "function") {
    const elm = render({ ...rectProps }, value as Required<RectProps>["value"])
    if (elm && React.isValidElement(elm)) {
      return elm
    }
  }

  return <rect {...rectProps} />
}

/* ── Day ────────────────────────────────────────────────────────────────── */

type DayProps = {
  transform?: string
  gridNum?: number
  initStartDate: Date
  endDate?: Date
  rectProps?: RectProps
  rectSize?: number
  space?: number
  startY?: number
  rectRender?: HeatMapProps["rectRender"]
  panelColors?: HeatMapProps["panelColors"]
  value?: HeatMapProps["value"]
}

export const Day: React.FC<React.PropsWithChildren<DayProps>> = (props) => {
  const {
    transform,
    gridNum = 0,
    panelColors = {},
    initStartDate,
    space = 2,
    value = [],
    rectSize = 11,
    endDate,
    rectProps,
    rectRender,
  } = props
  const data = useMemo(() => formatData(value), [value])
  const nums = useMemo(
    () => numberSort(Object.keys(panelColors).map((item) => parseInt(item, 10))),
    [panelColors],
  )
  return (
    <g transform={transform}>
      {gridNum > 0 &&
        [...Array(gridNum)].map((_, idx) => {
          return (
            <g key={idx} data-column={idx}>
              {[...Array(7)].map((_, cidx) => {
                const currentDate = addDays(initStartDate, idx * 7 + cidx)
                const date = getDateToString(currentDate)
                const dataProps: RectProps["value"] = {
                  ...data[date],
                  date: date,
                  row: cidx,
                  column: idx,
                  index: idx * 7 + cidx,
                }
                const dayProps: RectProps = {
                  ...rectProps,
                  fill: "var(--rhm-rect, #EBEDF0)",
                  width: rectSize,
                  height: rectSize,
                  x: idx * (rectSize + space),
                  y: (rectSize + space) * cidx,
                  render: rectRender,
                  value: dataProps,
                }

                if (endDate instanceof Date && currentDate.getTime() > endDate.getTime()) {
                  return null
                }
                if (date && data[date] && panelColors && Object.keys(panelColors).length > 0) {
                  dayProps.fill = existColor(data[date].count || 0, nums, panelColors)
                } else if (panelColors && panelColors[0]) {
                  dayProps.fill = panelColors[0]
                }
                return (
                  <Rect
                    {...dayProps}
                    key={cidx}
                    value={dataProps}
                    data-date={date}
                    data-index={dataProps.index}
                    data-row={dataProps.row}
                    data-column={dataProps.column}
                  />
                )
              })}
            </g>
          )
        })}
    </g>
  )
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

export const textStyle: CSSProperties = {
  textAnchor: "middle",
  fontSize: "inherit",
  fill: "currentColor",
}

export interface LabelsWeekProps extends React.SVGProps<SVGTextElement> {
  weekLabels: HeatMapProps["weekLabels"]
  rectSize: HeatMapProps["rectSize"]
  space: HeatMapProps["space"]
  topPad: number
}

export const LabelsWeek = ({
  weekLabels = [],
  rectSize = 0,
  topPad = 0,
  space = 0,
}: LabelsWeekProps) =>
  useMemo(
    () => (
      <Fragment>
        {[...Array(7)].map((_, idx) => {
          if (weekLabels && weekLabels[idx]) {
            return (
              <text
                className="w-heatmap-week"
                key={idx}
                x={15}
                y={topPad}
                dy={(idx + 1) * (rectSize + space) - 5}
                style={textStyle}
              >
                {weekLabels[idx]}
              </text>
            )
          }
          return null
        })}
      </Fragment>
    ),
    [rectSize, space, topPad, weekLabels],
  )

export interface LabelsMonthProps extends React.SVGProps<SVGTextElement> {
  monthLabels: HeatMapProps["monthLabels"]
  rectSize: HeatMapProps["rectSize"]
  space: HeatMapProps["space"]
  leftPad: number
  colNum: number
  rectY?: number
  startDate: HeatMapProps["startDate"]
  endDate?: HeatMapProps["endDate"]
}

const generateMonthData = (
  colNum: number,
  monthLabels: false | string[],
  startDate: Date,
  endDate?: Date,
) => {
  if (monthLabels === false || colNum < 1) return []
  return Array.from({ length: colNum * 7 })
    .map((_, idx) => {
      if ((idx / 7) % 1 === 0) {
        const date = addDays(startDate, idx)
        const month = date.getMonth()
        if (endDate && date > endDate) return null
        return { col: idx / 7, index: idx, month, day: date.getDate(), monthStr: monthLabels[month], date }
      }
      return null
    })
    .filter(Boolean)
    .filter((item, idx, list) => list[idx - 1] && list[idx - 1]!.month !== item!.month)
}

export const LabelsMonth = ({
  monthLabels = [],
  rectSize = 0,
  space = 0,
  leftPad = 0,
  colNum = 0,
  rectY = 15,
  startDate,
  endDate,
}: LabelsMonthProps) => {
  const data = useMemo(
    () => generateMonthData(colNum, monthLabels, startDate!, endDate),
    [colNum, monthLabels, startDate, endDate],
  )
  return (
    <Fragment>
      {data.map((item, idx) => (
        <text
          key={idx}
          data-size={rectSize}
          x={leftPad + space + space}
          y={rectY}
          dx={item!.col * (rectSize + space)}
          textAnchor="start"
          style={textStyle}
        >
          {item!.monthStr}
        </text>
      ))}
    </Fragment>
  )
}

/* ── Legend ─────────────────────────────────────────────────────────────── */

export interface LegendProps extends RectProps {
  panelColors: HeatMapProps["panelColors"]
  rectSize: HeatMapProps["rectSize"]
  leftPad: number
  rectY: number
  legendCellSize: number
  legendRender?: (props: RectProps) => React.ReactElement
  topPad: number
  space: number
}

export function Legend({
  panelColors,
  leftPad = 0,
  rectY = 15,
  rectSize = 0,
  legendCellSize = 0,
  legendRender,
  ...props
}: LegendProps) {
  const size = legendCellSize || rectSize
  return useMemo(
    () => (
      <Fragment>
        {Object.keys(panelColors || {}).map((num, key) => {
          /* WORDSCRIPT: `key` was in this object as well as on the element, and
             spreading it into JSX is the same React 19 warning as above. */
          const rectProps = {
            ...props,
            x: (size + 1) * key + leftPad,
            y: rectY,
            fill: panelColors![Number(num)],
            width: size,
            height: size,
          }
          if (legendRender) return legendRender(rectProps)
          return <Rect {...rectProps} key={key} />
        })}
      </Fragment>
    ),
    [panelColors, props, size, rectY, leftPad, rectSize, legendRender],
  )
}

/* ── HeatMap ────────────────────────────────────────────────────────────── */

export type HeatMapValue = {
  date: string
  content?: string | string[] | React.ReactNode
  count: number
}

export interface HeatMapProps extends React.SVGProps<SVGSVGElement> {
  startDate?: Date
  endDate?: Date
  /** WORDSCRIPT — REPLACES UPSTREAM'S MEASURED COLUMN COUNT, and it is the one
   *  structural change in this file.
   *
   *  Upstream reads `svgRef.current.clientWidth` in an effect and divides it by
   *  the cell pitch, so the calendar shows however many weeks happen to fit. Two
   *  reasons that cannot stand here. **A calendar that fills its container states
   *  a window it did not choose** — this product shows the window the record can
   *  honestly speak for, which is a fact about the history file and not about the
   *  column it is drawn in. And **`clientWidth` is 0 in jsdom**, so the measured
   *  version renders no days at all under test: the suite would grade an empty
   *  `<g>` and pass.
   *
   *  So the count is a prop, the effect is gone, and the SVG carries its own
   *  width. */
  columns: number
  rectSize?: number
  legendCellSize?: number
  space?: number
  rectProps?: RectProps
  legendRender?: LegendProps["legendRender"]
  rectRender?: (
    data: React.SVGProps<SVGRectElement>,
    valueItem: HeatMapValue & {
      column: number
      row: number
      index: number
    },
  ) => React.ReactElement | void
  value?: Array<HeatMapValue>
  weekLabels?: string[] | false
  monthLabels?: string[] | false
  /** position of month labels @default `top` */
  monthPlacement?: "top" | "bottom"
  panelColors?: Record<number, string> | string[]
}

export function HeatMap(props: HeatMapProps) {
  const {
    columns,
    rectSize = 11,
    legendCellSize = 11,
    space = 2,
    monthPlacement = "top",
    startDate = new Date(),
    endDate,
    rectProps,
    rectRender,
    legendRender,
    value = [],
    weekLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    panelColors = ["var(--rhm-rect, #EBEDF0)", "#C6E48B", "#7BC96F", "#239A3B", "#196127"],
    style,
    ...other
  } = props || {}

  const maxCount = Math.max(...value.map((item) => item.count), 0)
  const panelColorsObject = Array.isArray(panelColors)
    ? convertPanelColors(panelColors, maxCount)
    : panelColors

  /* WORDSCRIPT: `leftPad` and `topPad` were `useState` + effects that mirrored
     their own props. With the column count no longer measured there is nothing
     left for them to react to, so they are derived. */
  const leftPad = weekLabels ? 28 : 5
  const defaultTopPad = monthPlacement === "top" ? 20 : 5
  const topPad = monthLabels ? defaultTopPad : 5

  const gridNum = Math.max(0, columns)

  /* Upstream's normalisation, kept: a grid whose first column starts mid-week
     puts the same weekday on different rows in different renders. The caller
     may hand over any date; the display always begins on a Monday. */
  const initStartDate = useMemo(
    () => (isValidDate(startDate) ? getStartOfWeek(startDate) : getStartOfWeek(new Date())),
    [startDate],
  )

  const styl = {
    color: "var(--rhm-text-color, #24292e)",
    userSelect: "none",
    display: "block",
    fontSize: 10,
  } as CSSProperties

  const monthRectY = monthPlacement === "top" ? 15 : 15 * 7 + space
  const legendTopPad =
    monthPlacement === "top"
      ? topPad + rectSize * 8 + 6
      : (monthLabels ? topPad + rectSize + space : topPad) + rectSize * 8 + 6

  /* WORDSCRIPT: the SVG states its own size. Upstream has none — it fills its
     container and derives the grid from that; here the grid is decided and the
     box follows it, which is the same swap in the other direction. */
  const width = leftPad + gridNum * (rectSize + space) - space
  const height = topPad + 7 * (rectSize + space) - space

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ ...styl, ...style }}
      {...other}
    >
      {legendCellSize !== 0 && (
        <Legend
          legendRender={legendRender}
          panelColors={panelColorsObject}
          rectSize={rectSize}
          rectY={legendTopPad}
          legendCellSize={legendCellSize}
          leftPad={leftPad}
          topPad={topPad}
          space={space}
        />
      )}
      <LabelsWeek weekLabels={weekLabels} rectSize={rectSize} space={space} topPad={topPad} />
      <LabelsMonth
        monthLabels={monthLabels}
        rectSize={rectSize}
        space={space}
        leftPad={leftPad}
        colNum={gridNum}
        rectY={monthRectY}
        startDate={initStartDate}
        endDate={endDate}
      />
      <Day
        transform={`translate(${leftPad}, ${topPad})`}
        gridNum={gridNum}
        initStartDate={initStartDate}
        endDate={endDate}
        rectProps={rectProps}
        rectSize={rectSize}
        rectRender={rectRender}
        panelColors={panelColorsObject}
        value={value}
        space={space}
      />
    </svg>
  )
}

export default HeatMap

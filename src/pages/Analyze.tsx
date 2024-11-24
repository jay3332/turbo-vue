import {getApi} from "../api/Api";
import {createEffect, createMemo, createSignal, on, onCleanup} from "solid-js";
import {
  Chart,
  BubbleController,
  LineController,
  LinearScale,
  TimeScale,
  Tooltip,
  PointElement,
  LineElement
} from "chart.js";
import 'chartjs-adapter-date-fns';
import {Assignment} from "../api/types";
import {useNumericParams} from "../utils";

Chart.register(BubbleController, LineController, LinearScale, TimeScale, Tooltip, LineElement, PointElement)

const resolve = (name: string) => {
  const el = document.createElement('div')
  el.style.color = `rgb(${name})`
  document.body.appendChild(el)
  const color = getComputedStyle(el).color
  document.body.removeChild(el)
  console.log(color.slice(4, -1))
  return color.slice(4, -1)
}

export default function Analyze() {
  const gradebook = getApi()!.gradebook!
  const {gradingPeriod, courseId} = useNumericParams()
  const key = createMemo(() => `${gradingPeriod()!}:${courseId()!}` as const)
  const course = createMemo(() => gradebook.courses.get(key())!)
  const assignments = createMemo(() => {
    const assignments = gradebook.modifiedCourses.get(key())!.assignments
    return assignments.slice(assignments.findIndex(assignment => !assignment.isCustom))
  })

  const measureTypeOpacityMap = createMemo(() => {
    const weights = [...gradebook.weighting.weights.values()]
    const maxWeight = weights.reduce((max, measureType) => Math.max(max, measureType.weight), 0)
    return weights.reduce((map, measureType) => {
      map[measureType.name] = measureType.weight / maxWeight * 0.6 + 0.2
      return map
    }, {} as Record<string, number>)
  })

  let canvasRef: HTMLCanvasElement | null = null
  const [chart, setChart] = createSignal<Chart | null>(null)

  createEffect(on([assignments], ([assignments]) => {
    if (!assignments.length)
      return

    const canvas = canvasRef!
    const style = getComputedStyle(document.documentElement)
    const maxScore = assignments.reduce((max, assignment) => Math.max(max, assignment.maxScore ?? 0), 0)
    const resolvedAssignments = assignments.toReversed().filter(a => a.score != null && a.maxScore != null).map(a => {
      const ratio = a.score! / a.maxScore!
      return {
        ...a,
        ratio,
        color: resolve(!a.notForGrading ? gradebook.policy.getMark(ratio).color : 'var(--c-fg)'),
        radius: Math.max(1, a.maxScore! / maxScore * 15),
      } as Assignment & { ratio: number, color: string, radius: number }
    })

    const startTime = new Date(resolvedAssignments[0].dueDate).getTime()
    const endTime = new Date(resolvedAssignments[resolvedAssignments.length - 1].dueDate).getTime()
    const elapsed = endTime - startTime
    const padding = elapsed * 0.04

    Chart.defaults.color = `rgb(${resolve('var(--c-fg)')}, 0.8)`
    Chart.defaults.borderColor = `rgba(${resolve('var(--c-fg)')}, 0.1)`
    Chart.defaults.font.family = style.getPropertyValue('font-family')
    Chart.defaults.font.weight = 'normal'

    const accumulated = []
    const dataset = []
    const lineColors = []
    for (const assignment of assignments.toReversed()) {
      accumulated.push(assignment)
      const ratio = gradebook.calculateWeightedPointRatio(gradingPeriod()!, courseId()!, undefined, accumulated)
      lineColors.push(`rgb(${resolve(gradebook.policy.getMark(ratio).color)})`)
      dataset.push({
        x: new Date(assignment.dueDate).getTime(),
        y: ratio * 100,
        r: 0,
      })
    }

    let width: number, height: number
    let gradient: CanvasGradient | null = null

    chart()?.destroy()
    setChart(new Chart(canvas, {
      options: {
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: 3,
        scales: {
          x: {
            type: 'time',
            min: startTime - padding,
            max: endTime + padding,
          },
          y: {
            ticks: { callback: value => value.toString().slice(0, 4) + '%' },
          }
        },
        parsing: false,
        plugins: {
          tooltip: {
            mode: 'index',
            intersect: true,
            displayColors: false,
            position: 'nearest',
            filter: (context: any) => context.datasetIndex === 0,
            callbacks: {
              title: (context: any) => context.map((ctx: any) => resolvedAssignments[ctx.dataIndex].name),
              beforeLabel: (ctx: any) => resolvedAssignments[ctx.dataIndex].type,
              label: (context: any) => {
                const assignment = resolvedAssignments[context.dataIndex]
                return [
                  `Score: ${assignment.score!}/${assignment.maxScore} `
                  + `(${(assignment.ratio * 100).toFixed(2)}%)`,
                  `Date: ${new Date(assignment.dueDate).toLocaleDateString()}`,
                ]
              }
            },
          }
        },
      },
      data: {
        datasets: [
          {
            type: 'bubble',
            parsing: false,
            data: resolvedAssignments.map(assignment => ({
              x: new Date(assignment.dueDate).getTime(),
              y: assignment.ratio * 100,
              r: assignment.maxScore!,
            })),
            backgroundColor: resolvedAssignments.map(assignment => `rgba(${assignment.color}, ${
              !assignment.notForGrading ? measureTypeOpacityMap()[assignment.type] : 0.2
            })`),
            borderColor: resolvedAssignments.map(assignment => `rgb(${assignment.color})`),
            radius: resolvedAssignments.map(assignment => assignment.radius),
            hoverRadius: resolvedAssignments.map(assignment => Math.max(2, assignment.radius * 0.7)),
          },
          {
            type: 'line',
            parsing: false,
            data: dataset,
            backgroundColor: lineColors,
            borderColor: (context: any) => {
              const chart: Chart = context.chart
              const { ctx, chartArea } = chart
              if (!chartArea) return

              const chartWidth = chartArea.right - chartArea.left;
              const chartHeight = chartArea.bottom - chartArea.top;

              if (!gradient || width !== chartWidth || height !== chartHeight) {
                // Create the gradient because this is either the first render
                // or the size of the chart has changed
                width = chartWidth;
                height = chartHeight;
                gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);

                const lowestTick = chart.scales.y.min
                const step = (chart.scales.y.max - lowestTick) / 20
                for (let i = 0; i < 20; i++) {
                  const y = lowestTick + step * i
                  gradient.addColorStop(
                    i / 20,
                    `rgb(${resolve(gradebook.policy.getMark(y / 100).color)})`,
                  )
                }
                return gradient
              }
            },
            pointRadius: 0,
            pointStyle: false,
            tension: 0.4,
            cubicInterpolationMode: 'monotone',
          }
        ]
      },
    }))
  }))

  onCleanup(() => chart()?.destroy())

  return (
    <div class="flex flex-col flex-grow">
      <div class="p-2 relative w-full flex-grow">
        <canvas ref={canvasRef!} />
      </div>
    </div>
  )
}

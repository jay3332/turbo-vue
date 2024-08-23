import {getApi} from "../api/Api";
import {useParams} from "@solidjs/router";
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

Chart.register(BubbleController, LineController, LinearScale, TimeScale, Tooltip, LineElement, PointElement)

export default function Analyze() {
  const gradebook = getApi()!.gradebook!
  const params = useParams()
  const key = createMemo(() => `${params.gradingPeriod}:${params.courseId}`)
  const course = createMemo(() => gradebook.courses.get(key())!)
  const assignments = createMemo(() => {
    const assignments = gradebook.modifiedCourses.get(key())!.assignments
    return assignments.slice(assignments.findIndex(assignment => !assignment.isCustom))
  })

  const measureTypeOpacityMap = createMemo(() => {
    const maxWeight = gradebook.policy.measureTypes.reduce((max, measureType) => Math.max(max, measureType.weight), 0)
    return gradebook.policy.measureTypes.reduce((map, measureType) => {
      map[measureType.id] = measureType.weight / maxWeight * 0.6 + 0.2
      return map
    }, {} as Record<number, number>)
  })

  let canvasRef: HTMLCanvasElement | null = null
  const [chart, setChart] = createSignal<Chart | null>(null)

  createEffect(on([assignments], ([assignments]) => {
    if (!assignments.length)
      return

    const style = getComputedStyle(document.documentElement)
    const resolve = (name: string) => style.getPropertyValue(`--c-${name}`).trim().split(' ').join(', ')

    const canvas = canvasRef!
    const maxScore = assignments.reduce((max, assignment) => Math.max(max, parseFloat(assignment.maxScore)), 0)
    const resolvedAssignments = assignments.toReversed().filter(a => a.score != null).map(a => {
      const ratio = parseFloat(a.score!) / parseFloat(a.maxScore)
      return {
        ...a,
        ratio,
        color: resolve(a.isForGrading && !a.excused ? gradebook.calculateScoreStyle(a.reportCardScoreTypeId, ratio) : 'fg'),
        radius: Math.max(1, parseFloat(a.maxScore) / maxScore * 15),
      } as Assignment & { ratio: number, color: string, radius: number }
    })

    const startTime = new Date(resolvedAssignments[0].dueDate).getTime()
    const endTime = new Date(resolvedAssignments[resolvedAssignments.length - 1].dueDate).getTime()
    const elapsed = endTime - startTime
    const padding = elapsed * 0.04

    Chart.defaults.color = `rgb(${resolve('fg')}, 0.8)`
    Chart.defaults.borderColor = `rgba(${resolve('fg')}, 0.1)`
    Chart.defaults.font.family = style.getPropertyValue('font-family')
    Chart.defaults.font.weight = 'normal'

    const accumulated = []
    const dataset = []
    const lineColors = []
    for (const assignment of assignments.toReversed()) {
      accumulated.push(assignment)
      const ratio = gradebook.calculateWeightedPointRatio(params.gradingPeriod, parseInt(params.courseId), undefined, accumulated)
      lineColors.push(`rgb(${resolve(gradebook.calculateScoreStyle(assignment.reportCardScoreTypeId, ratio))})`)
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
            ticks: { callback: value => value + '%' },
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
              beforeLabel: (ctx: any) => resolvedAssignments[ctx.dataIndex].category,
              label: (context: any) => {
                const assignment = resolvedAssignments[context.dataIndex]
                return [
                  `Score: ${parseFloat(assignment.score!)}/${parseFloat(assignment.maxScore)} `
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
              r: parseFloat(assignment.maxScore),
            })),
            backgroundColor: resolvedAssignments.map(assignment => `rgba(${assignment.color}, ${
              assignment.isForGrading && !assignment.excused ? measureTypeOpacityMap()[assignment.measureTypeId] : 0.2
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
                    `rgb(${resolve(gradebook.calculateScoreStyle(gradebook.policy.defaultReportCardScoreTypeId, y / 100))})`,
                  )
                }
                return gradient
              }
            },
            pointRadius: 0,
            pointStyle: false,
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

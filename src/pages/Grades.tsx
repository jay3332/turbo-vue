import {getApi, Gradebook} from "../api/Api";
import {createEffect, createMemo, For, ParentProps, Show} from "solid-js";
import {Course, GradebookInfo} from "../api/types";
import Icon from "../components/icons/Icon";
import LocationDot from "../components/icons/svg/LocationDot";
import {A, useParams} from "@solidjs/router";
import {isMCPS} from "../utils";
import tooltip from "../directives/tooltip";
void tooltip

export function sanitizeCourseName(name: string): string {
  if (!isMCPS()) return name
  return name.replace(/ \([A-Z0-9]{4,}\)$/, '')
}

export function CourseGrade(
  { gradebook, gradingPeriod, course }: { gradebook: Gradebook, gradingPeriod: number, course: Course }
) {
  const ratio = createMemo(() => gradebook.calculateWeightedPointRatio(gradingPeriod, course.classId));
  const mark = createMemo(() => gradebook.policy.getMark(ratio()))
  const style = () => ({ color: `rgb(${mark().color})` })
  const fmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })

  return (
    <div class="flex flex-col items-center w-12">
      <span class="font-title text-xl" style={style()}>{mark().mark}</span>
      <Show when={!isNaN(ratio())}>
        <span class="text-sm" style={style()}>{fmt.format(ratio())}</span>
      </Show>
    </div>
  )
}

function Stat(props: ParentProps<{ label: string, tooltip: string }>) {
  return (
    <div class="flex flex-col items-center" use:tooltip={{ content: props.tooltip, placement: 'top' }}>
      {props.children}
      <span class="font-title font-bold text-sm text-fg/60">{props.label}</span>
    </div>
  )
}

function GPA(props: { label: string, gpa: number, tooltip: string }) {
  return (
    <Stat label={props.label} tooltip={props.tooltip}>
      <h2 class="font-medium text-xl" style={{ color: `rgb(var(--c-scale-${Math.floor(props.gpa) + 1}))` }}>{
        isNaN(props.gpa)
          ? 'N/A'
          : props.gpa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }</h2>
    </Stat>
  )
}

export function GradesInner(props: { gradebook: Gradebook, gradingPeriod: number }) {
  const gradebook = props.gradebook
  const gpas = createMemo(() => gradebook.calculateGpa(props.gradingPeriod))
  const gp = () => gradebook.gradingPeriods[props.gradingPeriod]
  const daysLeft = createMemo(() => {
    const end = gp().endDate
    const diff = Date.parse(end) - Date.now()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  })

  return (
    <div class="flex flex-col h-full justify-between">
      <div class="flex flex-col p-2">
        <div class="flex gap-2 flex-wrap">
          <For each={gradebook.sortedCourses(props.gradingPeriod)}>
            {(course: Course) => (
              <A
                href={`/grades/${props.gradingPeriod}/${course.classId}`}
                class="flex justify-between items-center p-4 rounded-xl w-full lg:w-[calc(50%-0.25rem)] bg-bg-0/50
                  transition hover:bg-bg-3/80"
              >
                <div class="flex flex-col">
                  <span class="font-title font-medium md:text-lg">{sanitizeCourseName(course.name)}</span>
                  <span class="flex items-center gap-x-3 mobile-xs:flex-col mobile-xs:items-start">
                    <span class="text-sm text-fg/50 text-left">{course.teacher}</span>
                    <span class="flex items-center gap-x-1 text-left">
                      <Icon icon={LocationDot} class="w-4 h-4 fill-fg/50" />
                      <span class="text-sm text-fg/50">{course.room}</span>
                    </span>
                  </span>
                </div>
                <CourseGrade gradebook={gradebook} gradingPeriod={props.gradingPeriod} course={course} />
              </A>
            )}
          </For>
        </div>
      </div>
      {isMCPS() && (
        <div class="px-2 sm:pb-2">
          <div class="sm:bg-0 sm:p-4 pt-2 pb-4 px-4 rounded-xl grid grid-cols-3">
            <GPA label="GPA" gpa={gpas()?.unweighted} tooltip="Unweighted Grade Point Average" />
            <GPA label="WGPA" gpa={gpas()?.weighted} tooltip="Weighted Grade Point Average" />
            <Stat
              label={daysLeft() < 0 ? "Days Ago" : "Days Left"}
              tooltip={`This term spans from ${gp().startDate} to ${gp().endDate}`}
            >
              <h2 class="font-medium text-xl">{Math.abs(daysLeft())}</h2>
            </Stat>
          </div>
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div class="flex flex-col h-full justify-between">
      <div class="flex flex-col p-2">
        <div class="flex gap-2 flex-wrap">
          <For each={[0, 1, 2, 3, 4, 5]}>
            {(i) => (
              <div
                class="rounded-xl w-full lg:w-[calc(50%-0.25rem)] h-20 bg-bg-0/30 animate-pulse"
                style={{ 'animation-delay': i * 100 + 'ms' }}
              />
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

export default function Grades() {
  const api = getApi()!
  const params = useParams()
  const gradebook = () => api.gradebook
  const gradingPeriod = createMemo(
    () => params.gradingPeriod ? parseInt(params.gradingPeriod) : gradebook()?.defaultGradingPeriod
  )

  createEffect(async () => {
    const gb = gradebook()
    if (!gb) {
      const { data } = await api.request<GradebookInfo>('/grades')
      if (data) api.gradebook = Gradebook.fromResponse(api, data)
    }
    if (!gb) return  // if we still don't have a gradebook, don't try to fetch courses

    if (!gb.isGPLoaded(gradingPeriod()!)) {
      const { data } = await api.request<Course[]>(`/grades/${gradingPeriod()}`)
      if (data) {
        gb.populateAllCourses(gradingPeriod()!, data)
      }
    }
  })

  return (
    <Show when={gradebook() && gradebook()?.isGPLoaded(gradingPeriod()!)} fallback={<Skeleton />}>
      <GradesInner gradebook={gradebook()!} gradingPeriod={gradingPeriod()!} />
    </Show>
  )
}
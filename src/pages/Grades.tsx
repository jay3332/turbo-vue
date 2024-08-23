import {getApi, Gradebook} from "../api/Api";
import {createEffect, createMemo, For, ParentProps, Show} from "solid-js";
import {CourseMetadata, GetGradebookResponse} from "../api/types";
import Icon from "../components/icons/Icon";
import LocationDot from "../components/icons/svg/LocationDot";
import {A, useParams} from "@solidjs/router";
import Loading from "../components/Loading";
import {isMCPS} from "../utils";

function sanitizeGradePreview(preview: string): number {
  if (preview?.endsWith('%')) preview = preview.slice(0, -1)
  return parseFloat(preview)
}

export function CourseGrade(
  { gradebook, gradingPeriod, course }: { gradebook: Gradebook, gradingPeriod: string, course: CourseMetadata }
) {
  const resolved = createMemo(() => gradebook.courses.get(`${gradingPeriod}:${course.ID}`))
  const ratio = createMemo(() => {
    if (!resolved()) return sanitizeGradePreview(course.scorePreview) / 100
    else if (!gradebook.modifiedCourses.has(`${gradingPeriod}:${course.ID}`))
      return resolved()!.classGrades[0].totalWeightedPercentage / 100

    return gradebook.calculateWeightedPointRatio(gradingPeriod, course.ID)
  });
  const scoreStyle = createMemo(() => resolved()
    ? gradebook.calculateScoreStyle(resolved()!.classGrades[0].reportCardScoreTypeId, ratio())
    : gradebook.calculateScoreStyle(gradebook.policy.defaultReportCardScoreTypeId, ratio())
  )
  const mark = createMemo(() => {
    if (!resolved()) return course.markPreview
    const grade = resolved()!.classGrades[0]
    if (!gradebook.modifiedCourses.has(`${gradingPeriod}:${course.ID}`))
      return grade.manualMark ?? grade.calculatedMark

    return gradebook.calculateMark(grade.reportCardScoreTypeId, ratio())
  })
  const style = () => ({ color: `rgb(var(--c-${scoreStyle()}))` })
  const fmt = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 2 })

  return (
    <div class="flex flex-col items-center w-12">
      <span class="font-title text-xl" style={style()}>{mark()}</span>
      <Show when={!isNaN(ratio())}>
        <span class="text-sm" style={style()}>{fmt.format(ratio())}</span>
      </Show>
    </div>
  )
}

function Stat(props: ParentProps<{ label: string }>) {
  return (
    <div class="flex flex-col items-center">
      {props.children}
      <span class="font-title font-bold text-sm text-fg/60">{props.label}</span>
    </div>
  )
}

function GPA(props: { label: string, gpa: number }) {
  return (
    <Stat label={props.label}>
      <h2 class="font-medium text-xl" style={{ color: `rgb(var(--c-scale-${Math.floor(props.gpa) + 1}))` }}>{
        isNaN(props.gpa)
          ? 'N/A'
          : props.gpa.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }</h2>
    </Stat>
  )
}

export function GradesInner(props: { gradebook: Gradebook, gradingPeriod: string }) {
  const gradebook = props.gradebook
  const gpas = createMemo(() => gradebook.calculateMcpsGpa(props.gradingPeriod))

  return (
    <div class="flex flex-col h-full justify-between">
      <div class="flex flex-col p-2">
        <div class="flex gap-2 flex-wrap">
          <For each={gradebook.courseOrders.get(props.gradingPeriod)}>
            {(course: CourseMetadata) => (
              <A
                href={`/grades/${props.gradingPeriod}/${course.ID}`}
                class="flex justify-between items-center p-4 rounded-xl w-full lg:w-[calc(50%-0.25rem)] bg-bg-0/50
                  transition hover:bg-bg-3/80"
              >
                <div class="flex flex-col">
                  <span class="font-title font-medium md:text-lg">{course.Name}</span>
                  <span class="flex items-center gap-x-3 mobile-xs:flex-col mobile-xs:items-start">
                    <span class="text-sm text-fg/50 text-left">{course.TeacherName}</span>
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
          <div class="sm:bg-0 sm:p-4 pt-2 pb-4 px-4 rounded-xl grid grid-cols-2">
            <GPA label="GPA" gpa={gpas().unweighted} />
            <GPA label="WGPA" gpa={gpas().weighted} />
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
  const gradingPeriod = createMemo(() => params.gradingPeriod ?? gradebook()?.defaultGradingPeriod)

  createEffect(async () => {
    const gb = gradebook()
    if (!gb) {
      const { data } = await api.request<GetGradebookResponse>('/grades')
      if (data) api.gradebook = Gradebook.fromResponse(api, data)
    }
    if (!gb) return  // if we still don't have a gradebook, don't try to fetch courses

    if (!gb.courseOrders.has(gradingPeriod())) {
      const { data } = await api.request(`/grades/${gradingPeriod()}/courses?include_course_order=1`)
      if (data) {
        const { courseOrder, courses } = data
        gb.courseOrders.set(gradingPeriod(), courseOrder)
        gb.populateAllCourses(gradingPeriod(), courses)
      }
    }
  })

  return (
    <Show when={gradebook() && gradebook()!.courseOrders.has(gradingPeriod())} fallback={<Skeleton />}>
      <GradesInner gradebook={gradebook()!} gradingPeriod={gradingPeriod()} />
    </Show>
  )
}